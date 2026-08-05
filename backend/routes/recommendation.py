from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, Prediction, BehaviorData
from auth.jwt import get_current_user
from api.schemas import BehaviorPayload, RecommendationResponse
from recommendations.engine import get_recommendations

router = APIRouter(tags=["recommendations"])


@router.get("/recommendation", response_model=RecommendationResponse)
def recommendation(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    # Latest prediction for this user
    latest_pred = (
        db.query(Prediction)
        .join(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(Prediction.created_at.desc())
        .first()
    )
    load_level = latest_pred.load_level if latest_pred else "medium"

    # Latest behavior for signal-based ranking
    latest_b = (
        db.query(BehaviorData)
        .join(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(BehaviorData.timestamp.desc())
        .first()
    )

    payload = None
    if latest_b:
        payload = BehaviorPayload(
            typing_wpm          = latest_b.typing_wpm,
            avg_hold_ms         = latest_b.avg_hold_ms,
            error_rate          = latest_b.error_rate,
            pause_count         = latest_b.pause_count,
            idle_time_pct       = latest_b.idle_time_pct,
            avg_cursor_speed    = latest_b.avg_cursor_speed,
            movement_smoothness = latest_b.movement_smoothness,
        )

    recs = get_recommendations(load_level, payload)
    return RecommendationResponse(load_level=load_level, recommendations=recs)
