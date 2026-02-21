from PIL import Image
from torchvision import transforms
import torch

# ImageNet normalization values — must match training pipeline
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

def preprocess_image(file) -> torch.Tensor:
    """
    Accepts a file object from request.files and returns
    a normalized image tensor ready for model inference.
    """
    image = Image.open(file).convert("RGB")

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=MEAN, std=STD),
    ])

    tensor = transform(image).unsqueeze(0)  # add batch dimension
    return tensor