"""Metrics + model-lifecycle endpoints.

Reads from public.model_versions / public.model_metrics / public.inference_telemetry
via the Supabase service-role client. Falls back to deterministic synthetic
values when no metrics are recorded yet (dev env, fresh deploy) so the UI
never breaks.

Contracts are stable — callers do not change when the real metrics pipeline
ingests a training artifact.
"""
import time
from typing import Any, Optional

import numpy as np
import requests
from flask import Blueprint, jsonify, request

from api._auth import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, service_headers

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api")

ISIC_CLASSES = [
    {"code": "MEL", "full": "Melanoma"},
    {"code": "NV", "full": "Melanocytic Nevus"},
    {"code": "BCC", "full": "Basal Cell Carcinoma"},
    {"code": "AK", "full": "Actinic Keratosis"},
    {"code": "BKL", "full": "Benign Keratosis"},
    {"code": "DF", "full": "Dermatofibroma"},
    {"code": "VASC", "full": "Vascular Lesion"},
    {"code": "SCC", "full": "Squamous Cell Carcinoma"},
]


# ---------- Supabase helpers ----------

def _rest_get(path: str, params: Optional[dict] = None) -> Any:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{path}",
            params=params or {},
            headers=service_headers(),
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception:
        return None


def _rpc(fn: str, body: Optional[dict] = None) -> Any:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/{fn}",
            json=body or {},
            headers=service_headers(),
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception:
        return None


def _active_version() -> Optional[dict]:
    rows = _rest_get(
        "model_versions",
        {"status": "eq.production", "select": "*", "limit": "1"},
    )
    if not rows:
        return None
    return rows[0]


def _get_metric(version_id: str, key: str) -> Any:
    rows = _rest_get(
        "model_metrics",
        {
            "version_id": f"eq.{version_id}",
            "metric_key": f"eq.{key}",
            "select": "metric_value,captured_at",
            "order": "captured_at.desc",
            "limit": "1",
        },
    )
    if not rows:
        return None
    return rows[0].get("metric_value")


# ---------- Synthetic fallbacks ----------

def _synthetic_summary():
    return {
        "balanced_acc": 0.913,
        "macro_f1": 0.872,
        "p50_latency_ms": 182,
        "last_trained_at": "2026-03-28T12:00:00Z",
    }


def _synthetic_per_class():
    rng = np.random.default_rng(42)
    out = []
    for i, cls in enumerate(ISIC_CLASSES):
        base = 0.78 + (i * 0.017 % 0.15)
        f1 = float(np.clip(base + rng.normal(0, 0.01), 0.55, 0.97))
        precision = float(np.clip(f1 + rng.normal(0, 0.02), 0.55, 0.97))
        recall = float(np.clip(f1 + rng.normal(0, 0.02), 0.55, 0.97))
        support = int(300 + (i * 53) % 400)
        out.append(
            {
                "code": cls["code"],
                "full": cls["full"],
                "f1": round(f1, 3),
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "support": support,
            }
        )
    return out


def _synthetic_training_curves():
    rng = np.random.default_rng(7)
    epochs = 40
    return {
        "epochs": list(range(1, epochs + 1)),
        "train_loss": [
            float(round(1.6 * np.exp(-0.08 * e) + rng.normal(0, 0.02), 4))
            for e in range(epochs)
        ],
        "val_loss": [
            float(round(1.7 * np.exp(-0.07 * e) + rng.normal(0, 0.03), 4))
            for e in range(epochs)
        ],
        "train_acc": [
            float(round(0.55 + (1 - np.exp(-0.09 * e)) * 0.42 + rng.normal(0, 0.005), 4))
            for e in range(epochs)
        ],
        "val_acc": [
            float(round(0.52 + (1 - np.exp(-0.08 * e)) * 0.40 + rng.normal(0, 0.008), 4))
            for e in range(epochs)
        ],
    }


def _synthetic_confusion():
    classes = [c["code"] for c in ISIC_CLASSES]
    mat = []
    for i in range(len(classes)):
        row = []
        for j in range(len(classes)):
            if i == j:
                row.append(80 + ((i * 13) % 15))
            else:
                off = abs(i - j)
                row.append(max(0, 8 - off * 2 + ((i + j) % 4)))
        mat.append(row)
    return {"classes": classes, "matrix": mat}


def _synthetic_drift():
    rng = np.random.default_rng(11)
    window = 30
    base = np.linspace(0.02, 0.08, window)
    values = [float(round(max(0.0, v + rng.normal(0, 0.01)), 4)) for v in base]
    return {"window": window, "values": values}


# ---------- Endpoints ----------

@metrics_bp.route("/metrics/summary")
def metrics_summary():
    version = _active_version()
    stored = _get_metric(version["id"], "summary") if version else None
    p50 = _rpc("latency_p50", {"window_days": 7})

    if stored is None:
        payload = {**_synthetic_summary(), "synthetic": True}
    else:
        payload = {
            "balanced_acc": stored.get("balanced_acc"),
            "macro_f1": stored.get("macro_f1"),
            "last_trained_at": stored.get("last_trained_at")
            or (version.get("deployed_at") if version else None),
            "p50_latency_ms": stored.get("p50_latency_ms", 0),
            "synthetic": False,
        }

    if isinstance(p50, int):
        payload["p50_latency_ms"] = p50

    return jsonify(payload)


