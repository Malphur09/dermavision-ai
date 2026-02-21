from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

from routes.predict import predict_bp
from routes.gradcam import gradcam_bp

app.register_blueprint(predict_bp)
app.register_blueprint(gradcam_bp)

@app.route("/health")
def health():
    return {"status": "ok", "model_loaded": False}

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1", port=5000)