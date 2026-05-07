"""POST /api/auth/change-password — proxy to Supabase /auth/v1/user."""
from unittest.mock import patch


class _Resp:
    def __init__(self, status, body=None):
        self.status_code = status
        self._body = body or {}

    def json(self):
        return self._body


def test_change_password_requires_bearer(auth_app):
    client = auth_app.test_client()
    resp = client.post("/api/auth/change-password", json={"password": "newpass1234"})
    assert resp.status_code == 401


def test_change_password_rejects_short(auth_app, user_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}):
        client = auth_app.test_client()
        resp = client.post(
            "/api/auth/change-password",
            json={"password": "short"},
            headers=user_bearer,
        )
    assert resp.status_code == 400


def test_change_password_forwards_to_supabase(auth_app, user_bearer):
    captured = {}

    def fake_put(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return _Resp(200, {"id": "u1"})

    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api.auth.requests.put", side_effect=fake_put):
        client = auth_app.test_client()
        resp = client.post(
            "/api/auth/change-password",
            json={"password": "longenough123"},
            headers=user_bearer,
        )
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}
    assert captured["url"].endswith("/auth/v1/user")
    assert captured["headers"]["Authorization"] == "Bearer user-jwt"
    assert captured["json"] == {"password": "longenough123"}


def test_change_password_propagates_supabase_error(auth_app, user_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api.auth.requests.put", return_value=_Resp(422, {"msg": "weak password"})):
        client = auth_app.test_client()
        resp = client.post(
            "/api/auth/change-password",
            json={"password": "longenough123"},
            headers=user_bearer,
        )
    assert resp.status_code == 422
    assert resp.get_json()["error"] == "weak password"
