"""
routes/app_usage.py — App/software usage tracking endpoints.

  POST /app-usage          — collector posts per-flush app durations
  GET  /app-usage/summary  — frontend fetches aggregated usage stats
  GET  /app-usage/timeline — raw log entries (paginated)
"""

from datetime import datetime, timezone, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from database.db import get_db
from database.models import User, Session as UserSession, AppUsageLog
from auth.jwt import get_current_user
from api.schemas import (
    AppUsageBatchPayload,
    AppUsageSummaryResponse,
    AppUsageSummaryEntry,
    AppUsageOut,
)

router = APIRouter(prefix="/app-usage", tags=["app-usage"])


def _get_or_create_active_session(user: User, db: DBSession) -> UserSession:
    sess = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.end_time.is_(None))
        .order_by(UserSession.start_time.desc())
        .first()
    )
    if not sess:
        sess = UserSession(user_id=user.id)
        db.add(sess)
        db.commit()
        db.refresh(sess)
    return sess


@router.post("", status_code=201)
def ingest_app_usage(
    payload: AppUsageBatchPayload,
    db:      DBSession = Depends(get_db),
    user:    User      = Depends(get_current_user),
):
    """
    Called by the collector once per flush window with per-app foreground durations.
    Inserts one AppUsageLog row per app entry.
    """
    if not payload.usages:
        return {"stored": 0}

    session = _get_or_create_active_session(user, db)
    rows = [
        AppUsageLog(
            user_id      = user.id,
            session_id   = session.id,
            process      = entry.process,
            window_title = entry.window_title,
            duration_sec = entry.duration_sec,
        )
        for entry in payload.usages
        if entry.duration_sec > 0
    ]
    db.add_all(rows)
    db.commit()
    return {"stored": len(rows)}


@router.get("/summary", response_model=AppUsageSummaryResponse)
def app_usage_summary(
    hours: int       = Query(24, ge=1, le=720, description="Lookback window in hours"),
    db:    DBSession = Depends(get_db),
    user:  User      = Depends(get_current_user),
):
    """
    Returns per-app total time and percentage share for the lookback window.
    Used by the frontend dashboard chart.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    logs = (
        db.query(AppUsageLog)
        .filter(
            AppUsageLog.user_id     == user.id,
            AppUsageLog.recorded_at >= cutoff,
        )
        .all()
    )

    # Aggregate by process name
    totals: dict[str, float] = defaultdict(float)
    last_title: dict[str, str] = {}
    for log in logs:
        totals[log.process] += log.duration_sec
        last_title[log.process] = log.window_title or ""

    total_tracked = sum(totals.values())

    apps = [
        AppUsageSummaryEntry(
            process           = proc,
            total_seconds     = round(secs, 1),
            percentage        = round(secs / total_tracked * 100, 1) if total_tracked else 0.0,
            last_window_title = last_title.get(proc, ""),
        )
        for proc, secs in sorted(totals.items(), key=lambda x: x[1], reverse=True)
    ]

    return AppUsageSummaryResponse(
        period_hours  = hours,
        total_tracked = round(total_tracked, 1),
        apps          = apps,
    )


@router.get("/timeline", response_model=list[AppUsageOut])
def app_usage_timeline(
    hours: int       = Query(8, ge=1, le=168),
    limit: int       = Query(200, ge=1, le=1000),
    db:    DBSession = Depends(get_db),
    user:  User      = Depends(get_current_user),
):
    """Raw log entries — useful for a detailed timeline view."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    logs = (
        db.query(AppUsageLog)
        .filter(
            AppUsageLog.user_id     == user.id,
            AppUsageLog.recorded_at >= cutoff,
        )
        .order_by(AppUsageLog.recorded_at.desc())
        .limit(limit)
        .all()
    )

    return [
        AppUsageOut(
            id           = log.id,
            process      = log.process,
            window_title = log.window_title or "",
            duration_sec = log.duration_sec,
            recorded_at  = log.recorded_at.isoformat() if log.recorded_at else "",
        )
        for log in logs
    ]