from flask import Blueprint, request, jsonify

predict_bp = Blueprint("predict", __name__)

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

@predict_bp.route("/predict", methods=["POST"])
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