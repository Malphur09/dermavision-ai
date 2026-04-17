from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import io

import numpy as np
from PIL import Image
import onnxruntime as ort

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

MODEL_PATH = os.getenv("MODEL_PATH", "dermavision_working.onnx")

ort_session = None
try:
    ort_session = ort.InferenceSession(MODEL_PATH)
    _input_name = ort_session.get_inputs()[0].name
except Exception as e:
    print(f"[WARNING] Failed to load ONNX model from {MODEL_PATH}: {e}")
    _input_name = None

_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def preprocess_image(file_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img = img.resize((456, 456), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = (arr - _MEAN) / _STD
    arr = arr.transpose(2, 0, 1)
    return np.expand_dims(arr, axis=0)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": ort_session is not None})


@app.route("/api/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    allowed_types = {"image/jpeg", "image/jpg", "image/png"}
    if file.content_type not in allowed_types:
        return jsonify({"error": "Invalid file type. Only JPEG and PNG are accepted"}), 415

    if ort_session is None:
        return jsonify({"error": "Model not loaded"}), 503

    image_bytes = file.read()
    input_tensor = preprocess_image(image_bytes)

    outputs = ort_session.run(None, {_input_name: input_tensor})
    logits = outputs[0][0]

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

    allowed_types = {"image/jpeg", "image/jpg", "image/png"}
    if file.content_type not in allowed_types:
        return jsonify({"error": "Invalid file type. Only JPEG and PNG are accepted"}), 415

    return jsonify({
        "heatmap": None,
        "message": "Grad-CAM not yet implemented — model pending"
    })


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1", port=5328)
