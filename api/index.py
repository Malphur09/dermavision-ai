import io
import os
import base64
import threading
import time

import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import onnx
import onnx2torch
from pytorch_grad_cam import GradCAMPlusPlus
from pytorch_grad_cam.utils.image import show_cam_on_image
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

from api.admin import admin_bp  # noqa: E402
from api.metrics import metrics_bp, insert_telemetry  # noqa: E402
from api.auth import auth_bp  # noqa: E402
from api.reports import reports_bp  # noqa: E402
from api.model_lifecycle import model_lifecycle_bp  # noqa: E402
from api.preprocess import preprocess_bytes  # noqa: E402
app.register_blueprint(admin_bp)
app.register_blueprint(metrics_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(model_lifecycle_bp)

CLASSES = [
    "Melanoma",
    "Melanocytic Nevus",
    "Basal Cell Carcinoma",
    "Actinic Keratosis",
    "Benign Keratosis",
    "Dermatofibroma",
    "Vascular Lesion",
    "Squamous Cell Carcinoma",
]

MODEL_PATH = os.getenv("MODEL_PATH", "efficientnetb4_isic2019.onnx")

torch_model: nn.Module | None = None
target_layer: nn.Module | None = None
_cam_lock = threading.Lock()
_model_swap_lock = threading.Lock()

# Lazy version check: every N seconds per worker, consult model_versions for
# the active production row. If its onnx_path differs from what we loaded,
# pull the new artifact from storage and hot-swap. This means multiple
# gunicorn workers reconcile independently without SIGHUP or flag files.
_active_version_id: str | None = None
_active_path: str | None = None
_version_last_checked: float = 0.0
_VERSION_TTL_S: float = 60.0


def _set_active_model(model: nn.Module) -> None:
    global torch_model, target_layer
    last_conv = None
    for m in model.modules():
        if isinstance(m, nn.Conv2d):
            last_conv = m
    if last_conv is None:
        raise RuntimeError("No Conv2d found in converted model")
    with _model_swap_lock:
        torch_model = model
        target_layer = last_conv


def _load_model_from_disk():
    try:
        model = onnx2torch.convert(onnx.load(MODEL_PATH))
        model.eval()
        _set_active_model(model)
        print(f"[INFO] Model loaded from disk: {MODEL_PATH}")
    except Exception as e:
        print(f"[WARNING] Failed to load model from {MODEL_PATH}: {e}")


def _try_reload_from_storage(bucket_path: str) -> bool:
    """Download an ONNX from the model-uploads bucket and swap it in."""
    try:
        from api.model_lifecycle import _storage_download

        data = _storage_download(bucket_path)
        if data is None:
            return False
        model = onnx2torch.convert(onnx.load_from_string(data))
        model.eval()
        _set_active_model(model)
        return True
    except Exception as e:
        print(f"[WARNING] Storage reload failed for {bucket_path}: {e}")
        return False


def _maybe_refresh_model() -> None:
    global _active_version_id, _active_path, _version_last_checked
    now = time.time()
    if now - _version_last_checked < _VERSION_TTL_S:
        return
    _version_last_checked = now
    try:
        from api.metrics import _active_version

        v = _active_version()
        if not v:
            return
        new_id = v.get("id")
        new_path = v.get("onnx_path")
        if _active_version_id is None:
            # First observation — record baseline, do not reload (boot already
            # loaded from disk via MODEL_PATH).
            _active_version_id = new_id
            _active_path = new_path
            return
        if new_id != _active_version_id or new_path != _active_path:
            if new_path and _try_reload_from_storage(new_path):
                _active_version_id = new_id
                _active_path = new_path
                print(f"[INFO] Swapped active model -> {v.get('version')} ({new_path})")
    except Exception as e:
        print(f"[WARNING] Active version check failed: {e}")


_load_model_from_disk()


def preprocess_image(file_bytes: bytes):
    return preprocess_bytes(file_bytes)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": torch_model is not None})


@app.route("/api/predict", methods=["POST"])
def predict():
    _maybe_refresh_model()

    if "file" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if file.content_type not in {"image/jpeg", "image/jpg", "image/png"}:
        return jsonify({"error": "Invalid file type. Only JPEG and PNG are accepted"}), 415

    if torch_model is None:
        return jsonify({"error": "Model not loaded"}), 503

    image_bytes = file.read()
    tensor, _ = preprocess_image(image_bytes)

    t0 = time.perf_counter()
    with torch.no_grad():
        logits = torch_model(tensor)[0].numpy()
    latency_ms = int((time.perf_counter() - t0) * 1000)

    exp_logits = np.exp(logits - logits.max())
    probs = exp_logits / exp_logits.sum()

    probabilities = {cls: round(float(p), 4) for cls, p in zip(CLASSES, probs)}
    predicted_class = max(probabilities, key=probabilities.get)

    case_id = request.form.get("case_id") or None
    threading.Thread(
        target=insert_telemetry,
        args=(case_id, latency_ms),
        daemon=True,
    ).start()

    return jsonify({
        "predicted_class": predicted_class,
        "probabilities": probabilities,
    })


@app.route("/api/gradcam", methods=["POST"])
def gradcam():
    _maybe_refresh_model()

    if "file" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if file.content_type not in {"image/jpeg", "image/jpg", "image/png"}:
        return jsonify({"error": "Invalid file type. Only JPEG and PNG are accepted"}), 415

    if torch_model is None or target_layer is None:
        return jsonify({"heatmap": None, "message": "Model not loaded"}), 200

    try:
        image_bytes = file.read()
        tensor, rgb_float = preprocess_image(image_bytes)

        with _cam_lock:
            cam = GradCAMPlusPlus(model=torch_model, target_layers=[target_layer])
            grayscale_cam = cam(input_tensor=tensor, targets=None)[0]

        overlay = show_cam_on_image(rgb_float, grayscale_cam, use_rgb=True)
        buf = io.BytesIO()
        Image.fromarray(overlay).save(buf, format="PNG")
        data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

        return jsonify({"heatmap": data_url, "message": "ok"})
    except Exception as e:
        print(f"[ERROR] Grad-CAM failed: {e}")
        return jsonify({"heatmap": None, "message": f"Grad-CAM unavailable: {str(e)}"}), 200


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1", port=5328)
