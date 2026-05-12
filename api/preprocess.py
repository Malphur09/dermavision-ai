"""Image preprocessing shared by predict, gradcam, and eval.

Single source of truth for the model input pipeline. Mean/std are
ImageNet-style values; INPUT_SIZE is updated at model-load time to
match the active model's expected square input dim.
"""
from __future__ import annotations

import io
from typing import Optional, Tuple

import numpy as np
import torch
from PIL import Image

# Mutable — updated by api.index._set_active_model based on the loaded
# model's input shape. Default matches the legacy EfficientNetB4 export.
INPUT_SIZE: int = 456
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def set_input_size(size: int) -> None:
    """Called once per model swap so predict / gradcam / eval all agree."""
    global INPUT_SIZE
    INPUT_SIZE = int(size)


def preprocess_pil(img: Image.Image, size: Optional[int] = None) -> Tuple[torch.Tensor, np.ndarray]:
    """Returns (input_tensor[1,3,H,W], rgb_float[H,W,3] in 0..1).

    `size` overrides INPUT_SIZE for callers (e.g. eval) that want to pin
    a specific resolution regardless of the active model.
    """
    target = int(size) if size else INPUT_SIZE
    img = img.convert("RGB").resize((target, target), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    rgb_float = arr.copy()
    arr = (arr - _MEAN) / _STD
    tensor = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)
    return tensor, rgb_float


def preprocess_bytes(data: bytes, size: Optional[int] = None) -> Tuple[torch.Tensor, np.ndarray]:
    return preprocess_pil(Image.open(io.BytesIO(data)), size=size)
