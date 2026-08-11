"""
routes/analytics.py — Analytics endpoints.

  GET /analytics/trends   — time-series of load levels + confidence
  GET /analytics/features — per-feature distribution stats
"""

import statistics
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, BehaviorData, Prediction
from auth.jwt import get_current_user
from api.schemas import AnalyticsTrendsResponse, TrendPoint, AnalyticsFeaturesResponse, FeatureStatEntry

router = APIRouter(prefix="/analytics", tags=["analytics"])

BEHAVIOR_FEATURES = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate",
    "double_click_rate", "scroll_rate", "idle_time_pct",
    "avg_hover_ms", "movement_smoothness",
]


@router.get("/trends", response_model=AnalyticsTrendsResponse)
def trends(
    hours:  int     = Query(24, ge=1,  le=720, description="Lookback window in hours"),
    limit:  int     = Query(200, ge=10, le=1000, description="Max data points returned"),
    db:     Session = Depends(get_db),
    user:   User    = Depends(get_current_user),
):
    """Return a time-ordered list of predictions with wpm from linked behavior."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    session_ids = [
        s.id for s in
        db.query(UserSession.id)
          .filter(UserSession.user_id == user.id)
          .all()
    ]
    if not session_ids:
        return AnalyticsTrendsResponse(points=[], total=0, from_time=None, to_time=None)

    predictions = (
        db.query(Prediction)
        .filter(
            Prediction.session_id.in_(session_ids),
            Prediction.created_at >= cutoff,
        )
        .order_by(Prediction.created_at.asc())
        .limit(limit)
        .all()
    )

    # Pre-fetch linked behavior rows for WPM
    behavior_ids = [p.behavior_id for p in predictions if p.behavior_id]
    behavior_map: dict[int, BehaviorData] = {}
    if behavior_ids:
        for b in db.query(BehaviorData).filter(BehaviorData.id.in_(behavior_ids)).all():
            behavior_map[b.id] = b

    points = []
    for p in predictions:
        b = behavior_map.get(p.behavior_id) if p.behavior_id else None
        points.append(TrendPoint(
            timestamp  = p.created_at.isoformat(),
            load_level = p.load_level,
            confidence = round(p.confidence, 4),
            wpm        = b.typing_wpm if b else None,
        ))

    from_time = points[0].timestamp  if points else None
    to_time   = points[-1].timestamp if points else None

    return AnalyticsTrendsResponse(
        points    = points,
        total     = len(points),
        from_time = from_time,
        to_time   = to_time,
    )


@router.get("/features", response_model=AnalyticsFeaturesResponse)
def features(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Return per-feature distribution stats, overall and split by load level."""
    session_ids = [
        s.id for s in
        db.query(UserSession.id)
          .filter(UserSession.user_id == user.id)
          .all()
    ]
    if not session_ids:
        return AnalyticsFeaturesResponse(stats=[], per_load={}, total_records=0)

    behaviors = (
        db.query(BehaviorData)
        .filter(BehaviorData.session_id.in_(session_ids))
        .all()
    )
    if not behaviors:
        return AnalyticsFeaturesResponse(stats=[], per_load={}, total_records=0)

    # Build per-load lookup via behavior_id → prediction
    pred_by_behavior: dict[int, str] = {}
    preds = (
        db.query(Prediction)
        .filter(Prediction.session_id.in_(session_ids), Prediction.behavior_id.isnot(None))
        .all()
    )
    for p in preds:
        pred_by_behavior[p.behavior_id] = p.load_level

    # Overall stats
    stats = []
    for feat in BEHAVIOR_FEATURES:
        vals = [getattr(b, feat, 0) or 0 for b in behaviors]
        if not vals:
            continue
        stats.append(FeatureStatEntry(
            feature = feat,
            mean    = round(statistics.mean(vals), 4),
            std     = round(statistics.stdev(vals) if len(vals) > 1 else 0.0, 4),
            min     = round(min(vals), 4),
            max     = round(max(vals), 4),
        ))

    # Per-load stats
    load_buckets: dict[str, list[BehaviorData]] = defaultdict(list)
    for b in behaviors:
        load = pred_by_behavior.get(b.id, "unknown")
        load_buckets[load].append(b)

    per_load: dict[str, dict[str, float]] = {}
    for load, bucket in load_buckets.items():
        if load == "unknown":
            continue
        per_load[load] = {
            feat: round(
                statistics.mean([getattr(b, feat, 0) or 0 for b in bucket]), 4
            )
            for feat in BEHAVIOR_FEATURES
        }

    return AnalyticsFeaturesResponse(
        stats        = stats,
        per_load     = per_load,
        total_records= len(behaviors),
    )
