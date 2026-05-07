"""Run the model benchmark locally against a filesystem eval set.

Use when the eval set is too large for Supabase storage. Bucket only needs
to hold the .onnx artifact (small). The eval images stay on your machine.

Usage:
    # 1. Run benchmark, print result as JSON:
    python scripts/local_benchmark.py ./eval_set ./model.onnx

    # 2. Run + auto-deploy to a Flask instance:
    python scripts/local_benchmark.py ./eval_set ./model.onnx \\
        --bucket-path uploads/v1.2.onnx \\
        --version v1.2 \\
        --target production \\
        --base-url http://localhost:5328 \\
        --token "$(./scripts/print_admin_jwt.sh)"

Layout of `./eval_set` (either form is auto-detected):

    eval_set/
      labels.csv                          # filename,label  (label = ISIC code or full name)
      images/<filename>

    eval_set/
      ISIC_2019_Training_GroundTruth.csv  # ISIC's one-hot file, used verbatim
      images/<ISIC_*>.jpg                 # filenames without extension are probed (.jpg/.jpeg/.png)

The `UNK` column in the ISIC ground truth is dropped — the production model only
emits 8 classes (MEL, NV, BCC, AK, BKL, DF, VASC, SCC).

The benchmark JSON has the same shape that /api/model/upload/benchmark
returns, so it can be passed verbatim as the `benchmark` field of a
/api/model/deploy call. Deploy then ingests summary + per_class +
confusion into model_metrics, and the AdminDashboard tiles flip from
synthetic to real values for the new active production version.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("eval_dir", help="Local eval-set directory (labels.csv + images/)")
    parser.add_argument("model_path", help="Local .onnx model file")
    parser.add_argument("--bench-runs", type=int, default=20, help="Latency runs (default 20)")
    parser.add_argument("--out", help="Write benchmark JSON to this path (default stdout)")
    parser.add_argument(
        "--images-dir",
        help="Override the images directory (default: <eval_dir>/images). "
        "Use for layouts like ISIC's `ISIC_2019_Test_Input/`.",
    )

    parser.add_argument("--bucket-path", help="Storage path of the same .onnx in model-uploads (required for --deploy)")
    parser.add_argument("--version", help="Version string for deploy (e.g. v1.2)")
    parser.add_argument("--target", default="production", choices=["staging", "canary", "production"])
    parser.add_argument("--architecture", default=None)
    parser.add_argument("--notes", default=None)
    parser.add_argument("--base-url", help="Flask base URL, e.g. http://localhost:5328")
    parser.add_argument("--token", help="Admin Bearer JWT; required with --base-url to deploy")

    args = parser.parse_args()

    import onnx
    import torch

    from api import eval_set
    from api.backend import load_inference

    eval_dir = Path(args.eval_dir)
    model_path = Path(args.model_path)
    images_dir = Path(args.images_dir) if args.images_dir else eval_dir / "images"
    if not images_dir.is_dir():
        print(f"ERROR: images dir not found: {images_dir}", file=sys.stderr)
        return 2
    if not model_path.is_file():
        print(f"ERROR: model not found: {model_path}", file=sys.stderr)
        return 2

    print(f"[1/3] Loading model: {model_path}")
    onnx_model = onnx.load(str(model_path))
    onnx.checker.check_model(onnx_model)
    in_dims = onnx_model.graph.input[0].type.tensor_type.shape.dim
    in_h = in_dims[2].dim_value if len(in_dims) == 4 else 384
    if in_h <= 0:
        in_h = 384
    print(f"      input size: {in_h}x{in_h}")
    with open(model_path, "rb") as f:
        model_bytes = f.read()
    model = load_inference(model_bytes)
    print(f"      backend: {type(model).__name__}")

    print(f"[2/3] Latency benchmark ({args.bench_runs} runs)")
    dummy = torch.randn(1, 3, in_h, in_h)
    latencies: list[float] = []
    with torch.no_grad():
        for _ in range(3):
            _ = model(dummy)
        for _ in range(args.bench_runs):
            t0 = time.perf_counter()
            _ = model(dummy)
            latencies.append((time.perf_counter() - t0) * 1000)
    median_ms = int(statistics.median(latencies))
    p95_ms = int(sorted(latencies)[int(len(latencies) * 0.95) - 1])

    print(f"[3/3] Eval-set: iterating {eval_dir} (images: {images_dir})")
    result = eval_set.evaluate_local(
        model,
        str(eval_dir),
        input_size=in_h,
        images_dir=str(images_dir),
    )
    if result is None:
        print("ERROR: eval iteration produced no batches — labels.csv may be empty or filenames unmatched.", file=sys.stderr)
        return 1

    benchmark = {
        "accuracy": result["accuracy"],
        "balanced_acc": result["balanced_acc"],
        "f1": result["macro_f1"],
        "per_class": result["per_class"],
        "confusion": result["confusion"],
        "eval_total": result["total"],
        "latency_ms": median_ms,
        "latency_p95_ms": p95_ms,
        "runs": args.bench_runs,
        "eval_set_available": True,
    }

    out_text = json.dumps(benchmark, indent=2)
    if args.out:
        Path(args.out).write_text(out_text)
        print(f"\nWrote {args.out}")
    else:
        print("\n=== Benchmark JSON ===")
        print(out_text)

    print(
        f"\nSummary: accuracy={benchmark['accuracy']} "
        f"balanced_acc={benchmark['balanced_acc']} "
        f"f1={benchmark['f1']} "
        f"latency_p50={median_ms}ms latency_p95={p95_ms}ms "
        f"n={result['total']}"
    )

    if args.base_url:
        if not (args.bucket_path and args.version and args.token):
            print("ERROR: --bucket-path, --version, and --token required with --base-url", file=sys.stderr)
            return 2
        deploy_body = {
            "path": args.bucket_path,
            "version": args.version,
            "target": args.target,
            "architecture": args.architecture,
            "notes": args.notes,
            "benchmark": benchmark,
        }
        url = args.base_url.rstrip("/") + "/api/model/deploy"
        print(f"\nDeploying → {url} (target={args.target}, version={args.version})")
        resp = requests.post(
            url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {args.token}",
            },
            json=deploy_body,
            timeout=60,
        )
        print(f"  status={resp.status_code}")
        try:
            print(f"  body={json.dumps(resp.json(), indent=2)}")
        except Exception:
            print(f"  body={resp.text[:400]}")
        if resp.status_code != 200:
            return 1
        print("\nDone — AdminDashboard tiles should now reflect the new model.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
