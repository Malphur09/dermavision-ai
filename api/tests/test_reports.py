"""POST /api/reports/export — JSON path (PDF path needs WeasyPrint, skipped here)."""
from unittest.mock import patch


def test_export_requires_bearer(reports_app):
    client = reports_app.test_client()
    resp = client.post("/api/reports/export", json={"case_id": "c1"})
    assert resp.status_code == 401


def test_export_rejects_missing_case_id(reports_app, user_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}):
        client = reports_app.test_client()
        resp = client.post("/api/reports/export", json={}, headers=user_bearer)
    assert resp.status_code == 400


def test_export_rejects_bad_format(reports_app, user_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}):
        client = reports_app.test_client()
        resp = client.post(
            "/api/reports/export",
            json={"case_id": "c1", "format": "docx"},
            headers=user_bearer,
        )
    assert resp.status_code == 400


def test_export_404_when_case_missing(reports_app, user_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api.reports._fetch_case", return_value=None):
        client = reports_app.test_client()
        resp = client.post(
            "/api/reports/export",
            json={"case_id": "c1", "format": "json"},
            headers=user_bearer,
        )
    assert resp.status_code == 404


def test_export_403_when_case_belongs_to_other_doctor(reports_app, user_bearer):
    case = {"id": "c1", "doctor_id": "other-doc", "predicted_class": "Melanoma"}
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api.reports._fetch_case", return_value=case):
        client = reports_app.test_client()
        resp = client.post(
            "/api/reports/export",
            json={"case_id": "c1", "format": "json"},
            headers=user_bearer,
        )
    assert resp.status_code == 403


def test_export_json_happy_path(reports_app, user_bearer):
    case = {
        "id": "c1",
        "doctor_id": "u1",
        "predicted_class": "Melanoma",
        "confidence": 0.91,
        "probabilities": {"Melanoma": 0.91},
        "patient": {"patient_id": "P-1", "name": "X", "age": 40, "sex": "male"},
    }
    inserted_row = {"id": "r-uuid"}

    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api.reports._fetch_case", return_value=case), \
         patch("api.reports._upload_file", return_value=True), \
         patch("api.reports._insert_report", return_value=inserted_row), \
         patch("api.reports._sign_url", return_value="https://signed.example/url"):
        client = reports_app.test_client()
        resp = client.post(
            "/api/reports/export",
            json={"case_id": "c1", "format": "json", "sections": {}},
            headers=user_bearer,
        )

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["report_id"] == "r-uuid"
    assert body["format"] == "json"
    assert body["signed_url"].startswith("https://")
    assert body["file_url"].startswith("u1/") and body["file_url"].endswith(".json")
