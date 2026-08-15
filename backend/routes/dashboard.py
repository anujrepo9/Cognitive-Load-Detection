"""
routes/dashboard.py — Dashboard + History endpoints.

  GET /dashboard — overview stats
  GET /history   — paginated session history with date filtering
"""

import math
from datetime import datetime, timezone, timedelta
from collections import Counter
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from database.db import get_db
from database.models import User, Session as UserSession, BehaviorData, Prediction
from auth.jwt import get_current_user
from api.schemas import (
    DashboardResponse, HistoryResponse, HistoryResponsePaginated, SessionOut
)

router = APIRouter(tags=["dashboard"])

FEATURE_IMPORTANCE = [
    {"feature": "error_rate",          "importance": 0.21},
    {"feature": "typing_wpm",          "importance": 0.18},
    {"feature": "idle_time_pct",       "importance": 0.15},
    {"feature": "pause_count",         "importance": 0.12},
    {"feature": "avg_hold_ms",         "importance": 0.10},
    {"feature": "movement_smoothness", "importance": 0.09},
    {"feature": "avg_cursor_speed",    "importance": 0.08},
    {"feature": "typing_variance",     "importance": 0.07},
]


def _session_out(s: UserSession) -> SessionOut:
    preds      = s.predictions
    label_dist = Counter(p.load_level for p in preds)
    avg_load   = label_dist.most_common(1)[0][0] if label_dist else None

    duration = None
    if s.end_time and s.start_time:
        secs     = int((s.end_time - s.start_time).total_seconds())
        duration = f"{secs // 60}m {secs % 60}s"

    return SessionOut(
        session_id       = s.id,
        start_time       = s.start_time,
        end_time         = s.end_time,
        duration         = duration,
        avg_load         = avg_load,
        prediction_count = len(preds),
    )


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    sessions_today = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id,
                UserSession.start_time >= today_start)
        .count()
    )

    all_preds = (
        db.query(Prediction)
        .join(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(Prediction.created_at.desc())
        .limit(200)
        .all()
    )

    label_dist = Counter(p.load_level for p in all_preds)
    avg_load   = label_dist.most_common(1)[0][0] if label_dist else "—"

    # WPM trend — last 20 behavior records (use created_at, not timestamp)
    recent_behavior = (
        db.query(BehaviorData)
        .join(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(BehaviorData.created_at.desc())
        .limit(20)
        .all()
    )
    wpm_trend = [
        {"time": b.created_at.strftime("%H:%M:%S") if b.created_at else "", "wpm": b.typing_wpm}
        for b in reversed(recent_behavior)
    ]

    # Aggregate metrics across the recent behavior window
    wpm_values     = [b.typing_wpm for b in recent_behavior if b.typing_wpm]
    avg_wpm        = round(sum(wpm_values) / len(wpm_values), 1) if wpm_values else None
    # chars_per_min approximates typing events; use as a proxy for key count
    typing_events  = sum(b.chars_per_min for b in recent_behavior) or None
    # click_rate (clicks/min) × records gives a rough mouse-event count
    mouse_events   = round(sum(b.click_rate for b in recent_behavior)) or None

    return DashboardResponse(
        sessions_today    = sessions_today,
        avg_load          = avg_load,
        total_predictions = len(all_preds),
        label_distribution= dict(label_dist),
        wpm_trend         = wpm_trend,
        feature_importance= FEATURE_IMPORTANCE,
        avg_wpm           = avg_wpm,
        typing_events     = typing_events,
        mouse_events      = mouse_events,
    )


@router.get("/history", response_model=HistoryResponsePaginated)
def history(
    page:     int            = Query(1,  ge=1),
    per_page: int            = Query(10, ge=1, le=100),
    from_date: Optional[str] = Query(None, description="ISO date e.g. 2025-01-01"),
    to_date:   Optional[str] = Query(None, description="ISO date e.g. 2025-12-31"),
    db:       Session        = Depends(get_db),
    user:     User           = Depends(get_current_user),
):
    query = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
    )

    if from_date:
        try:
            dt_from = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc)
            query   = query.filter(UserSession.start_time >= dt_from)
        except ValueError:
            pass

    if to_date:
        try:
            dt_to = datetime.fromisoformat(to_date).replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            query = query.filter(UserSession.start_time <= dt_to)
        except ValueError:
            pass

    total       = query.count()
    total_pages = max(1, math.ceil(total / per_page))
    sessions    = (
        query
        .order_by(UserSession.start_time.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return HistoryResponsePaginated(
        sessions    = [_session_out(s) for s in sessions],
        total       = total,
        page        = page,
        per_page    = per_page,
        total_pages = total_pages,
    )
