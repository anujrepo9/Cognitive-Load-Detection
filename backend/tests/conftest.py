"""Shared fixtures for backend API tests.

The test process sets configuration before importing the application so it
never connects to the developer's configured PostgreSQL database.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEST_DIR = Path(tempfile.mkdtemp(prefix="cogniload-tests-"))

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DIR / 'cogniload-test.db'}"
os.environ["MODEL_PATH"] = str(PROJECT_ROOT / "ml" / "saved_models" / "model.joblib")
os.environ["SCALER_PATH"] = str(PROJECT_ROOT / "ml" / "saved_models" / "scaler.joblib")
os.environ["MODEL_META_PATH"] = str(PROJECT_ROOT / "ml" / "saved_models" / "meta.json")
os.environ["LOG_DIR"] = str(TEST_DIR / "logs")
os.environ["LOG_FORMAT"] = "%(levelname)s:%(message)s"
os.environ["WS_ENABLED"] = "false"

sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from database.db import Base, engine  # noqa: E402
from database.models import BehaviorData, Prediction, RefreshToken, Session, User, UserSettings  # noqa: E402,F401
from main import app  # noqa: E402
from routes.auth import login_limiter, register_limiter  # noqa: E402


@pytest.fixture(autouse=True)
def reset_database():
    """Give every test a clean schema and reset in-memory rate limits."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    login_limiter.limiter._hits.clear()
    register_limiter.limiter._hits.clear()
    yield


@pytest.fixture
def client():
    """Create a request client without starting the app lifespan per test."""
    test_client = TestClient(app)
    yield test_client
    test_client.close()


@pytest.fixture
def auth_headers(client):
    response = client.post(
        "/auth/register",
        json={"name": "Test User", "email": "test@example.com", "password": "test-password"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
