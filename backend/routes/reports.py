"""
routes/reports.py — Report endpoints.

  GET /reports/daily   — per-day aggregated stats
  GET /reports/weekly  — per-week aggregated stats
  GET /reports/export  — CSV download of behavior + predictions
"""

import csv
import io
import json
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, BehaviorData, Prediction
from auth.jwt import get_current_user
from api.schemas import DailyReportResponse, DailyReportEntry, WeeklyReportResponse, WeeklyReportEntry

router = APIRouter(prefix="/reports", tags=["reports"])


def _load_distribution(predictions: list) -> dict:
    dist = {"low": 0, "medium": 0, "high": 0}
    for p in predictions:
        dist[p.load_level] = dist.get(p.load_level, 0) + 1
    total = len(predictions) or 1
    return {k: round(v / total, 3) for k, v in dist.items()}


def _dominant_load(predictions: list) -> str | None:
    if not predictions:
        return None
    dist = defaultdict(int)
    for p in predictions:
        dist[p.load_level] += 1
    return max(dist, key=dist.get)


@router.get("/daily", response_model=DailyReportResponse)
def daily_report(
    days: int     = Query(7, ge=1, le=90, description="How many past days to include"),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.start_time >= cutoff)
        .all()
    )

    # Group sessions by calendar date (UTC)
    by_date: dict[str, list[UserSession]] = defaultdict(list)
    for s in sessions:
        dt = s.start_time
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        by_date[dt.strftime("%Y-%m-%d")].append(s)

    entries = []
    for date_str in sorted(by_date.keys(), reverse=True):
        day_sessions = by_date[date_str]
        all_preds = [p for s in day_sessions for p in s.predictions]
        all_behaviors = [
            b for s in day_sessions
            for b in db.query(BehaviorData).filter(BehaviorData.session_id == s.id).all()
        ]
        avg_wpm = (
            sum(b.typing_wpm for b in all_behaviors) / len(all_behaviors)
            if all_behaviors else 0.0
        )
        entries.append(DailyReportEntry(
            date              = date_str,
            sessions          = len(day_sessions),
            predictions       = len(all_preds),
            avg_wpm           = round(avg_wpm, 1),
            dominant_load     = _dominant_load(all_preds),
            load_distribution = _load_distribution(all_preds),
        ))

    return DailyReportResponse(days=entries)


@router.get("/weekly", response_model=WeeklyReportResponse)
def weekly_report(
    weeks: int    = Query(4, ge=1, le=26, description="How many past weeks to include"),
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.start_time >= cutoff)
        .all()
    )

    by_week: dict[str, list[UserSession]] = defaultdict(list)
    for s in sessions:
        dt = s.start_time
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        # ISO week Monday
        monday = (dt - timedelta(days=dt.weekday())).strftime("%Y-%m-%d")
        by_week[monday].append(s)

    entries = []
    for week_start in sorted(by_week.keys(), reverse=True):
        week_sessions = by_week[week_start]
        all_preds = [p for s in week_sessions for p in s.predictions]
        all_behaviors = [
            b for s in week_sessions
            for b in db.query(BehaviorData).filter(BehaviorData.session_id == s.id).all()
        ]
        avg_wpm = (
            sum(b.typing_wpm for b in all_behaviors) / len(all_behaviors)
            if all_behaviors else 0.0
        )
        entries.append(WeeklyReportEntry(
            week_start        = week_start,
            sessions          = len(week_sessions),
            predictions       = len(all_preds),
            avg_wpm           = round(avg_wpm, 1),
            dominant_load     = _dominant_load(all_preds),
            load_distribution = _load_distribution(all_preds),
        ))

    return WeeklyReportResponse(weeks=entries)


@router.get("/export")
def export_csv(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Stream a CSV containing all behavior rows joined with their prediction."""
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(UserSession.start_time.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "session_id", "recorded_at",
        "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
        "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
        "avg_cursor_speed", "movement_distance", "click_rate",
        "double_click_rate", "scroll_rate", "idle_time_pct",
        "avg_hover_ms", "movement_smoothness",
        "load_level", "confidence",
    ])

    for sess in sessions:
        behaviors = (
            db.query(BehaviorData)
            .filter(BehaviorData.session_id == sess.id)
            .order_by(BehaviorData.created_at)
            .all()
        )
        # Build prediction lookup by behavior_id
        preds_by_behavior = {}
        for pred in sess.predictions:
            if pred.behavior_id:
                preds_by_behavior[pred.behavior_id] = pred

        for b in behaviors:
            pred = preds_by_behavior.get(b.id)
            writer.writerow([
                sess.id,
                b.created_at.isoformat() if b.created_at else "",
                b.typing_wpm, b.chars_per_min, b.avg_hold_ms, b.avg_flight_ms,
                b.error_rate, b.pause_count, b.avg_pause_ms, b.typing_variance,
                b.avg_cursor_speed, b.movement_distance, b.click_rate,
                b.double_click_rate, b.scroll_rate, b.idle_time_pct,
                b.avg_hover_ms, b.movement_smoothness,
                pred.load_level if pred else "",
                pred.confidence if pred else "",
            ])

    output.seek(0)
    filename = f"cogniload_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
