from datetime import datetime, timezone, timedelta
from collections import Counter
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, BehaviorData, Prediction
from auth.jwt import get_current_user
from api.schemas import (
    DashboardResponse, HistoryResponse, SessionOut
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


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Sessions today
    sessions_today = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id,
                UserSession.start_time >= today_start)
        .count()
    )

    # All predictions for this user
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

    # WPM trend — last 20 behavior records
    recent_behavior = (
        db.query(BehaviorData)
        .join(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(BehaviorData.timestamp.desc())
        .limit(20)
        .all()
    )
    wpm_trend = [
        {"time": b.timestamp.strftime("%H:%M:%S"), "wpm": b.typing_wpm}
        for b in reversed(recent_behavior)
    ]

    return DashboardResponse(
        sessions_today    = sessions_today,
        avg_load          = avg_load,
        total_predictions = len(all_preds),
        label_distribution= dict(label_dist),
        wpm_trend         = wpm_trend,
        feature_importance= FEATURE_IMPORTANCE,
    )


@router.get("/history", response_model=HistoryResponse)
def history(
    limit: int    = Query(20, ge=1, le=100),
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(UserSession.start_time.desc())
        .limit(limit)
        .all()
    )

    out = []
    for s in sessions:
        preds = s.predictions
        label_dist = Counter(p.load_level for p in preds)
        avg_load   = label_dist.most_common(1)[0][0] if label_dist else None

        duration = None
        if s.end_time and s.start_time:
            secs = int((s.end_time - s.start_time).total_seconds())
            duration = f"{secs // 60}m {secs % 60}s"

        out.append(SessionOut(
            session_id       = s.id,
            start_time       = s.start_time,
            end_time         = s.end_time,
            duration         = duration,
            avg_load         = avg_load,
            prediction_count = len(preds),
        ))

    return HistoryResponse(sessions=out)
