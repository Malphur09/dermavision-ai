"""Thin Supabase HTTP client.

Wraps the bits the Flask backend touches (`/rest/v1`, `/rest/v1/rpc`,
`/storage/v1/object`) with one place to manage timeouts, error swallowing,
and service-role auth. Callers that need to act *as* the user keep using
the bearer token they already have — these helpers are for service-role
operations only.

Return values:
- Reads return `None` on any failure (network, non-2xx, JSON error). Caller
  decides whether to fall back to synthetic data or 500.
- Writes return the response object so the caller can branch on
  `.status_code` if it needs richer handling.
"""
from __future__ import annotations

from typing import Any, Optional

import requests

from api._auth import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, service_headers

DEFAULT_TIMEOUT = 5.0
WRITE_TIMEOUT = 10.0
STORAGE_TIMEOUT = 30.0


def _ready() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


# ---------- /rest/v1/<table> ----------

def rest_get(path: str, params: Optional[dict] = None, timeout: float = DEFAULT_TIMEOUT) -> Any:
    if not _ready():
        return None
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{path}",
            params=params or {},
            headers=service_headers(),
            timeout=timeout,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception:
        return None


def rest_patch(path: str, params: dict, body: dict, timeout: float = DEFAULT_TIMEOUT) -> bool:
    if not _ready():
        return False
    try:
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/{path}",
            params=params,
            json=body,
            headers={**service_headers(), "Prefer": "return=minimal"},
            timeout=timeout,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


def rest_post(path: str, body: Any, *, prefer_minimal: bool = False, timeout: float = WRITE_TIMEOUT) -> Optional[requests.Response]:
    if not _ready():
        return None
    headers = {**service_headers()}
    if prefer_minimal:
        headers["Prefer"] = "return=minimal"
    else:
        headers["Prefer"] = "return=representation"
    try:
        return requests.post(
            f"{SUPABASE_URL}/rest/v1/{path}",
            json=body,
            headers=headers,
            timeout=timeout,
        )
    except Exception:
        return None


def rpc(fn: str, body: Optional[dict] = None, timeout: float = DEFAULT_TIMEOUT) -> Any:
    if not _ready():
        return None
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/{fn}",
            json=body or {},
            headers=service_headers(),
            timeout=timeout,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception:
        return None


# ---------- /storage/v1/object ----------

def storage_get(bucket: str, path: str, timeout: float = STORAGE_TIMEOUT) -> Optional[bytes]:
    if not _ready():
        return None
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=timeout,
        )
        if resp.status_code != 200:
            return None
        return resp.content
    except Exception:
        return None


def storage_upload(
    bucket: str,
    path: str,
    content: bytes,
    content_type: str,
    *,
    upsert: bool = True,
    timeout: float = STORAGE_TIMEOUT,
) -> Optional[requests.Response]:
    if not _ready():
        return None
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": content_type,
    }
    if upsert:
        headers["x-upsert"] = "true"
    try:
        return requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
            headers=headers,
            data=content,
            timeout=timeout,
        )
    except Exception:
        return None


def storage_list(bucket: str, prefix: str = "", limit: int = 1000, timeout: float = STORAGE_TIMEOUT) -> list[dict]:
    if not _ready():
        return []
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
            headers=service_headers(),
            json={"prefix": prefix, "limit": limit},
            timeout=timeout,
        )
        if resp.status_code != 200:
            return []
        return resp.json() or []
    except Exception:
        return []


def storage_remove(bucket: str, paths: list[str], timeout: float = STORAGE_TIMEOUT) -> bool:
    if not _ready() or not paths:
        return False
    try:
        resp = requests.request(
            "DELETE",
            f"{SUPABASE_URL}/storage/v1/object/{bucket}",
            headers=service_headers(),
            json={"prefixes": paths},
            timeout=timeout,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


def storage_sign(bucket: str, path: str, expires_in: int = 3600, timeout: float = STORAGE_TIMEOUT) -> Optional[str]:
    """Return a fully-qualified signed URL (or None)."""
    if not _ready():
        return None
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}",
            headers=service_headers(),
            json={"expiresIn": expires_in},
            timeout=timeout,
        )
        if resp.status_code != 200:
            return None
        signed = (resp.json() or {}).get("signedURL") or ""
        if not signed:
            return None
        return f"{SUPABASE_URL}/storage/v1{signed}" if signed.startswith("/") else signed
    except Exception:
        return None
