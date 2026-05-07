"""Real model lifecycle: validate, benchmark, deploy.

All admin-gated. Reads/writes the `model-uploads` storage bucket (source of
truth for artifact bytes) and the `public.model_versions` + `public.model_metrics`
tables (source of truth for lifecycle state + eval metrics).

Benchmark currently measures real latency (N forward passes on random tensors)
but leaves accuracy/f1 null until an eval set is provisioned in the bucket
under `eval-set/labels.csv` + image files. Accuracy/F1 are surfaced from a
client-supplied metrics bundle on deploy (next increment: auto-populate from
an uploaded `metrics.json` training artifact).
"""
import statistics
import time
from datetime import datetime, timezone
from typing import Any, Optional

import onnx
import onnx2torch
import requests
import torch
from flask import Blueprint, jsonify, request

from api._auth import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, require_admin, service_headers
from api.metrics import _rest_get, ingest_metrics
from api import eval_set

model_lifecycle_bp = Blueprint("model_lifecycle", __name__, url_prefix="/api")

BUCKET = "model-uploads"
EXPECTED_INPUT_SHAPE = (1, 3, 456, 456)
EXPECTED_OUTPUT_SHAPE = (1, 8)
BENCH_RUNS = 20


# ---------- Storage helpers ----------

def _storage_download(path: str) -> Optional[bytes]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=120,
        )
        if resp.status_code != 200:
            return None
        return resp.content
    except Exception:
        return None


def _storage_upload(path: str, data: bytes, content_type: str = "application/octet-stream") -> bool:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return False
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            data=data,
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            timeout=120,
        )
        return resp.status_code in (200, 201)
    except Exception:
        return False


def _storage_copy(src: str, dst: str) -> bool:
    """Copy within the same bucket via download+upload.

    Supabase exposes POST /storage/v1/object/copy but its request shape has
    churned between versions; a download+upload round-trip is simpler and
    costs one extra hop that only runs on deploy.
    """
    data = _storage_download(src)
    if data is None:
        return False
    return _storage_upload(dst, data)


def _rest_patch(path: str, params: dict, body: dict) -> bool:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return False
    try:
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/{path}",
            params=params,
            json=body,
            headers={**service_headers(), "Prefer": "return=minimal"},
            timeout=5,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


def _rest_post(path: str, body: Any, prefer: str = "return=representation") -> Optional[Any]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/{path}",
            json=body,
            headers={**service_headers(), "Prefer": prefer},
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            return None
        return resp.json() if resp.text else None
    except Exception:
        return None


# ---------- ONNX helpers ----------

def _check_shapes(model: onnx.ModelProto) -> Optional[str]:
    """Return an error string if input/output shapes don't match, else None."""
    try:
        input0 = model.graph.input[0]
        in_shape = tuple(
            d.dim_value for d in input0.type.tensor_type.shape.dim
        )
        output0 = model.graph.output[0]
        out_shape = tuple(
            d.dim_value for d in output0.type.tensor_type.shape.dim
        )
    except Exception as e:
        return f"Unable to read tensor shapes: {e}"

    if in_shape != EXPECTED_INPUT_SHAPE:
        # Allow dynamic batch: treat 0/None first dim as 1.
        in_fixed = (1,) + in_shape[1:] if len(in_shape) == 4 and in_shape[0] in (0, None) else in_shape
        if in_fixed != EXPECTED_INPUT_SHAPE:
            return f"Input shape {in_shape} != expected {EXPECTED_INPUT_SHAPE}"

    if out_shape != EXPECTED_OUTPUT_SHAPE:
        out_fixed = (1,) + out_shape[1:] if len(out_shape) == 2 and out_shape[0] in (0, None) else out_shape
        if out_fixed != EXPECTED_OUTPUT_SHAPE:
            return f"Output shape {out_shape} != expected {EXPECTED_OUTPUT_SHAPE}"
    return None


# ---------- Endpoints ----------

@model_lifecycle_bp.route("/model/upload/validate", methods=["POST"])
@require_admin
def validate():
    payload = request.get_json(silent=True) or {}
    path = (payload.get("path") or "").strip()
    if not path:
        return jsonify({"ok": False, "error": "Missing 'path'"}), 400
    if not (path.lower().endswith(".onnx") or path.lower().endswith(".pt")):
        return jsonify({"ok": False, "error": "Only .onnx or .pt accepted"}), 400

    data = _storage_download(path)
    if data is None:
        return jsonify({"ok": False, "error": "Artifact not found in storage"}), 404

    if path.lower().endswith(".pt"):
        # .pt means a raw PyTorch state_dict. We only validate .onnx structurally;
        # for .pt we just accept the upload.
        return jsonify(
            {
                "ok": True,
                "path": path,
                "size_mb": round(len(data) / (1024 * 1024), 2),
                "format": "pt",
                "checks": {"format_accepted": True},
            }
        )

    try:
        model = onnx.load_from_string(data)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Not a valid ONNX file: {e}"}), 400

    try:
        onnx.checker.check_model(model)
    except Exception as e:
        return jsonify({"ok": False, "error": f"ONNX check failed: {e}"}), 400

    shape_err = _check_shapes(model)
    if shape_err:
        return jsonify({"ok": False, "error": shape_err}), 400

    return jsonify(
        {
            "ok": True,
            "path": path,
            "size_mb": round(len(data) / (1024 * 1024), 2),
            "format": "onnx",
            "checks": {
                "structural": True,
                "input_shape": list(EXPECTED_INPUT_SHAPE),
                "output_shape": list(EXPECTED_OUTPUT_SHAPE),
            },
        }
    )


