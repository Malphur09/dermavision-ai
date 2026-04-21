"""Synthetic-for-now metrics + model-lifecycle endpoints.

Contracts are stable. Implementations return deterministic synthetic values
seeded by class index so UI can swap later without changing callers.
"""
import time

import numpy as np
from flask import Blueprint, jsonify, request

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

MODEL_VERSIONS = [
    {
        "version": "v3.2.1",
        "status": "production",
        "accuracy": 0.913,
        "date": "2026-03-28",
        "architecture": "EfficientNetV2-L + CBAM",
        "params": "119M",
        "notes": "Production model. Balanced augmentation with focal loss.",
    },
    {
        "version": "v3.3.0-rc1",
        "status": "staging",
        "accuracy": 0.921,
        "date": "2026-04-11",
        "architecture": "EfficientNetV2-L + CBAM",
        "params": "120M",
        "notes": "Release candidate. Improved recall on MEL and SCC.",
    },
    {
        "version": "v3.2.0",
        "status": "archived",
        "accuracy": 0.908,
        "date": "2026-02-15",
        "architecture": "EfficientNetV2-L",
        "params": "118M",
        "notes": "Previous baseline.",
    },
    {
        "version": "v3.1.4",
        "status": "archived",
        "accuracy": 0.895,
        "date": "2025-12-04",
        "architecture": "EfficientNetB4",
        "params": "19M",
        "notes": "Lightweight version for edge devices.",
    },
]


@metrics_bp.route("/metrics/summary")
def metrics_summary():
    return jsonify(
        {
            "balanced_acc": 0.913,
            "macro_f1": 0.872,
            "p50_latency_ms": 182,
            "last_trained_at": "2026-03-28T12:00:00Z",
            "synthetic": True,
        }
    )


@metrics_bp.route("/metrics/per_class")
def metrics_per_class():
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
    return jsonify({"classes": out, "synthetic": True})


@metrics_bp.route("/metrics/training_curves")
def metrics_training_curves():
    rng = np.random.default_rng(7)
    epochs = 40
    train_loss = [
        float(round(1.6 * np.exp(-0.08 * e) + rng.normal(0, 0.02), 4))
        for e in range(epochs)
    ]
    val_loss = [
        float(round(1.7 * np.exp(-0.07 * e) + rng.normal(0, 0.03), 4))
        for e in range(epochs)
    ]
    train_acc = [
        float(round(0.55 + (1 - np.exp(-0.09 * e)) * 0.42 + rng.normal(0, 0.005), 4))
        for e in range(epochs)
    ]
    val_acc = [
        float(round(0.52 + (1 - np.exp(-0.08 * e)) * 0.40 + rng.normal(0, 0.008), 4))
        for e in range(epochs)
    ]
    return jsonify(
        {
            "epochs": list(range(1, epochs + 1)),
            "train_loss": train_loss,
            "val_loss": val_loss,
            "train_acc": train_acc,
            "val_acc": val_acc,
            "synthetic": True,
        }
    )


@metrics_bp.route("/metrics/confusion")
def metrics_confusion():
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
    return jsonify({"classes": classes, "matrix": mat, "synthetic": True})


@metrics_bp.route("/metrics/drift")
def metrics_drift():
    rng = np.random.default_rng(11)
    window = 30
    base = np.linspace(0.02, 0.08, window)
    values = [float(round(max(0.0, v + rng.normal(0, 0.01)), 4)) for v in base]
    return jsonify({"window": window, "values": values, "synthetic": True})


@metrics_bp.route("/model/versions")
def model_versions():
    return jsonify({"versions": MODEL_VERSIONS, "synthetic": True})


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
    version = payload.get("version", "v3.3.0-rc1")
    time.sleep(1.0)
    return jsonify({"deployed": True, "version": version, "synthetic": True})
