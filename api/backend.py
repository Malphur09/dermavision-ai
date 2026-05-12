"""Inference backend selection.

Two backends, picked at load time:

- **TorchBackend** (preferred when it works) — converts ONNX to PyTorch via
  `onnx2torch.convert`. Required for Grad-CAM since `pytorch_grad_cam` needs
  autograd.
- **OrtBackend** (fallback) — runs the ONNX directly via onnxruntime. Some
  graphs (ensembles, ops with dynamic Clip min/max) cannot be converted by
  onnx2torch but ORT handles them natively. Grad-CAM is unavailable in this
  mode; predict + benchmark + eval still work.

Both backends present the same minimal interface as a `torch.nn.Module`
forward call so existing callers (eval_set.evaluate_iter, predict, benchmark)
do not branch on backend type.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
import torch


class OrtBackend:
    """onnxruntime session wrapped to look like a torch nn.Module."""

    def __init__(self, model_bytes: bytes):
        import onnxruntime as ort

        # CPU-only; matches gunicorn worker context.
        self.session = ort.InferenceSession(
            model_bytes,
            providers=["CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name

    def __call__(self, x: torch.Tensor) -> torch.Tensor:
        np_in = x.detach().cpu().numpy().astype(np.float32, copy=False)
        np_out = self.session.run(None, {self.input_name: np_in})[0]
        return torch.from_numpy(np_out)

    def eval(self) -> "OrtBackend":
        return self

    @property
    def supports_gradcam(self) -> bool:
        return False


class TorchBackend:
    """onnx2torch-converted PyTorch module. Supports Grad-CAM."""

    def __init__(self, module: torch.nn.Module):
        self.module = module
        self.module.eval()

    def __call__(self, x: torch.Tensor) -> torch.Tensor:
        return self.module(x)

    def eval(self) -> "TorchBackend":
        self.module.eval()
        return self

    @property
    def supports_gradcam(self) -> bool:
        return True

    @property
    def torch_module(self) -> torch.nn.Module:
        return self.module


def load_inference(model_bytes: bytes, prefer_torch: bool = True) -> OrtBackend | TorchBackend:
    """Load an inference backend from ONNX bytes.

    Tries torch first when `prefer_torch=True` so Grad-CAM works whenever
    the graph is convertible. Falls back to ORT on any conversion failure.
    """
    if prefer_torch:
        try:
            import onnx
            import onnx2torch

            model = onnx.load_from_string(model_bytes)
            return TorchBackend(onnx2torch.convert(model))
        except Exception as e:
            print(f"[INFO] onnx2torch convert failed ({e.__class__.__name__}); using ORT backend.")
    return OrtBackend(model_bytes)


def load_inference_path(model_path: str, prefer_torch: bool = True) -> OrtBackend | TorchBackend:
    with open(model_path, "rb") as f:
        return load_inference(f.read(), prefer_torch=prefer_torch)