@model_lifecycle_bp.route("/model/upload/benchmark", methods=["POST"])
@require_admin
def benchmark():
    payload = request.get_json(silent=True) or {}
    path = (payload.get("path") or "").strip()
    if not path:
        return jsonify({"error": "Missing 'path'"}), 400

    data = _storage_download(path)
    if data is None:
        return jsonify({"error": "Artifact not found in storage"}), 404

    if not path.lower().endswith(".onnx"):
        return jsonify({"error": "Benchmark only supported for .onnx"}), 400

    try:
        model = onnx2torch.convert(onnx.load_from_string(data))
        model.eval()
    except Exception as e:
        return jsonify({"error": f"Model conversion failed: {e}"}), 400

    dummy = torch.randn(*EXPECTED_INPUT_SHAPE, dtype=torch.float32)
    latencies = []
    with torch.no_grad():
        # Warmup.
        for _ in range(3):
            _ = model(dummy)
        for _ in range(BENCH_RUNS):
            t0 = time.perf_counter()
            _ = model(dummy)
            latencies.append((time.perf_counter() - t0) * 1000)

    median_ms = int(statistics.median(latencies))
    p95_ms = int(sorted(latencies)[int(len(latencies) * 0.95) - 1])

    eval_results = None
    try:
        eval_results = eval_set.evaluate(model)
    except Exception as e:
        # Eval is best-effort; never fail the latency benchmark on it.
        print(f"[WARNING] Eval-set evaluation failed: {e}")

    if eval_results is None:
        return jsonify(
            {
                "accuracy": None,
                "f1": None,
                "latency_ms": median_ms,
                "latency_p95_ms": p95_ms,
                "runs": BENCH_RUNS,
                "eval_set_available": False,
                "note": "Latency is real; accuracy/F1 null until an eval set is provisioned under eval-set/ in the model-uploads bucket.",
            }
        )

    return jsonify(
        {
            "accuracy": eval_results["accuracy"],
            "balanced_acc": eval_results["balanced_acc"],
            "f1": eval_results["macro_f1"],
            "per_class": eval_results["per_class"],
            "confusion": eval_results["confusion"],
            "eval_total": eval_results["total"],
            "latency_ms": median_ms,
            "latency_p95_ms": p95_ms,
            "runs": BENCH_RUNS,
            "eval_set_available": True,
        }
    )


@model_lifecycle_bp.route("/model/deploy", methods=["POST"])
@require_admin
def deploy():
    payload = request.get_json(silent=True) or {}
    path = (payload.get("path") or "").strip()
    version = (payload.get("version") or "").strip()
    target = (payload.get("target") or "staging").strip()
    architecture = payload.get("architecture") or None
    params = payload.get("params") or None
    notes = payload.get("notes") or None
    bench = payload.get("benchmark") or {}

    if not path:
        return jsonify({"deployed": False, "error": "Missing 'path'"}), 400
    if not version:
        return jsonify({"deployed": False, "error": "Missing 'version'"}), 400
    if target not in ("staging", "canary", "production"):
        return jsonify({"deployed": False, "error": "Invalid target"}), 400

    # Canary -> store as 'staging' for now (schema check allows staging/production/archived).
    status = "production" if target == "production" else "staging"

    final_path = path
    if status == "production":
        dst = f"production/{version}.onnx"
        if not _storage_copy(path, dst):
            return jsonify({"deployed": False, "error": "Storage copy failed"}), 500
        final_path = dst

    # Check version uniqueness.
    existing = _rest_get(
        "model_versions",
        {"version": f"eq.{version}", "select": "id"},
    )
    if existing:
        return jsonify({"deployed": False, "error": f"Version {version} already exists"}), 409

    inserted = _rest_post(
        "model_versions",
        {
            "version": version,
            "status": status,
            "architecture": architecture,
            "params": params,
            "notes": notes,
            "onnx_path": final_path,
            "deployed_at": datetime.now(timezone.utc).isoformat() if status == "production" else None,
        },
    )
    if not inserted:
        return jsonify({"deployed": False, "error": "Failed to record version"}), 500

    new_id = inserted[0]["id"] if isinstance(inserted, list) else inserted.get("id")

    # Flip previous production to archived.
    if status == "production" and new_id:
        _rest_patch(
            "model_versions",
            {"status": "eq.production", "id": f"neq.{new_id}"},
            {"status": "archived"},
        )

    # Ingest summary metrics from the benchmark payload (client passes the
    # result of /model/upload/benchmark back on deploy). Accuracy may be null
    # if no eval set was available; ingest what we have.
    if new_id and bench:
        payload: dict = {
            "summary": {
                "balanced_acc": bench.get("balanced_acc") or bench.get("accuracy"),
                "macro_f1": bench.get("f1"),
                "p50_latency_ms": bench.get("latency_ms"),
                "last_trained_at": None,
            }
        }
        if isinstance(bench.get("per_class"), list):
            payload["per_class"] = bench["per_class"]
        if isinstance(bench.get("confusion"), dict):
            payload["confusion"] = bench["confusion"]
        ingest_metrics(new_id, payload)

    return jsonify(
        {
            "deployed": True,
            "version": version,
            "status": status,
            "path": final_path,
        }
    )


