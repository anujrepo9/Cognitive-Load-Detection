"""
Tests for:
  GET /dashboard  — overview metrics with avg_wpm / typing_events / mouse_events
  GET /history    — paginated list + date filters
  GET /reports/daily, GET /reports/weekly, GET /reports/export
  GET /analytics/trends, GET /analytics/features
  GET /recommendation
  GET /model/info
  GET /settings, PUT /settings
"""
from database.db import SessionLocal
from database.models import BehaviorData, Prediction, Session, UserSettings

FEATURES = {
    "typing_wpm": 55, "chars_per_min": 275, "avg_hold_ms": 110, "avg_flight_ms": 75,
    "error_rate": 0.02, "pause_count": 1, "avg_pause_ms": 350, "typing_variance": 0.09,
    "avg_cursor_speed": 200, "movement_distance": 2000, "click_rate": 3.0,
    "double_click_rate": 0.1, "scroll_rate": 2.0, "idle_time_pct": 0.05,
    "avg_hover_ms": 100, "movement_smoothness": 0.85,
}


def _seed(client, auth_headers, n=1):
    """Seed n prediction records through /predict."""
    results = []
    for _ in range(n):
        r = client.post("/predict", headers=auth_headers, json=FEATURES)
        assert r.status_code == 200, r.text
        results.append(r.json())
    return results


# ── Dashboard ─────────────────────────────────────────────────────────────────

def test_dashboard_empty_returns_defaults(client, auth_headers):
    r = client.get("/dashboard", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["sessions_today"] == 0
    assert body["total_predictions"] == 0
    assert body["wpm_trend"] == []
    assert body["feature_importance"] != []   # static list always populated


def test_dashboard_reflects_predictions(client, auth_headers):
    _seed(client, auth_headers, 3)
    r = client.get("/dashboard", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["sessions_today"] >= 1
    assert body["total_predictions"] >= 3
    assert len(body["wpm_trend"]) >= 1
    # New fields populated
    assert body["avg_wpm"] is not None
    assert body["typing_events"] is not None
    assert body["mouse_events"] is not None


# ── History / pagination ───────────────────────────────────────────────────────

def test_history_empty(client, auth_headers):
    r = client.get("/history", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["sessions"] == []
    assert body["total_pages"] == 1


def test_history_paginated(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/history?page=1&per_page=5", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert isinstance(body["sessions"], list)
    sess = body["sessions"][0]
    assert "session_id" in sess
    assert "start_time"  in sess
    assert "avg_load"    in sess


def test_history_date_filter_out_of_range_returns_empty(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/history?from_date=2000-01-01&to_date=2000-01-02", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 0


# ── Reports ───────────────────────────────────────────────────────────────────

def test_reports_daily_empty(client, auth_headers):
    r = client.get("/reports/daily?days=7", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["days"] == []


def test_reports_weekly_empty(client, auth_headers):
    r = client.get("/reports/weekly?weeks=4", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["weeks"] == []


def test_reports_daily_with_data(client, auth_headers):
    _seed(client, auth_headers, 2)
    r = client.get("/reports/daily?days=1", headers=auth_headers)
    assert r.status_code == 200
    days = r.json()["days"]
    assert len(days) >= 1
    assert "sessions" in days[0]
    assert "dominant_load" in days[0]


def test_reports_export_returns_csv(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/reports/export", headers=auth_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    content = r.text
    assert "session_id" in content
    assert "typing_wpm" in content


# ── Analytics ─────────────────────────────────────────────────────────────────

def test_analytics_trends_empty(client, auth_headers):
    r = client.get("/analytics/trends?hours=24", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["points"] == []


def test_analytics_features_empty(client, auth_headers):
    r = client.get("/analytics/features", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_records"] == 0
    assert body["stats"] == []


def test_analytics_trends_with_data(client, auth_headers):
    _seed(client, auth_headers, 2)
    r = client.get("/analytics/trends?hours=24", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 2
    p = body["points"][0]
    assert "load_level"  in p
    assert "confidence"  in p
    assert "timestamp"   in p


def test_analytics_features_with_data(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/analytics/features", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_records"] >= 1
    assert any(s["feature"] == "typing_wpm" for s in body["stats"])


# ── Recommendations ───────────────────────────────────────────────────────────

def test_recommendation_no_history_returns_medium_rules(client, auth_headers):
    r = client.get("/recommendation", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "load_level" in body
    assert len(body["recommendations"]) >= 1
    assert "title" in body["recommendations"][0]
    assert "reason" in body["recommendations"][0]


# ── Model info ────────────────────────────────────────────────────────────────

def test_model_info_structure(client, auth_headers):
    r = client.get("/model/info", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "version" in body
    assert "type"    in body
    assert isinstance(body["version"], str)


# ── Settings ──────────────────────────────────────────────────────────────────

def test_settings_get_returns_defaults(client, auth_headers):
    r = client.get("/settings", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "tracking_enabled"      in body
    assert "flush_interval_sec"    in body
    assert "notifications_enabled" in body
    assert "theme"                 in body


def test_settings_put_persists(client, auth_headers):
    payload = {
        "tracking_enabled":      False,
        "flush_interval_sec":    15,
        "notifications_enabled": False,
        "theme":                 "dark",
    }
    put_r = client.put("/settings", headers=auth_headers, json=payload)
    assert put_r.status_code == 200

    get_r = client.get("/settings", headers=auth_headers)
    body  = get_r.json()
    assert body["tracking_enabled"]   == False
    assert body["flush_interval_sec"] == 15
    assert body["theme"]              == "dark"


def test_settings_invalid_theme_rejected(client, auth_headers):
    r = client.put("/settings", headers=auth_headers, json={
        "tracking_enabled": True, "flush_interval_sec": 5,
        "notifications_enabled": True, "theme": "neon",
    })
    assert r.status_code == 422