@metrics_bp.route("/metrics/per_class")
def metrics_per_class():
    version = _active_version()
    if version:
        stored = _get_metric(version["id"], "per_class")
        if stored and isinstance(stored, list):
            return jsonify({"classes": stored, "synthetic": False})
    return jsonify({"classes": _synthetic_per_class(), "synthetic": True})


@metrics_bp.route("/metrics/training_curves")
def metrics_training_curves():
    version = _active_version()
    if version:
        stored = _get_metric(version["id"], "training_curves")
        if stored and isinstance(stored, dict):
            return jsonify({**stored, "synthetic": False})
    return jsonify({**_synthetic_training_curves(), "synthetic": True})


@metrics_bp.route("/metrics/confusion")
def metrics_confusion():
    version = _active_version()
    if version:
        stored = _get_metric(version["id"], "confusion")
        if stored and isinstance(stored, dict):
            return jsonify({**stored, "synthetic": False})
    return jsonify({**_synthetic_confusion(), "synthetic": True})


@metrics_bp.route("/metrics/drift")
def metrics_drift():
    version = _active_version()
    if version:
        stored = _get_metric(version["id"], "drift")
        if stored and isinstance(stored, dict):
            return jsonify({**stored, "synthetic": False})
    return jsonify({**_synthetic_drift(), "synthetic": True})


@metrics_bp.route("/model/versions")
def model_versions():
    rows = _rest_get(
        "model_versions",
        {
            "select": "version,status,architecture,params,notes,deployed_at,created_at",
            "order": "created_at.desc",
        },
    )
    if rows is None:
        return jsonify(
            {
                "versions": [
                    {
                        "version": "v1.0",
                        "status": "production",
                        "architecture": "EfficientNetB4",
                        "params": "19M",
                        "notes": "Initial production model.",
                        "date": "2026-03-28",
                        "accuracy": None,
                    }
                ],
                "synthetic": True,
            }
        )

    out = [
        {
            "version": r.get("version"),
            "status": r.get("status"),
            "architecture": r.get("architecture"),
            "params": r.get("params"),
            "notes": r.get("notes"),
            "date": (r.get("deployed_at") or r.get("created_at") or "")[:10],
            "accuracy": None,
        }
        for r in rows
    ]
    return jsonify({"versions": out, "synthetic": False})


# ---------- Model upload/deploy stubs (P1b will replace) ----------

@metrics_bp.route("/model/upload/validate", methods=["POST"])
def model_upload_validate():
    filename = ""
    if request.files:
        f = next(iter(request.files.values()))
        filename = f.filename or ""
    else:
        payload = request.get_json(silent=True) or {}
        filename = payload.get("filename", "")
    time.sleep(1.4)
    lower = filename.lower()
    if not (lower.endswith(".onnx") or lower.endswith(".pt")):
        return (
            jsonify({"ok": False, "error": "Only .onnx or .pt accepted"}),
            400,
        )
    return jsonify({"ok": True, "filename": filename, "synthetic": True})


@metrics_bp.route("/model/upload/benchmark", methods=["POST"])
def model_upload_benchmark():
    time.sleep(3.0)
    return jsonify(
        {
            "accuracy": 0.918,
            "f1": 0.879,
            "latency_ms": 174,
            "synthetic": True,
        }
    )


@metrics_bp.route("/model/deploy", methods=["POST"])
def model_deploy():
    payload = request.get_json(silent=True) or {}
    version = payload.get("version", "v1.0")
    time.sleep(1.0)
    return jsonify({"deployed": True, "version": version, "synthetic": True})


# ---------- Helpers for P1b / telemetry path ----------

def ingest_metrics(version_id: str, metrics_json: dict) -> bool:
    """Insert metric rows for a given model version.

    Called by /api/model/deploy once P1b lands. metrics_json shape:
        {
            "summary": { balanced_acc, macro_f1, last_trained_at, ... },
            "per_class": [ {code, full, f1, precision, recall, support}, ... ],
            "training_curves": { epochs, train_loss, val_loss, train_acc, val_acc },
            "confusion": { classes, matrix },
            "drift": { window, values }
        }
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return False
    rows = [
        {"version_id": version_id, "metric_key": k, "metric_value": v}
        for k, v in metrics_json.items()
        if k in ("summary", "per_class", "training_curves", "confusion", "drift")
    ]
    if not rows:
        return True
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/model_metrics",
            json=rows,
            headers={**service_headers(), "Prefer": "return=minimal"},
            timeout=10,
        )
        return resp.status_code in (200, 201, 204)
    except Exception:
        return False


def insert_telemetry(case_id: Optional[str], latency_ms: int) -> None:
    """Non-blocking insert into inference_telemetry. Never raises."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return
    version = _active_version()
    body = {
        "case_id": case_id,
        "version_id": version["id"] if version else None,
        "latency_ms": int(max(0, latency_ms)),
    }
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/inference_telemetry",
            json=body,
            headers={**service_headers(), "Prefer": "return=minimal"},
            timeout=2,
        )
    except Exception:
        pass
