"""Admin endpoints: invite + reset-mfa. Gate verifies caller is role=admin."""
from unittest.mock import patch


class _Resp:
    def __init__(self, status, body=None):
        self.status_code = status
        self._body = body or {}

    def json(self):
        return self._body


def test_invite_requires_bearer(admin_app):
    client = admin_app.test_client()
    resp = client.post("/api/admin/invite", json={"email": "x@y.com"})
    assert resp.status_code == 401


def test_invite_rejects_non_admin(admin_app, admin_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=False):
        client = admin_app.test_client()
        resp = client.post(
            "/api/admin/invite",
            json={"email": "x@y.com"},
            headers=admin_bearer,
        )
    assert resp.status_code == 403


def test_invite_rejects_bad_role(admin_app, admin_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True):
        client = admin_app.test_client()
        resp = client.post(
            "/api/admin/invite",
            json={"email": "x@y.com", "role": "superuser"},
            headers=admin_bearer,
        )
    assert resp.status_code == 400


def test_invite_calls_supabase(admin_app, admin_bearer):
    captured = {}

    def fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return _Resp(200, {})

    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True), \
         patch("api.admin.requests.post", side_effect=fake_post):
        client = admin_app.test_client()
        resp = client.post(
            "/api/admin/invite",
            json={"email": "Doc@Example.com", "role": "doctor"},
            headers=admin_bearer,
        )
    assert resp.status_code == 200
    assert captured["url"].endswith("/auth/v1/invite")
    # Email lowercased.
    assert captured["json"]["email"] == "doc@example.com"
    assert captured["json"]["data"]["role"] == "doctor"


def test_reset_mfa_deletes_all_factors(admin_app, admin_bearer):
    deletes = []

    def fake_get(url, headers, timeout):
        return _Resp(200, {"factors": [{"id": "f1"}, {"id": "f2"}]})

    def fake_delete(url, headers, timeout):
        deletes.append(url)
        return _Resp(200, {})

    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True), \
         patch("api.admin.requests.get", side_effect=fake_get), \
         patch("api.admin.requests.delete", side_effect=fake_delete):
        client = admin_app.test_client()
        resp = client.post(
            "/api/admin/reset-mfa",
            json={"user_id": "uuid-1"},
            headers=admin_bearer,
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["deleted"] == 2
    assert body["total"] == 2
    assert len(deletes) == 2
