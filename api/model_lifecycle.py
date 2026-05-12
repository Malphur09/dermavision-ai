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
import torch
from flask import Blueprint, jsonify, request

from api._auth import require_admin
from api.metrics import _rest_get, ingest_metrics
from api.supabase import (
    rest_patch as _rest_patch_lib,
    rest_post as _rest_post_lib,
    storage_get,
    storage_upload as _storage_upload_lib,
)
from api import eval_set

model_lifecycle_bp = Blueprint("model_lifecycle", __name__, url_prefix="/api")

BUCKET = "model-uploads"
EXPECTED_OUTPUT_CLASSES = 8
ALLOWED_INPUT_SIZES = (224, 256, 299, 320, 380, 384, 416, 448, 456, 512)
BENCH_RUNS = 20


# ---------- Storage helpers ----------

def _storage_download(path: str) -> Optional[bytes]:
    return storage_get(BUCKET, path, timeout=120)


def _storage_upload(path: str, data: bytes, content_type: str = "application/octet-stream") -> bool:
    resp = _storage_upload_lib(BUCKET, path, data, content_type, timeout=120)
    return bool(resp and resp.status_code in (200, 201))


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
    return _rest_patch_lib(path, params, body)


def _rest_post(path: str, body: Any, prefer: str = "return=representation") -> Optional[Any]:
    resp = _rest_post_lib(path, body, prefer_minimal=(prefer == "return=minimal"))
    if not resp or resp.status_code not in (200, 201):
        return None
    return resp.json() if resp.text else None


# ---------- ONNX helpers ----------

def _input_size(model: onnx.ModelProto) -> Optional[int]:
    """Read square HxW from the model's input shape. Returns None if not square."""
    try:
        in_shape = tuple(
            d.dim_value for d in model.graph.input[0].type.tensor_type.shape.dim
        )
    except Exception:
        return None
    if len(in_shape) != 4 or in_shape[1] != 3:
        return None
    h, w = in_shape[2], in_shape[3]
    if h != w or h <= 0:
        return None
    return h


def _check_shapes(model: onnx.ModelProto) -> Optional[str]:
    """Validate (B, 3, H, H) input + (B, 8) output. Allows dynamic batch.

    H must be one of ALLOWED_INPUT_SIZES so eval+preprocess don't have to
    handle arbitrary resolutions.
    """
    try:
        in_shape = tuple(
            d.dim_value for d in model.graph.input[0].type.tensor_type.shape.dim
        )
        out_shape = tuple(
            d.dim_value for d in model.graph.output[0].type.tensor_type.shape.dim
        )
    except Exception as e:
        return f"Unable to read tensor shapes: {e}"

    if len(in_shape) != 4:
        return f"Input rank {len(in_shape)} (expected 4: NCHW)"
    if in_shape[1] != 3:
        return f"Input channels {in_shape[1]} (expected 3)"
    if in_shape[2] != in_shape[3] or in_shape[2] not in ALLOWED_INPUT_SIZES:
        return (
            f"Input HxW {in_shape[2]}x{in_shape[3]} not in supported sizes "
            f"{ALLOWED_INPUT_SIZES}"
        )

    if len(out_shape) != 2 or out_shape[1] != EXPECTED_OUTPUT_CLASSES:
        return f"Output {out_shape} (expected (*, {EXPECTED_OUTPUT_CLASSES}))"
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

    detected_size = _input_size(model)
    return jsonify(
        {
            "ok": True,
            "path": path,
            "size_mb": round(len(data) / (1024 * 1024), 2),
            "format": "onnx",
            "checks": {
                "structural": True,
                "input_size": detected_size,
                "output_classes": EXPECTED_OUTPUT_CLASSES,
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
        onnx_model = onnx.load_from_string(data)
        size = _input_size(onnx_model) or 384
        from api.backend import load_inference

        model = load_inference(data)
    except Exception as e:
        return jsonify({"error": f"Model conversion failed: {e}"}), 400

    dummy = torch.randn(1, 3, size, size, dtype=torch.float32)
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
        eval_results = eval_set.evaluate(model, input_size=size)
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
        # Reference distribution changed — drop cached PSI windows so the
        # next /api/metrics/drift recomputes against the new per_class support.
        from api.drift import invalidate_cache
        invalidate_cache()

    return jsonify(
        {
            "deployed": True,
            "version": version,
            "status": status,
            "path": final_path,
        }
    )




EDITABLE_FIELDS = {"version", "architecture", "params", "notes"}


@model_lifecycle_bp.route("/model/versions/<version_id>", methods=["PATCH"])
@require_admin
def patch_version(version_id: str):
    """Edit a model_versions row. Admin-gated.

    Whitelisted keys only — status / onnx_path / metrics live elsewhere in the
    lifecycle and should not be hand-edited.
    """
    body = request.get_json(silent=True) or {}
    updates = {k: v for k, v in body.items() if k in EDITABLE_FIELDS}
    if not updates:
        return jsonify({"error": "No editable fields supplied"}), 400
    if "version" in updates and not str(updates["version"]).strip():
        return jsonify({"error": "version cannot be blank"}), 400
    ok = _rest_patch_lib("model_versions", {"id": f"eq.{version_id}"}, updates)
    if not ok:
        return jsonify({"error": "Update failed"}), 502
    return jsonify({"updated": True, "id": version_id, "fields": list(updates.keys())})

