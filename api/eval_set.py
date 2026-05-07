"""Eval-set ingestion + evaluation.

Layout in the `model-uploads` storage bucket:

    eval-set/
      manifest.json     # { count, classes, sha256 }   (presence flag)
      labels.csv        # CSV: filename,label
      images/<file>     # image bytes (jpg/png) for each row

`evaluate(model)` runs the eval set through the converted PyTorch model and
returns balanced accuracy, macro F1, per-class P/R/F1/support, and a
confusion matrix — pure numpy, no sklearn dependency.
"""
from __future__ import annotations

import csv
import io
import json
import time
from typing import Iterator, Optional

import numpy as np
import requests
import torch
from PIL import Image

from api._auth import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

BUCKET = "model-uploads"
MANIFEST_PATH = "eval-set/manifest.json"
LABELS_PATH = "eval-set/labels.csv"
IMAGES_PREFIX = "eval-set/images/"
MANIFEST_TTL_S = 300

# Same order as the model output. Code aliases let labels.csv accept either form.
CLASSES = [
    {"idx": 0, "code": "MEL", "full": "Melanoma"},
    {"idx": 1, "code": "NV", "full": "Melanocytic Nevus"},
    {"idx": 2, "code": "BCC", "full": "Basal Cell Carcinoma"},
    {"idx": 3, "code": "AK", "full": "Actinic Keratosis"},
    {"idx": 4, "code": "BKL", "full": "Benign Keratosis"},
    {"idx": 5, "code": "DF", "full": "Dermatofibroma"},
    {"idx": 6, "code": "VASC", "full": "Vascular Lesion"},
    {"idx": 7, "code": "SCC", "full": "Squamous Cell Carcinoma"},
]
N_CLASSES = len(CLASSES)
_LABEL_TO_IDX = {c["code"]: c["idx"] for c in CLASSES}
_LABEL_TO_IDX.update({c["full"]: c["idx"] for c in CLASSES})

_manifest_cache: dict = {"value": None, "ts": 0.0}


def _storage_get(path: str) -> Optional[bytes]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=60,
        )
        if resp.status_code != 200:
            return None
        return resp.content
    except Exception:
        return None


def load_manifest() -> Optional[dict]:
    """Return the manifest dict if the eval set is provisioned, else None.

    Cached for 5 minutes per worker so a benchmark run does not re-download
    the manifest on every batch.
    """
    now = time.time()
    if _manifest_cache["value"] is not None and now - _manifest_cache["ts"] < MANIFEST_TTL_S:
        return _manifest_cache["value"]
    data = _storage_get(MANIFEST_PATH)
    if data is None:
        return None
    try:
        manifest = json.loads(data.decode("utf-8"))
    except Exception:
        return None
    _manifest_cache["value"] = manifest
    _manifest_cache["ts"] = now
    return manifest


def _load_labels() -> Optional[list[tuple[str, int]]]:
    raw = _storage_get(LABELS_PATH)
    if raw is None:
        return None
    rows: list[tuple[str, int]] = []
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
    for row in reader:
        fname = (row.get("filename") or "").strip()
        label = (row.get("label") or "").strip()
        if not fname or label not in _LABEL_TO_IDX:
            continue
        rows.append((fname, _LABEL_TO_IDX[label]))
    return rows or None


def iter_eval_batches(batch_size: int = 8) -> Iterator[tuple[torch.Tensor, np.ndarray]]:
    """Bucket-backed batches. Reads labels.csv + images/<file> from storage."""
    rows = _load_labels()
    if not rows:
        return
    yield from _batches_from_rows(
        rows,
        load_image=lambda fname: _storage_get(f"{IMAGES_PREFIX}{fname}"),
        batch_size=batch_size,
    )


