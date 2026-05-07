"""Build a deploy-ready benchmark payload from friend's saved predictions.

Reads:
    <dataset>/3way_probs.npz         # int_probs (N,8), int_labels (N,)
    <dataset>/3way_ensemble_results.json  # supplementary summary numbers

Writes a JSON file with the same shape that /api/model/upload/benchmark
returns, so it can be pasted into /api/model/deploy and ingested into
model_metrics → AdminDashboard tiles flip to real values.

Numbers reflect the friend's internal evaluation: 10% stratified holdout
from the training set with 10-view TTA. Use the --notes field on deploy
to document this.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

CLASSES = [
    {"code": "MEL", "full": "Melanoma"},
    {"code": "NV", "full": "Melanocytic Nevus"},
    {"code": "BCC", "full": "Basal Cell Carcinoma"},
    {"code": "AK", "full": "Actinic Keratosis"},
    {"code": "BKL", "full": "Benign Keratosis"},
    {"code": "DF", "full": "Dermatofibroma"},
    {"code": "VASC", "full": "Vascular Lesion"},
    {"code": "SCC", "full": "Squamous Cell Carcinoma"},
]
N_CLASSES = len(CLASSES)


def per_class_prf(cm: np.ndarray) -> list[dict]:
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset_dir", help="Directory containing 3way_probs.npz")
    parser.add_argument("--latency-ms", type=int, default=160, help="Reported p50 latency (default 160)")
    parser.add_argument("--latency-p95-ms", type=int, default=270, help="Reported p95 latency (default 270)")
    parser.add_argument("--out", default="/tmp/bench_imported.json", help="Output benchmark JSON path")

    args = parser.parse_args()

    npz_path = Path(args.dataset_dir) / "3way_probs.npz"
    if not npz_path.is_file():
        print(f"ERROR: {npz_path} not found", file=sys.stderr)
        return 2

    data = np.load(npz_path)
    if "int_probs" not in data or "int_labels" not in data:
        print("ERROR: expected int_probs and int_labels keys in npz", file=sys.stderr)
        return 2

    probs = data["int_probs"]
    labels = data["int_labels"]
    if probs.ndim != 2 or probs.shape[1] != N_CLASSES:
        print(f"ERROR: probs shape {probs.shape} != (*, {N_CLASSES})", file=sys.stderr)
        return 2
    if labels.shape[0] != probs.shape[0]:
        print("ERROR: probs/labels row count mismatch", file=sys.stderr)
        return 2

    preds = np.argmax(probs, axis=1)
    cm = np.zeros((N_CLASSES, N_CLASSES), dtype=np.int64)
    for t, p in zip(labels, preds):
        cm[int(t), int(p)] += 1

    total = int(cm.sum())
    accuracy = float(np.trace(cm) / total)
    pclass = per_class_prf(cm)
    recalls = [c["recall"] for c in pclass if c["support"] > 0]
    f1s = [c["f1"] for c in pclass if c["support"] > 0]
    balanced_acc = float(round(np.mean(recalls), 4)) if recalls else 0.0
    macro_f1 = float(round(np.mean(f1s), 4)) if f1s else 0.0

    benchmark = {
        "accuracy": round(accuracy, 4),
        "balanced_acc": balanced_acc,
        "f1": macro_f1,
        "per_class": pclass,
        "confusion": {
            "classes": [c["code"] for c in CLASSES],
            "matrix": cm.tolist(),
        },
        "eval_total": total,
        "latency_ms": args.latency_ms,
        "latency_p95_ms": args.latency_p95_ms,
        "runs": 0,
        "eval_set_available": True,
        "source": "imported_from_3way_probs.npz",
    }

    Path(args.out).write_text(json.dumps(benchmark, indent=2))
    print(f"Wrote {args.out}")
    print(
        f"\nSummary: accuracy={benchmark['accuracy']} "
        f"balanced_acc={benchmark['balanced_acc']} "
        f"f1={benchmark['f1']} n={total}"
    )
    print("\nPer-class:")
    for r in pclass:
        print(f"  {r['code']:5s} f1={r['f1']:.3f}  P={r['precision']:.3f}  R={r['recall']:.3f}  n={r['support']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
