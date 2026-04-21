"""Admin operations proxied to Supabase Admin API.

These endpoints require a service-role key that must stay server-side,
so Flask proxies them. Caller JWT is verified and must be role=admin.
"""
import requests
from flask import Blueprint, jsonify, request

from api._auth import (
    SUPABASE_URL,
    require_admin,
    service_headers,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/invite", methods=["POST"])
@require_admin
def invite_user():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role") or "doctor"
    if not email:
        return jsonify({"error": "email is required"}), 400
    if role not in {"doctor", "admin"}:
        return jsonify({"error": "role must be doctor or admin"}), 400

    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/invite",
        headers=service_headers(),
        json={"email": email, "data": {"role": role}},
        timeout=10,
    )
    if resp.status_code >= 400:
        return (
            jsonify({"error": resp.json().get("msg") or "Invite failed"}),
            resp.status_code,
        )
    return jsonify({"ok": True, "email": email, "role": role})


@admin_bp.route("/reset-mfa", methods=["POST"])
@require_admin
def reset_mfa():
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    factors_resp = requests.get(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}/factors",
        headers=service_headers(),
        timeout=10,
    )
    if factors_resp.status_code >= 400:
        return (
            jsonify({"error": factors_resp.json().get("msg") or "Factor lookup failed"}),
            factors_resp.status_code,
        )
    factors = factors_resp.json().get("factors", [])

    deleted = 0
    for f in factors:
        factor_id = f.get("id")
        if not factor_id:
            continue
        d = requests.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}/factors/{factor_id}",
            headers=service_headers(),
            timeout=10,
        )
        if d.status_code < 400:
            deleted += 1

    return jsonify({"ok": True, "deleted": deleted, "total": len(factors)})
