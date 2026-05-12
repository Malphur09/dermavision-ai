"""PyTorch ensemble backend with bespoke Grad-CAM.

Loads `dermavision_ensemble_3way.pth` — a 3-way ensemble of B4 + B4 + ConvNeXt
trained for ISIC dermoscopic classification — and exposes:

- `__call__(tensor) -> softmaxed probs[1, 8]`   (used by predict)
- `gradcam(tensor) -> grayscale_cam[H, W] in [0,1]`  (used by gradcam route)

Grad-CAM hooks the ConvNeXt branch's last stage, which gives cleaner gradient
signal than blending across heterogeneous backbones. Architecture and load
recipe are lifted verbatim from the training repo's `gradcam_service.py` so
the state_dict keys line up exactly.
"""
from __future__ import annotations

import threading
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


BACKBONE_B4 = "tf_efficientnet_b4.ns_jft_in1k"
BACKBONE_CN = "convnext_base.fb_in22k_ft_in1k_384"
IMAGE_SIZE_B4 = 380
IMAGE_SIZE_CN = 384
INPUT_SIZE = 384


class ChannelAttention(nn.Module):
    def __init__(self, channels: int, reduction: int = 16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b, c, _, _ = x.shape
        avg = self.fc(self.avg_pool(x).view(b, c))
        mx = self.fc(self.max_pool(x).view(b, c))
        return x * torch.sigmoid(avg + mx).view(b, c, 1, 1)


class SpatialAttention(nn.Module):
    def __init__(self, kernel_size: int = 7):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=kernel_size // 2, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        return x * torch.sigmoid(self.conv(torch.cat([avg_out, max_out], dim=1)))


class NormedLinear(nn.Module):
    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        self.weight = nn.Parameter(torch.Tensor(in_features, out_features))
        nn.init.xavier_uniform_(self.weight)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return 30.0 * F.normalize(x, dim=1).mm(F.normalize(self.weight, dim=0))


class DermaVision_Run1(nn.Module):
    def __init__(self, num_classes: int = 8, dropout: float = 0.4):
        super().__init__()
        import timm
        self.backbone = timm.create_model(BACKBONE_B4, pretrained=False, num_classes=0, global_pool="")
        with torch.no_grad():
            feat = self.backbone(torch.randn(1, 3, IMAGE_SIZE_B4, IMAGE_SIZE_B4))
            self.feat_dim = feat.shape[1]
        self.channel_att = ChannelAttention(self.feat_dim)
        self.spatial_att = SpatialAttention()
        self.global_pool = nn.AdaptiveAvgPool2d(1)
        self.embed = nn.Sequential(
            nn.LayerNorm(self.feat_dim), nn.Dropout(dropout),
            nn.Linear(self.feat_dim, 512), nn.GELU(),
            nn.LayerNorm(512), nn.Dropout(dropout * 0.5),
            nn.Linear(512, 256), nn.GELU(), nn.LayerNorm(256),
        )
        self.classifier = NormedLinear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.backbone(x)
        x = self.channel_att(x)
        x = self.spatial_att(x)
        x = self.global_pool(x).flatten(1)
        x = self.embed(x)
        return self.classifier(x)


class DermaVision_PlainHead(nn.Module):
    def __init__(self, num_classes: int = 8, backbone_name: str = BACKBONE_B4,
                 image_size: int = 380, dropout: float = 0.35):
        super().__init__()
        import timm
        self.backbone = timm.create_model(backbone_name, pretrained=False, num_classes=0, global_pool="")
        with torch.no_grad():
            feat = self.backbone(torch.randn(1, 3, image_size, image_size))
            self.feat_dim = feat.shape[1]
        self.channel_att = ChannelAttention(self.feat_dim)
        self.spatial_att = SpatialAttention()
        self.global_pool = nn.AdaptiveAvgPool2d(1)
        self.head = nn.Sequential(
            nn.LayerNorm(self.feat_dim), nn.Dropout(dropout),
            nn.Linear(self.feat_dim, 512), nn.GELU(),
            nn.LayerNorm(512), nn.Dropout(dropout * 0.5),
            nn.Linear(512, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.backbone(x)
        x = self.channel_att(x)
        x = self.spatial_att(x)
        x = self.global_pool(x).flatten(1)
        return self.head(x)


class DermaVision3WayEnsemble(nn.Module):
    def __init__(self, m1: nn.Module, m2: nn.Module, m3: nn.Module,
                 w1: float, w2: float, w3: float):
        super().__init__()
        self.model_r1 = m1
        self.model_r2 = m2
        self.model_r3 = m3
        self.register_buffer("w1", torch.tensor(float(w1)))
        self.register_buffer("w2", torch.tensor(float(w2)))
        self.register_buffer("w3", torch.tensor(float(w3)))
        self.image_size_b4 = IMAGE_SIZE_B4
        self.image_size_cn = IMAGE_SIZE_CN
        self.gradcam_target_layer = self.model_r3.backbone.stages[-1]

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x_b4 = F.interpolate(x, size=(self.image_size_b4, self.image_size_b4),
                             mode="bilinear", align_corners=False)
        p1 = F.softmax(self.model_r1(x_b4), dim=1)
        p2 = F.softmax(self.model_r2(x_b4), dim=1)
        p3 = F.softmax(self.model_r3(x), dim=1)
        return self.w1 * p1 + self.w2 * p2 + self.w3 * p3

    def predict_for_gradcam(self, x: torch.Tensor) -> torch.Tensor:
        return self.model_r3(x)


class _GradCAM:
    """Forward/backward hooks on a single target layer; returns normalized CAM."""

    def __init__(self, model: DermaVision3WayEnsemble, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients: Optional[torch.Tensor] = None
        self.activations: Optional[torch.Tensor] = None
        self._fwd = target_layer.register_forward_hook(self._save_activation)
        self._bwd = target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, _m, _i, o):
        self.activations = o.detach()

    def _save_gradient(self, _m, _gi, go):
        self.gradients = go[0].detach()

    def __call__(self, x: torch.Tensor, class_idx: int) -> np.ndarray:
        self.model.zero_grad()
        logits = self.model.predict_for_gradcam(x)
        score = logits[0, class_idx]
        score.backward(retain_graph=True)
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam).squeeze().cpu().numpy()
        if cam.max() > 0:
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        return cam

    def remove_hooks(self) -> None:
        self._fwd.remove()
        self._bwd.remove()


class PthBackend:
    """Native PyTorch ensemble. Both predict and Grad-CAM run through here."""

    supports_gradcam = True

    def __init__(self, path: str):
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        bw = ckpt["blend_weights"]
        m1 = DermaVision_Run1(num_classes=8, dropout=0.4)
        m2 = DermaVision_PlainHead(num_classes=8, backbone_name=BACKBONE_B4,
                                   image_size=IMAGE_SIZE_B4, dropout=0.35)
        m3 = DermaVision_PlainHead(num_classes=8, backbone_name=BACKBONE_CN,
                                   image_size=IMAGE_SIZE_CN, dropout=0.35)
        self.ensemble = DermaVision3WayEnsemble(m1, m2, m3, bw["w1"], bw["w2"], bw["w3"])
        self.ensemble.load_state_dict(ckpt["state_dict"])
        self.ensemble.eval()
        self.target_layer = self.ensemble.gradcam_target_layer
        self._cam_lock = threading.Lock()

    def __call__(self, x: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            return self.ensemble(x)

    def eval(self) -> "PthBackend":
        self.ensemble.eval()
        return self

    def gradcam(self, x: torch.Tensor) -> np.ndarray:
        """Return grayscale CAM[H, W] in [0,1] aligned to the input spatial size."""
        with self._cam_lock:
            cam_obj = _GradCAM(self.ensemble, self.target_layer)
            try:
                with torch.no_grad():
                    probs = self.ensemble(x)[0].cpu().numpy()
                top_idx = int(np.argmax(probs))
                gray = cam_obj(x, top_idx)
            finally:
                cam_obj.remove_hooks()
        H = int(x.shape[-1])
        if gray.shape != (H, H):
            t = torch.from_numpy(gray).unsqueeze(0).unsqueeze(0).float()
            t = F.interpolate(t, size=(H, H), mode="bilinear", align_corners=False)
            gray = t.squeeze().numpy()
        return gray


def load_pth(path: str) -> PthBackend:
    return PthBackend(path)
