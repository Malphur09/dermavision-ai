"""Metrics endpoints: synthetic fallback when no production version exists."""
from unittest.mock import patch


def test_summary_synthetic_when_no_version(metrics_app):
    with patch("api.metrics._active_version", return_value=None), \
         patch("api.metrics._rpc", return_value=None):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/summary")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["synthetic"] is True
    assert {"balanced_acc", "macro_f1", "p50_latency_ms", "last_trained_at"} <= body.keys()


def test_per_class_synthetic(metrics_app):
    with patch("api.metrics._active_version", return_value=None):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/per_class")
    body = resp.get_json()
    assert body["synthetic"] is True
    assert len(body["classes"]) == 8
    for row in body["classes"]:
        assert {"code", "f1", "precision", "recall", "support"} <= row.keys()


def test_training_curves_synthetic(metrics_app):
    with patch("api.metrics._active_version", return_value=None):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/training_curves")
    body = resp.get_json()
    assert body["synthetic"] is True
    assert len(body["epochs"]) == len(body["train_loss"]) == len(body["val_acc"])


def test_confusion_synthetic(metrics_app):
    with patch("api.metrics._active_version", return_value=None):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/confusion")
    body = resp.get_json()
    assert body["synthetic"] is True
    assert len(body["classes"]) == len(body["matrix"]) == 8


def test_drift_synthetic(metrics_app):
    with patch("api.metrics._active_version", return_value=None):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/drift")
    body = resp.get_json()
    assert body["synthetic"] is True
    assert body["window"] == len(body["values"])


def test_summary_real_when_version_present(metrics_app):
    version = {"id": "v-uuid", "deployed_at": "2026-04-01T00:00:00Z"}
    stored = {
        "balanced_acc": 0.91,
        "macro_f1": 0.85,
        "p50_latency_ms": 120,
        "last_trained_at": "2026-04-01T00:00:00Z",
    }
    with patch("api.metrics._active_version", return_value=version), \
         patch("api.metrics._get_metric", return_value=stored), \
         patch("api.metrics._rpc", return_value=None):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/summary")
    body = resp.get_json()
    assert body["synthetic"] is False
    assert body["balanced_acc"] == 0.91


def test_summary_p50_overrides_when_rpc_returns_int(metrics_app):
    with patch("api.metrics._active_version", return_value=None), \
         patch("api.metrics._rpc", return_value=42):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/summary")
    assert resp.get_json()["p50_latency_ms"] == 42


def test_latency_synthetic_when_rpc_returns_none(metrics_app):
    with patch("api.metrics._rpc", return_value=None):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/latency")
    body = resp.get_json()
    assert body["synthetic"] is True
    assert body["p50_ms"] == 0
    assert body["count"] == 0


def test_latency_real_when_rpc_returns_dict(metrics_app):
    payload = {
        "p50_ms": 180,
        "p95_ms": 320,
        "p99_ms": 540,
        "count": 1024,
        "window_days": 7,
        "throughput_per_hr": 6.1,
    }
    with patch("api.metrics._rpc", return_value=payload):
        client = metrics_app.test_client()
        resp = client.get("/api/metrics/latency")
    body = resp.get_json()
    assert body["synthetic"] is False
    assert body["p95_ms"] == 320


def test_ingest_metrics_filters_unknown_keys():
    from api.metrics import ingest_metrics
    captured = {}

    class FakeResp:
        status_code = 201

    def fake_post(path, body, prefer_minimal=False, timeout=None):
        captured["path"] = path
        captured["body"] = body
        return FakeResp()

    with patch("api.metrics.rest_post", side_effect=fake_post):
        ok = ingest_metrics("v-uuid", {
            "summary": {"balanced_acc": 0.9},
            "garbage_key": {"x": 1},
            "per_class": [{"code": "MEL"}],
        })
    assert ok is True
    assert captured["path"] == "model_metrics"
    keys = {row["metric_key"] for row in captured["body"]}
    assert keys == {"summary", "per_class"}
