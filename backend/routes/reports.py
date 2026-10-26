"""
routes/reports.py — Report endpoints.

  GET /reports/daily            — per-day aggregated stats
  GET /reports/weekly           — per-week aggregated stats
  GET /reports/export           — CSV download of behavior + predictions
  GET /reports/export-app-usage — CSV download of per-app foreground time
"""

import csv
import io
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, BehaviorData, Prediction, AppUsageLog
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


def _avg_wpm(behaviors: list) -> float:
    """Average typing_wpm, skipping NULL/zero rows (wpm is nullable when data is insufficient)."""
    wpms = [b.typing_wpm for b in behaviors if b.typing_wpm]
    return round(sum(wpms) / len(wpms), 1) if wpms else 0.0


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
        entries.append(DailyReportEntry(
            date              = date_str,
            sessions          = len(day_sessions),
            predictions       = len(all_preds),
            avg_wpm           = _avg_wpm(all_behaviors),
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
        entries.append(WeeklyReportEntry(
            week_start        = week_start,
            sessions          = len(week_sessions),
            predictions       = len(all_preds),
            avg_wpm           = _avg_wpm(all_behaviors),
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
        "avg_hover_ms", "avg_acceleration", "movement_smoothness",
        "load_level", "confidence",
    ])

    for sess in sessions:
        behaviors = (
            db.query(BehaviorData)
            .filter(BehaviorData.session_id == sess.id)
            .order_by(BehaviorData.created_at)
            .all()
        )
        preds_by_behavior = {}
        for pred in sess.predictions:
            if pred.behavior_id:
                preds_by_behavior[pred.behavior_id] = pred

        if not behaviors:
            writer.writerow([
                sess.id,
                sess.start_time.isoformat() if sess.start_time else "",
                "", "", "", "", "", "", "", "",
                "", "", "", "", "", "", "", "", "",
                "", "",
            ])
            continue

        for b in behaviors:
            pred = preds_by_behavior.get(b.id)
            writer.writerow([
                sess.id,
                b.created_at.isoformat() if b.created_at else "",
                b.typing_wpm if b.typing_wpm is not None else "",
                b.chars_per_min, b.avg_hold_ms, b.avg_flight_ms,
                b.error_rate, b.pause_count, b.avg_pause_ms, b.typing_variance,
                b.avg_cursor_speed, b.movement_distance, b.click_rate,
                b.double_click_rate, b.scroll_rate, b.idle_time_pct,
                b.avg_hover_ms, b.avg_acceleration, b.movement_smoothness,
                pred.load_level if pred else "",
                pred.confidence if pred else "",
            ])

    output.seek(0)
    filename = f"cogniload_behavior_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export-app-usage")
def export_app_usage_csv(
    days: int     = Query(30, ge=1, le=365, description="How many past days to export"),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """
    Stream a CSV of per-app foreground time.

    Columns:
        recorded_at   — when this flush window ended (UTC ISO 8601)
        process       — process name (e.g. Code.exe, chrome.exe, steam.exe)
        window_title  — last active window title seen for this process
        duration_sec  — foreground seconds in this flush window
        duration_min  — same value in minutes (rounded to 2 dp), for readability
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    logs = (
        db.query(AppUsageLog)
        .filter(
            AppUsageLog.user_id     == user.id,
            AppUsageLog.recorded_at >= cutoff,
        )
        .order_by(AppUsageLog.recorded_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "session_id",
        "recorded_at",
        "process",
        "window_title",
        "duration_sec",
        "duration_min",
    ])

    for log in logs:
        writer.writerow([
            log.session_id if hasattr(log, "session_id") and log.session_id else "",
            log.recorded_at.isoformat() if log.recorded_at else "",
            log.process,
            log.window_title or "",
            round(log.duration_sec, 2),
            round(log.duration_sec / 60, 2),
        ])

    output.seek(0)
    filename = f"cogniload_app_usage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )