"""Seed demo patients + cases with Arabic names and real dermoscopic images.

Layout
------
- Pulls N images from /models/ISIC_2019_Test_Input matching different ISIC
  classes (using /models/ISIC_2019_Test_GroundTruth.csv as label source).
- Uploads each to `dermoscopic-images/{doctor_id}/seed-<uuid>.jpg`.
- Inserts patients (Arabic names) and cases linked to the uploaded images,
  with `predicted_class` matching the ground truth most of the time and
  a realistic `confidence` distribution.

Usage (inside the api container):
    docker compose exec api python scripts/seed_demo_data.py \\
        --doctor 0cb9a841-ede3-40a1-8109-aee34e67353a \\
        --patients 8 --cases 12

Re-running with --clean first wipes prior seed rows for that doctor.
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api._auth import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, service_headers  # noqa: E402

BUCKET = "dermoscopic-images"
HEATMAPS_BUCKET = "heatmaps"
SEED_PREFIX = "seed-"
DATASET_DIR = Path("/models")
IMAGES_DIR = DATASET_DIR / "ISIC_2019_Test_Input"
GROUND_TRUTH = DATASET_DIR / "ISIC_2019_Test_GroundTruth.csv"

from api.classes import CODE_TO_FULL, RISK_LEVEL  # noqa: E402
LESION_SITES = ["back", "arm", "leg", "chest", "shoulder", "abdomen", "face", "scalp", "hand", "foot"]

ARABIC_MALE = [
    "محمد العتيبي", "عبدالله الزهراني", "خالد المطيري", "سعد الحربي",
    "فيصل الشمري", "ناصر الدوسري", "بدر القحطاني", "سلطان الغامدي",
    "ياسر العنزي", "عمر السبيعي", "ماجد الرشيدي", "طارق البلوي",
]
ARABIC_FEMALE = [
    "نورا القحطاني", "سارة الغامدي", "ريم العسيري", "هند المالكي",
    "لينا الخليفي", "مها الجهني", "أمل العمري", "دانة الحارثي",
    "روان الفيفي", "شهد البقمي", "جواهر السهلي", "لطيفة المنصور",
]


def storage_upload(token_path: str, content: bytes, content_type: str, bucket: str = BUCKET) -> None:
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{bucket}/{token_path}",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=content,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"upload failed {resp.status_code}: {resp.text[:200]}")


def storage_list(prefix: str, bucket: str = BUCKET) -> list[dict]:
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
        headers=service_headers(),
        json={"prefix": prefix, "limit": 1000},
        timeout=15,
    )
    if resp.status_code != 200:
        return []
    return resp.json() or []


def storage_remove(paths: list[str], bucket: str = BUCKET) -> None:
    if not paths:
        return
    requests.request(
        "DELETE",
        f"{SUPABASE_URL}/storage/v1/object/{bucket}",
        headers=service_headers(),
        json={"prefixes": paths},
        timeout=30,
    )


def rest_post(table: str, rows: list[dict]) -> list[dict]:
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**service_headers(), "Prefer": "return=representation"},
        json=rows,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"insert {table} failed {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def rest_delete(table: str, params: dict) -> None:
    resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=service_headers(),
        params=params,
        timeout=30,
    )
    if resp.status_code not in (200, 204):
        print(f"[WARN] delete {table} {params} → {resp.status_code}: {resp.text[:200]}")


def load_ground_truth() -> dict[str, str]:
    """Returns map filename_without_ext -> ISIC class code, dropping UNK rows."""
    out: dict[str, str] = {}
    with open(GROUND_TRUTH, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fname = (row.get("image") or "").strip()
            if not fname:
                continue
            for code in CODE_TO_FULL:
                try:
                    if float(row.get(code, 0)) >= 0.5:
                        out[fname] = code
                        break
                except ValueError:
                    continue
    return out


def pick_images(gt: dict[str, str], n: int, rng: random.Random) -> list[tuple[Path, str]]:
    """Pick n images spread across classes, weighted toward common ones."""
    by_class: dict[str, list[str]] = {}
    for fname, code in gt.items():
        by_class.setdefault(code, []).append(fname)
    weights = {"NV": 3, "MEL": 3, "BCC": 2, "BKL": 2, "AK": 1, "SCC": 1, "DF": 1, "VASC": 1}
    bag: list[str] = []
    for code, w in weights.items():
        if code in by_class:
            bag.extend(by_class[code] * w)
    rng.shuffle(bag)
    picks: list[tuple[Path, str]] = []
    seen: set[str] = set()
    for fname in bag:
        if fname in seen:
            continue
        img = IMAGES_DIR / f"{fname}.jpg"
        if not img.is_file():
            continue
        picks.append((img, gt[fname]))
        seen.add(fname)
        if len(picks) >= n:
            break
    return picks


def simulate_prediction(true_code: str, rng: random.Random) -> tuple[str, dict[str, float], float]:
    """Soft-pretend the model predicted this image.

    Hit rate ~75%; near-miss to an adjacent class otherwise. Confidence biased
    toward the chosen class.
    """
    correct = rng.random() < 0.75
    if correct:
        pred_code = true_code
    else:
        others = [c for c in CODE_TO_FULL if c != true_code]
        pred_code = rng.choice(others)
    base = rng.uniform(0.55, 0.97 if correct else 0.7)
    probs = {full: 0.0 for full in CODE_TO_FULL.values()}
    probs[CODE_TO_FULL[pred_code]] = base
    remaining = 1.0 - base
    others = [c for c in CODE_TO_FULL.values() if c != CODE_TO_FULL[pred_code]]
    shares = [rng.random() for _ in others]
    s = sum(shares) or 1.0
    for cls, w in zip(others, shares):
        probs[cls] = (w / s) * remaining
    confidence_pct = round(base * 100, 2)
    return CODE_TO_FULL[pred_code], probs, confidence_pct


def make_patients(n: int, rng: random.Random, doctor_id: str) -> list[dict]:
    male = rng.sample(ARABIC_MALE, k=min(n, len(ARABIC_MALE)))
    female = rng.sample(ARABIC_FEMALE, k=min(n, len(ARABIC_FEMALE)))
    rows: list[dict] = []
    for i in range(n):
        is_male = rng.random() < 0.5
        name = (male.pop() if (is_male and male) else (female.pop() if female else male.pop()))
        if not is_male and not female:
            is_male = True  # exhausted female pool — sample bookkeeping
        rows.append({
            "patient_id": f"SEED-{rng.randint(1000, 9999)}-{i+1:02d}",
            "name": name,
            "age": rng.randint(22, 78),
            "sex": "male" if is_male else "female",
            "created_by": doctor_id,
        })
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--doctor", required=True, help="doctor profile id (uuid)")
    parser.add_argument("--patients", type=int, default=8)
    parser.add_argument("--cases", type=int, default=12)
    parser.add_argument("--clean", action="store_true", help="wipe prior seed rows + images for this doctor first")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--gradcam", action="store_true", help="also generate + upload Grad-CAM overlays via PthBackend")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
        return 2
    if not GROUND_TRUTH.is_file():
        print(f"ERROR: ground truth not found at {GROUND_TRUTH}", file=sys.stderr)
        return 2
    if not IMAGES_DIR.is_dir():
        print(f"ERROR: images dir not found at {IMAGES_DIR}", file=sys.stderr)
        return 2

    rng = random.Random(args.seed)

    if args.clean:
        print(f"[clean] removing prior seed rows + images for doctor {args.doctor}")
        rest_delete("cases", {"doctor_id": f"eq.{args.doctor}", "notes": "like.*SEED*"})
        rest_delete("patients", {"created_by": f"eq.{args.doctor}", "patient_id": "like.SEED-*"})
        for bkt in (BUCKET, HEATMAPS_BUCKET):
            listed = storage_list(f"{args.doctor}/{SEED_PREFIX}", bucket=bkt)
            paths = [f"{args.doctor}/{o['name']}" for o in listed if o.get("name", "").startswith(SEED_PREFIX)]
            if paths:
                storage_remove(paths, bucket=bkt)
                print(f"[clean] removed {len(paths)} objects from {bkt}")

    print("[1/4] Loading ground truth")
    gt = load_ground_truth()
    print(f"      {len(gt)} labeled images available")

    print(f"[2/4] Picking {args.cases} test images")
    picks = pick_images(gt, args.cases, rng)
    if len(picks) < args.cases:
        print(f"WARN: only {len(picks)} images matched, using all of them")

    print(f"[3/4] Creating {args.patients} patients")
    patients = make_patients(args.patients, rng, args.doctor)
    inserted_patients = rest_post("patients", patients)
    print(f"      inserted {len(inserted_patients)}")

    backend = None
    show_cam_on_image = None
    preprocess_bytes = None
    if args.gradcam:
        print("[4/4 pre] Loading PthBackend for Grad-CAM")
        from api.pth_backend import load_pth  # noqa: WPS433
        from api.preprocess import preprocess_bytes as _preprocess_bytes  # noqa: WPS433
        from pytorch_grad_cam.utils.image import show_cam_on_image as _show_cam_on_image  # noqa: WPS433
        from PIL import Image as _Image  # noqa: WPS433
        import io as _io  # noqa: WPS433

        pth_path = os.getenv("PTH_MODEL_PATH", "/models/dermavision_ensemble_3way.pth")
        if not Path(pth_path).is_file():
            print(f"ERROR: PTH model not at {pth_path}", file=sys.stderr)
            return 2
        backend = load_pth(pth_path)
        preprocess_bytes = _preprocess_bytes
        show_cam_on_image = _show_cam_on_image

    print(f"[4/4] Uploading images + inserting {len(picks)} cases")
    cases: list[dict] = []
    now = datetime.now(timezone.utc)
    for i, (img_path, true_code) in enumerate(picks):
        with open(img_path, "rb") as f:
            data = f.read()
        storage_name = f"{SEED_PREFIX}{uuid.uuid4().hex[:12]}.jpg"
        storage_path = f"{args.doctor}/{storage_name}"
        storage_upload(storage_path, data, "image/jpeg")

        heatmap_path: Optional[str] = None
        if backend is not None and preprocess_bytes is not None and show_cam_on_image is not None:
            from PIL import Image as _Image
            import io as _io

            tensor, rgb_float = preprocess_bytes(data, size=384)
            gray = backend.gradcam(tensor)
            overlay = show_cam_on_image(rgb_float, gray, use_rgb=True)
            buf = _io.BytesIO()
            _Image.fromarray(overlay).save(buf, format="PNG")
            heatmap_path = f"{args.doctor}/{SEED_PREFIX}{uuid.uuid4().hex[:12]}.png"
            storage_upload(heatmap_path, buf.getvalue(), "image/png", bucket=HEATMAPS_BUCKET)

        pred_class, probs, conf = simulate_prediction(true_code, rng)
        patient = inserted_patients[i % len(inserted_patients)]
        created_at = now - timedelta(days=rng.randint(0, 28), hours=rng.randint(0, 23))
        cases.append({
            "patient_id": patient["id"],
            "doctor_id": args.doctor,
            "lesion_site": rng.choice(LESION_SITES),
            "image_url": storage_path,
            "gradcam_url": heatmap_path,
            "predicted_class": pred_class,
            "confidence": conf,
            "probabilities": probs,
            "risk_level": RISK_LEVEL.get(pred_class, "Benign"),
            "status": rng.choice(["complete", "reviewed", "pending"]),
            "notes": "[SEED]",
            "created_at": created_at.isoformat(),
        })
        if backend is not None:
            print(f"      [{i+1}/{len(picks)}] image + heatmap uploaded")
    rest_post("cases", cases)
    print(f"      inserted {len(cases)} cases")

    print("\nDone. Sign in as the seeded doctor to see them on /records and /diagnostic.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
