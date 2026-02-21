from flask import Blueprint, request, jsonify

gradcam_bp = Blueprint("gradcam", __name__)

@gradcam_bp.route("/gradcam", methods=["POST"])
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