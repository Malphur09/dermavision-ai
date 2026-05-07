"""Model lifecycle: validate input shape, deploy ingests metrics row."""
from unittest.mock import patch

import onnx
from onnx import TensorProto, helper


def _build_onnx(in_shape, out_shape) -> bytes:
    """Build a trivial ONNX model with the requested input/output shapes."""
    x = helper.make_tensor_value_info("input", TensorProto.FLOAT, list(in_shape))
    y = helper.make_tensor_value_info("output", TensorProto.FLOAT, list(out_shape))
    node = helper.make_node("Identity", inputs=["input"], outputs=["output"])
    graph = helper.make_graph([node], "test-graph", [x], [y])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    model.ir_version = 7
    return model.SerializeToString()


def test_validate_requires_bearer(lifecycle_app):
    client = lifecycle_app.test_client()
    resp = client.post("/api/model/upload/validate", json={"path": "x.onnx"})
    assert resp.status_code == 401


def test_validate_rejects_missing_path(lifecycle_app, admin_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True):
        client = lifecycle_app.test_client()
        resp = client.post("/api/model/upload/validate", json={}, headers=admin_bearer)
    assert resp.status_code == 400


def test_validate_rejects_bad_extension(lifecycle_app, admin_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True):
        client = lifecycle_app.test_client()
        resp = client.post(
            "/api/model/upload/validate",
            json={"path": "model.bin"},
            headers=admin_bearer,
        )
    assert resp.status_code == 400


def test_validate_rejects_wrong_shape(lifecycle_app, admin_bearer):
    bad = _build_onnx((1, 3, 200, 200), (1, 8))  # 200 not in ALLOWED_INPUT_SIZES
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True), \
         patch("api.model_lifecycle._storage_download", return_value=bad):
        client = lifecycle_app.test_client()
        resp = client.post(
            "/api/model/upload/validate",
            json={"path": "wrong.onnx"},
            headers=admin_bearer,
        )
    assert resp.status_code == 400
    msg = resp.get_json()["error"].lower()
    assert "input" in msg or "shape" in msg


def test_validate_accepts_correct_shape(lifecycle_app, admin_bearer):
    good = _build_onnx((1, 3, 384, 384), (1, 8))
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True), \
         patch("api.model_lifecycle._storage_download", return_value=good):
        client = lifecycle_app.test_client()
        resp = client.post(
            "/api/model/upload/validate",
            json={"path": "good.onnx"},
            headers=admin_bearer,
        )
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["ok"] is True
    assert body["format"] == "onnx"


def test_deploy_inserts_version_and_ingests(lifecycle_app, admin_bearer):
    inserted = {}

    def fake_post(path, body, prefer="return=representation"):
        inserted["path"] = path
        inserted["body"] = body
        return [{"id": "v-uuid"}]

    ingest_called = {}

    def fake_ingest(version_id, payload):
        ingest_called["version_id"] = version_id
        ingest_called["payload"] = payload
        return True

    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True), \
         patch("api.model_lifecycle._rest_get", return_value=None), \
         patch("api.model_lifecycle._rest_post", side_effect=fake_post), \
         patch("api.model_lifecycle._rest_patch", return_value=True), \
         patch("api.model_lifecycle._storage_copy", return_value=True), \
         patch("api.model_lifecycle.ingest_metrics", side_effect=fake_ingest):
        client = lifecycle_app.test_client()
        resp = client.post(
            "/api/model/deploy",
            json={
                "path": "uploads/v2.onnx",
                "version": "v2.0",
                "target": "staging",
                "benchmark": {"accuracy": None, "f1": None, "latency_ms": 120},
            },
            headers=admin_bearer,
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["deployed"] is True
    assert body["version"] == "v2.0"
    assert inserted["path"] == "model_versions"
    assert ingest_called["version_id"] == "v-uuid"
    assert ingest_called["payload"]["summary"]["p50_latency_ms"] == 120


def test_deploy_rejects_duplicate_version(lifecycle_app, admin_bearer):
    with patch("api._auth._verify_user", return_value={"id": "u1"}), \
         patch("api._auth._check_admin", return_value=True), \
         patch("api.model_lifecycle._rest_get", return_value=[{"id": "existing"}]):
        client = lifecycle_app.test_client()
        resp = client.post(
            "/api/model/deploy",
            json={"path": "uploads/v2.onnx", "version": "v2.0", "target": "staging"},
            headers=admin_bearer,
        )
    assert resp.status_code == 409
