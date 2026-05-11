"""Canonical ISIC class list shared by every backend surface.

Order is load-bearing: it matches the model's 8-way softmax output. Anything
that does argmax / index lookup must use this ordering.
"""
from __future__ import annotations

from typing import TypedDict

ISIC_CODES = ("MEL", "NV", "BCC", "AK", "BKL", "DF", "VASC", "SCC")

ISIC_FULL = (
    "Melanoma",
    "Melanocytic Nevus",
    "Basal Cell Carcinoma",
    "Actinic Keratosis",
    "Benign Keratosis",
    "Dermatofibroma",
    "Vascular Lesion",
    "Squamous Cell Carcinoma",
)


class IsicClass(TypedDict):
    idx: int
    code: str
    full: str


ISIC_CLASSES: tuple[IsicClass, ...] = tuple(
    {"idx": i, "code": code, "full": full}
    for i, (code, full) in enumerate(zip(ISIC_CODES, ISIC_FULL))
)

CODE_TO_FULL: dict[str, str] = dict(zip(ISIC_CODES, ISIC_FULL))
FULL_TO_CODE: dict[str, str] = {v: k for k, v in CODE_TO_FULL.items()}
LABEL_TO_IDX: dict[str, int] = {
    **{code: i for i, code in enumerate(ISIC_CODES)},
    **{full: i for i, full in enumerate(ISIC_FULL)},
}

RISK_LEVEL: dict[str, str] = {
    "Melanoma": "High Risk",
    "Squamous Cell Carcinoma": "High Risk",
    "Basal Cell Carcinoma": "High Risk",
    "Actinic Keratosis": "Moderate Risk",
    "Melanocytic Nevus": "Benign",
    "Benign Keratosis": "Benign",
    "Dermatofibroma": "Benign",
    "Vascular Lesion": "Benign",
}

N_CLASSES = len(ISIC_CODES)
