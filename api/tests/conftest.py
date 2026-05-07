"""Shared pytest fixtures.

Each blueprint is mounted on a fresh Flask app so importing api.index (which
boots the ONNX model) is never triggered in tests. Env vars are set before
api modules are imported so the SUPABASE_* constants resolve.
"""
import os
import sys

# Set env vars before importing api.* — module-level constants read these once.
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-test-key")

# Ensure repo root is on sys.path so `api` is importable when running pytest
# from any directory.
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import pytest
from flask import Flask


def _make_app(blueprint):
    app = Flask(__name__)
    app.register_blueprint(blueprint)
    app.config.update(TESTING=True)
    return app


@pytest.fixture
def metrics_app():
    from api.metrics import metrics_bp
    return _make_app(metrics_bp)


@pytest.fixture
def auth_app():
    from api.auth import auth_bp
    return _make_app(auth_bp)


@pytest.fixture
def admin_app():
    from api.admin import admin_bp
    return _make_app(admin_bp)


@pytest.fixture
def reports_app():
    from api.reports import reports_bp
    return _make_app(reports_bp)


@pytest.fixture
def lifecycle_app():
    from api.model_lifecycle import model_lifecycle_bp
    return _make_app(model_lifecycle_bp)


@pytest.fixture
def admin_bearer():
    """Bearer header that the admin gate will accept once requests.get is mocked."""
    return {"Authorization": "Bearer admin-jwt"}


@pytest.fixture
def user_bearer():
    return {"Authorization": "Bearer user-jwt"}
