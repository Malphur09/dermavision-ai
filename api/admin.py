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
            jsonify({"error": _safe_error(resp, "Invite failed")}),
            resp.status_code,
        )
    return jsonify({"ok": True, "email": email, "role": role})


def _safe_error(resp, fallback):
    try:
        body = resp.json()
    except Exception:
        return fallback
    return body.get("msg") or body.get("error") or body.get("message") or fallback


@admin_bp.route("/reset-mfa", methods=["POST"])
@require_admin
def reset_mfa():
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    # Supabase Admin API: GET /auth/v1/admin/users/{id} returns user with
    # `factors` array inline. There is no /factors subresource on GET.
    user_resp = requests.get(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
        headers=service_headers(),
        timeout=10,
    )
    if user_resp.status_code >= 400:
        return (
            jsonify({"error": _safe_error(user_resp, "User lookup failed")}),
            user_resp.status_code,
        )
    factors = user_resp.json().get("factors") or []

    deleted = 0
    errors = []
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
        else:
            errors.append(_safe_error(d, f"Delete failed for {factor_id}"))

    if errors and deleted == 0:
        return jsonify({"error": errors[0], "errors": errors}), 502
    return jsonify({"ok": True, "deleted": deleted, "total": len(factors), "errors": errors})
