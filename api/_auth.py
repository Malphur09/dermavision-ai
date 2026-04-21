"""Shared auth helpers for admin blueprints."""
import os
from functools import wraps
from typing import Optional

import requests
from flask import jsonify, request

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv(
    "SUPABASE_ANON_KEY"
)
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _bearer_token() -> Optional[str]:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header.removeprefix("Bearer ").strip() or None


def _verify_user(token: str):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
    resp = requests.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {token}",
        },
        timeout=5,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def _check_admin(user_id: str) -> bool:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return False
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/profiles",
        params={"id": f"eq.{user_id}", "select": "role"},
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
        timeout=5,
    )
    if resp.status_code != 200:
        return False
    rows = resp.json()
    return bool(rows) and rows[0].get("role") == "admin"


def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            return (
                jsonify({"error": "Admin API not configured (missing env vars)"}),
                503,
            )
        token = _bearer_token()
        if not token:
            return jsonify({"error": "Missing bearer token"}), 401
        user = _verify_user(token)
        if not user:
            return jsonify({"error": "Invalid token"}), 401
        if not _check_admin(user["id"]):
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)

    return wrapper


def service_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY or ''}",
        "Content-Type": "application/json",
    }
