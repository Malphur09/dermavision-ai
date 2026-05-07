"""PSI math + window assembly."""
from unittest.mock import patch

from api import drift


def test_psi_zero_when_distributions_identical():
    ref = {"Melanoma": 100, "Melanocytic Nevus": 200, "Basal Cell Carcinoma": 50}
    cur = {"Melanoma": 50, "Melanocytic Nevus": 100, "Basal Cell Carcinoma": 25}
    # Same proportions, half the volume — PSI must be ~0.
    assert drift.psi(ref, cur) < 0.01


def test_psi_grows_when_distribution_skews():
    ref = {"Melanoma": 100, "Melanocytic Nevus": 100}
    cur = {"Melanoma": 200, "Melanocytic Nevus": 5}
    assert drift.psi(ref, cur) > 0.25


def test_psi_handles_empty_inputs():
    assert drift.psi({}, {}) == 0.0
    assert drift.psi({}, {"x": 5}) >= 0.0


def test_band_for_thresholds():
    assert drift.band_for(0.05) == "stable"
    assert drift.band_for(0.15) == "monitor"
    assert drift.band_for(0.30) == "alert"


def test_compute_drift_window_returns_none_without_reference():
    with patch("api.drift._get_metric", return_value=None):
        assert drift.compute_drift_window("v-1") is None


def test_compute_drift_window_assembles_n_days():
    per_class = [
        {"code": "MEL", "full": "Melanoma", "support": 100},
        {"code": "NV", "full": "Melanocytic Nevus", "support": 200},
    ]
    rpc_calls: list[dict] = []

    def fake_rpc(fn, body):
        rpc_calls.append(body)
        # Return matching distribution → PSI ~0
        return {"Melanoma": 1, "Melanocytic Nevus": 2}

    drift.invalidate_cache()
    with patch("api.drift._get_metric", return_value=per_class), \
         patch("api.drift._rpc", side_effect=fake_rpc):
        out = drift.compute_drift_window("v-1", days=5)

    assert out is not None
    assert out["window"] == 5
    assert len(out["values"]) == 5
    assert all(v < 0.01 for v in out["values"])
    assert len(rpc_calls) == 5


def test_compute_drift_window_caches_results():
    per_class = [{"code": "MEL", "full": "Melanoma", "support": 100}]
    rpc_calls: list[dict] = []

    def fake_rpc(fn, body):
        rpc_calls.append(body)
        return {"Melanoma": 1}

    drift.invalidate_cache()
    with patch("api.drift._get_metric", return_value=per_class), \
         patch("api.drift._rpc", side_effect=fake_rpc):
        a = drift.compute_drift_window("v-cache", days=3)
        rpc_count_after_first = len(rpc_calls)
        b = drift.compute_drift_window("v-cache", days=3)

    assert a == b
    # Second call hit cache → no additional RPCs.
    assert len(rpc_calls) == rpc_count_after_first


def test_invalidate_cache_forces_recompute():
    per_class = [{"code": "MEL", "full": "Melanoma", "support": 100}]
    calls = {"n": 0}

    def fake_rpc(fn, body):
        calls["n"] += 1
        return {"Melanoma": 1}

    drift.invalidate_cache()
    with patch("api.drift._get_metric", return_value=per_class), \
         patch("api.drift._rpc", side_effect=fake_rpc):
        drift.compute_drift_window("v-inv", days=2)
        first = calls["n"]
        drift.invalidate_cache()
        drift.compute_drift_window("v-inv", days=2)

    assert calls["n"] > first
