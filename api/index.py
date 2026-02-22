from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

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

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": False})

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

    # TODO: replace with real model inference on March 14th
    placeholder_probs = [0.925, 0.042, 0.018, 0.007, 0.004, 0.002, 0.001, 0.001]
    probabilities = {cls: round(prob, 4) for cls, prob in zip(CLASSES, placeholder_probs)}
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

    # TODO: replace with real Grad-CAM generation on March 14th
    return jsonify({
        "heatmap": None,
        "message": "Grad-CAM not yet implemented — model pending"
    })

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1", port=5328)