from database.db import SessionLocal
from database.models import BehaviorData, Prediction, Session


FEATURES = {
    "typing_wpm": 42,
    "chars_per_min": 210,
    "avg_hold_ms": 115,
    "avg_flight_ms": 80,
    "error_rate": 0.03,
    "pause_count": 2,
    "avg_pause_ms": 400,
    "typing_variance": 0.12,
    "avg_cursor_speed": 240,
    "movement_distance": 1800,
    "click_rate": 4.0,
    "double_click_rate": 0.2,
    "scroll_rate": 3.0,
    "idle_time_pct": 0.1,
    "avg_hover_ms": 120,
    "movement_smoothness": 0.8,
}


def test_behavior_requires_auth_and_validates_payload(client, auth_headers):
    assert client.post("/behavior", json=FEATURES).status_code == 401

    invalid = client.post(
        "/behavior",
        headers=auth_headers,
        json={**FEATURES, "typing_wpm": "fast"},
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "validation_error"


def test_behavior_is_stored_in_the_active_session(client, auth_headers):
    response = client.post("/behavior", headers=auth_headers, json=FEATURES)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "stored"

    with SessionLocal() as db:
        assert db.query(Session).count() == 1
        record = db.query(BehaviorData).one()
        assert record.id == body["record_id"]
        assert record.typing_wpm == FEATURES["typing_wpm"]


def test_prediction_persists_linked_behavior_and_prediction(client, auth_headers):
    response = client.post("/predict", headers=auth_headers, json=FEATURES)

    assert response.status_code == 200
    body = response.json()
    assert body["load_level"] in {"low", "medium", "high"}
    assert 0 <= body["confidence"] <= 1
    assert set(body["scores"]) == {"low", "medium", "high"}

    with SessionLocal() as db:
        behavior = db.query(BehaviorData).one()
        prediction = db.query(Prediction).one()
        assert prediction.session_id == body["session_id"]
        assert prediction.behavior_id == behavior.id
