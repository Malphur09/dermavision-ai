"""Eval-set evaluation: confusion math + missing-manifest fallback."""
from unittest.mock import patch

import numpy as np
import torch

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
