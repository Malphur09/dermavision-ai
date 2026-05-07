"""Image preprocessing shared by predict, gradcam, and eval.

Single source of truth for the model input pipeline. Mean/std are
ImageNet-style values matching the EfficientNetB4 ONNX export.
"""
from __future__ import annotations

import io
from typing import Tuple

import numpy as np
import torch
from PIL import Image

INPUT_SIZE = 456
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def preprocess_pil(img: Image.Image) -> Tuple[torch.Tensor, np.ndarray]:
    """Returns (input_tensor[1,3,H,W], rgb_float[H,W,3] in 0..1).

    `rgb_float` is the un-normalized image in 0..1 used by Grad-CAM
    overlay rendering.
    """
    img = img.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    rgb_float = arr.copy()
    arr = (arr - _MEAN) / _STD
    tensor = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)
    return tensor, rgb_float


def preprocess_bytes(data: bytes) -> Tuple[torch.Tensor, np.ndarray]:
    return preprocess_pil(Image.open(io.BytesIO(data)))