def iter_local_batches(local_dir: str, batch_size: int = 8) -> Iterator[tuple[torch.Tensor, np.ndarray]]:
    """Filesystem-backed batches. Same layout as bucket: labels.csv + images/<file>."""
    import os

    labels_path = os.path.join(local_dir, "labels.csv")
    images_dir = os.path.join(local_dir, "images")
    if not os.path.isfile(labels_path) or not os.path.isdir(images_dir):
        return
    with open(labels_path, "rb") as f:
        raw = f.read()
    rows: list[tuple[str, int]] = []
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
    for row in reader:
        fname = (row.get("filename") or "").strip()
        label = (row.get("label") or "").strip()
        if not fname or label not in _LABEL_TO_IDX:
            continue
        rows.append((fname, _LABEL_TO_IDX[label]))
    if not rows:
        return

    def _load(fname: str) -> Optional[bytes]:
        p = os.path.join(images_dir, fname)
        if not os.path.isfile(p):
            return None
        with open(p, "rb") as f:
            return f.read()

    yield from _batches_from_rows(rows, load_image=_load, batch_size=batch_size)


def _batches_from_rows(rows, load_image, batch_size: int):
    from api.preprocess import preprocess_pil

    batch_x: list[torch.Tensor] = []
    batch_y: list[int] = []
    for fname, label_idx in rows:
        img_bytes = load_image(fname)
        if img_bytes is None:
            continue
        try:
            tensor, _ = preprocess_pil(Image.open(io.BytesIO(img_bytes)))
        except Exception:
            continue
        batch_x.append(tensor)
        batch_y.append(label_idx)
        if len(batch_x) >= batch_size:
            yield torch.cat(batch_x, dim=0), np.array(batch_y, dtype=np.int64)
            batch_x, batch_y = [], []
    if batch_x:
        yield torch.cat(batch_x, dim=0), np.array(batch_y, dtype=np.int64)


def _per_class_prf(cm: np.ndarray) -> list[dict]:
    """From an NxN confusion matrix (rows=truth, cols=pred), compute per-class P/R/F1/support."""
    out = []
    for i, cls in enumerate(CLASSES):
        tp = int(cm[i, i])
        fp = int(cm[:, i].sum() - tp)
        fn = int(cm[i, :].sum() - tp)
        support = int(cm[i, :].sum())
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        out.append(
            {
                "code": cls["code"],
                "full": cls["full"],
                "precision": round(float(precision), 4),
                "recall": round(float(recall), 4),
                "f1": round(float(f1), 4),
                "support": support,
            }
        )
    return out


def evaluate_iter(model, batches: Iterator[tuple[torch.Tensor, np.ndarray]]) -> Optional[dict]:
    """Run an arbitrary batch iterator through `model` and return metrics.

    Returns None if no batches arrive.
    """
    cm = np.zeros((N_CLASSES, N_CLASSES), dtype=np.int64)
    total = 0

    model.eval()
    with torch.no_grad():
        for x, y in batches:
            logits = model(x).cpu().numpy()
            preds = np.argmax(logits, axis=1)
            for t, p in zip(y, preds):
                cm[int(t), int(p)] += 1
                total += 1

    if total == 0:
        return None

    accuracy = float(np.trace(cm) / total)
    per_class = _per_class_prf(cm)
    recalls = [c["recall"] for c in per_class if c["support"] > 0]
    f1s = [c["f1"] for c in per_class if c["support"] > 0]
    balanced_acc = float(round(np.mean(recalls), 4)) if recalls else 0.0
    macro_f1 = float(round(np.mean(f1s), 4)) if f1s else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "balanced_acc": balanced_acc,
        "macro_f1": macro_f1,
        "per_class": per_class,
        "confusion": {
            "classes": [c["code"] for c in CLASSES],
            "matrix": cm.tolist(),
        },
        "total": total,
    }


def evaluate(model) -> Optional[dict]:
    """Bucket-backed evaluation. Returns None if no manifest is provisioned."""
    if load_manifest() is None:
        return None
    return evaluate_iter(model, iter_eval_batches())


def evaluate_local(model, local_dir: str) -> Optional[dict]:
    """Filesystem-backed evaluation. Use when the eval set is too large for storage."""
    return evaluate_iter(model, iter_local_batches(local_dir))
