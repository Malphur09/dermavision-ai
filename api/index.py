import io
import os
import base64
import threading

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


def _load_model():
    global torch_model, target_layer
    try:
        model = onnx2torch.convert(onnx.load(MODEL_PATH))
        model.eval()
        last_conv = None
        for m in model.modules():
            if isinstance(m, nn.Conv2d):
                last_conv = m
        if last_conv is None:
            raise RuntimeError("No Conv2d found in converted model")
        torch_model = model
        target_layer = last_conv
        print(f"[INFO] Model loaded. Target layer: {last_conv}")
    except Exception as e:
        print(f"[WARNING] Failed to load model from {MODEL_PATH}: {e}")


_load_model()

_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def preprocess_image(file_bytes: bytes):
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img = img.resize((456, 456), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    rgb_float = arr.copy()
    arr = (arr - _MEAN) / _STD
    tensor = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)
    return tensor, rgb_float


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": torch_model is not None})


@app.route("/api/predict", methods=["POST"])
def predict():
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

    with torch.no_grad():
        logits = torch_model(tensor)[0].numpy()

    exp_logits = np.exp(logits - logits.max())
    probs = exp_logits / exp_logits.sum()

    probabilities = {cls: round(float(p), 4) for cls, p in zip(CLASSES, probs)}
    predicted_class = max(probabilities, key=probabilities.get)

    return jsonify({
        "predicted_class": predicted_class,
        "probabilities": probabilities,
    })


@app.route("/api/gradcam", methods=["POST"])
def gradcam():
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
