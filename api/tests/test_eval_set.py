"""Eval-set evaluation: confusion math + missing-manifest fallback."""
from unittest.mock import patch

import numpy as np
import torch

import os
import tempfile

from PIL import Image

from api import eval_set


def test_evaluate_returns_none_when_no_manifest():
    with patch.object(eval_set, "load_manifest", return_value=None):
        assert eval_set.evaluate(model=None) is None


def test_per_class_prf_diagonal_perfect():
    # Diagonal-only confusion matrix → every class has P=R=F1=1.0
    cm = np.diag([10] * eval_set.N_CLASSES).astype(np.int64)
    rows = eval_set._per_class_prf(cm)
    assert len(rows) == eval_set.N_CLASSES
    for r in rows:
        assert r["precision"] == 1.0
        assert r["recall"] == 1.0
        assert r["f1"] == 1.0
        assert r["support"] == 10


def test_parse_isic_ground_truth_drops_unk_rows():
    raw = (
        b"image,MEL,NV,BCC,AK,BKL,DF,VASC,SCC,UNK\n"
        b"ISIC_0000001,0.0,1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0\n"  # NV
        b"ISIC_0000002,1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0\n"  # MEL
        b"ISIC_0000003,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,1.0\n"  # UNK -> dropped
        b"ISIC_0000004,0.0,0.0,0.0,0.0,0.0,0.0,0.0,1.0,0.0\n"  # SCC
    )
    rows = eval_set._parse_isic_ground_truth(raw)
    assert len(rows) == 3
    assert rows[0] == ("ISIC_0000001", 1)  # NV
    assert rows[1] == ("ISIC_0000002", 0)  # MEL
    assert rows[2] == ("ISIC_0000004", 7)  # SCC


def test_detect_and_parse_picks_isic_format():
    isic_raw = b"image,MEL,NV,BCC,AK,BKL,DF,VASC,SCC,UNK\nISIC_x,1.0,0,0,0,0,0,0,0,0\n"
    simple_raw = b"filename,label\nfoo.jpg,Melanoma\n"
    assert eval_set._detect_and_parse(isic_raw)[0][0] == "ISIC_x"
    assert eval_set._detect_and_parse(simple_raw)[0][0] == "foo.jpg"


def test_iter_local_batches_resolves_isic_layout():
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, "images"))
        # ISIC filenames have no extension; loader must probe .jpg.
        Image.new("RGB", (16, 16), color=(0, 0, 0)).save(
            os.path.join(tmp, "images", "ISIC_0000001.jpg"), "JPEG"
        )
        Image.new("RGB", (16, 16), color=(255, 255, 255)).save(
            os.path.join(tmp, "images", "ISIC_0000002.jpg"), "JPEG"
        )
        # Use ISIC's published filename verbatim.
        with open(os.path.join(tmp, "ISIC_2019_Training_GroundTruth.csv"), "wb") as f:
            f.write(
                b"image,MEL,NV,BCC,AK,BKL,DF,VASC,SCC,UNK\n"
                b"ISIC_0000001,0.0,1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0\n"
                b"ISIC_0000002,1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0\n"
            )
        batches = list(eval_set.iter_local_batches(tmp, batch_size=8))
        assert len(batches) == 1
        x, y = batches[0]
        assert x.shape[0] == 2
        assert list(y) == [1, 0]


def test_evaluate_end_to_end_with_stub_model():
    # Tiny synthetic eval set: 2 batches, mix of correct + wrong predictions.
    # Inputs are throwaway tensors; the stub model returns logits we control.

    batches = [
        (torch.zeros(2, 3, 4, 4), np.array([0, 1])),  # truth: MEL, NV
        (torch.zeros(1, 3, 4, 4), np.array([2])),     # truth: BCC
    ]

    # Logits chosen so argmax gives [0, 1] then [3] — last one is wrong (BCC predicted as AK).
    logit_sequence = iter([
        torch.tensor([
            [9.0, 0, 0, 0, 0, 0, 0, 0],
            [0, 9.0, 0, 0, 0, 0, 0, 0],
        ]),
        torch.tensor([[0, 0, 0, 9.0, 0, 0, 0, 0]]),
    ])

    class StubModel:
        def __call__(self, x):
            return next(logit_sequence)

        def eval(self):
            return self

    model = StubModel()

    with patch.object(eval_set, "load_manifest", return_value={"count": 3}), \
         patch.object(eval_set, "iter_eval_batches", return_value=iter(batches)):
        result = eval_set.evaluate(model)

    assert result is not None
    assert result["total"] == 3
    # 2 correct out of 3
    assert abs(result["accuracy"] - (2 / 3)) < 1e-3
    # Confusion: cm[0,0]=1, cm[1,1]=1, cm[2,3]=1
    cm = np.array(result["confusion"]["matrix"])
    assert cm[0, 0] == 1 and cm[1, 1] == 1 and cm[2, 3] == 1
    assert cm.sum() == 3
