"""Upload a local eval-set directory to the `model-uploads` Supabase bucket.

Usage:
    python scripts/seed_eval_set.py ./local_eval_dir

Expected local layout:
    local_eval_dir/
      labels.csv          # filename,label  (label = ISIC code or full name)
      images/<filename>   # one entry per row in labels.csv

The script writes `eval-set/manifest.json` last so a benchmark race never
sees a half-provisioned eval set.

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env (or .env).
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

BUCKET = "model-uploads"
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _headers(content_type: str = "application/octet-stream") -> dict:
    return {
        "apikey": SERVICE_KEY or "",
        "Authorization": f"Bearer {SERVICE_KEY or ''}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }


def _upload(path: str, data: bytes, content_type: str) -> bool:
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        data=data,
        headers=_headers(content_type),
        timeout=120,
    )
    return resp.status_code in (200, 201)


def _content_type_for(name: str) -> str:
    n = name.lower()
    if n.endswith(".png"):
        return "image/png"
    if n.endswith(".jpg") or n.endswith(".jpeg"):
        return "image/jpeg"
    return "application/octet-stream"


def main(local_dir: str) -> int:
    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required", file=sys.stderr)
        return 2

    root = Path(local_dir)
    labels_path = root / "labels.csv"
    images_dir = root / "images"
    if not labels_path.is_file() or not images_dir.is_dir():
        print(f"ERROR: expected {labels_path} + {images_dir}", file=sys.stderr)
        return 2

    labels_bytes = labels_path.read_bytes()
    if not _upload("eval-set/labels.csv", labels_bytes, "text/csv"):
        print("ERROR: labels.csv upload failed", file=sys.stderr)
        return 1

    classes_seen: dict[str, int] = {}
    sha = hashlib.sha256()
    sha.update(labels_bytes)
    uploaded = 0

    rows = list(csv.DictReader(labels_bytes.decode("utf-8").splitlines()))
    for row in rows:
        fname = (row.get("filename") or "").strip()
        label = (row.get("label") or "").strip()
        if not fname or not label:
            continue
        src = images_dir / fname
        if not src.is_file():
            print(f"  skip (missing): {fname}")
            continue
        data = src.read_bytes()
        sha.update(data)
        if not _upload(f"eval-set/images/{fname}", data, _content_type_for(fname)):
            print(f"  upload failed: {fname}")
            continue
        classes_seen[label] = classes_seen.get(label, 0) + 1
        uploaded += 1

    if uploaded == 0:
        print("ERROR: no images uploaded — refusing to write manifest", file=sys.stderr)
        return 1

    manifest = {
        "count": uploaded,
        "classes": classes_seen,
        "sha256": sha.hexdigest(),
    }
    if not _upload("eval-set/manifest.json", json.dumps(manifest, indent=2).encode("utf-8"), "application/json"):
        print("ERROR: manifest upload failed", file=sys.stderr)
        return 1

    print(f"Uploaded {uploaded} images across {len(classes_seen)} classes.")
    print(f"Manifest sha256: {manifest['sha256'][:16]}...")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
