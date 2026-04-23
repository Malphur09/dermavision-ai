"""Authenticated user self-service endpoints.

Proxies to Supabase Auth where the supabase-js browser client has known
`navigator.locks` contention issues with SSR middleware (password change
hangs behind an unresolved auth lock). This bypass forwards the caller's
Bearer token directly from Flask so the browser client is not involved.
"""
import requests
from flask import Blueprint, jsonify, request

from api._auth import SUPABASE_URL, SUPABASE_ANON_KEY, require_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/change-password", methods=["POST"])
@require_user
def change_password():
    payload = request.get_json(silent=True) or {}
    password = payload.get("password") or ""
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    caller = request.environ["caller"]
    token = caller["token"]

    resp = requests.put(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"password": password},
        timeout=10,
    )
    if resp.status_code >= 400:
        body = {}
        try:
            body = resp.json()
        except Exception:
            pass
        msg = (
            body.get("msg")
            or body.get("error_description")
            or body.get("message")
            or "Password change failed"
        )
        return jsonify({"error": msg}), resp.status_code
    return jsonify({"ok": True})
