from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, BehaviorData
from auth.jwt import get_current_user
from api.schemas import BehaviorPayload, BehaviorResponse

router = APIRouter(tags=["behavior"])


def _get_or_create_active_session(user: User, db: Session) -> UserSession:
    """Return the user's latest open session, or create a new one."""
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


@router.post("/behavior", response_model=BehaviorResponse)
def receive_behavior(
    payload: BehaviorPayload,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    session = _get_or_create_active_session(user, db)

    record = BehaviorData(
        session_id          = session.id,
        typing_wpm          = payload.typing_wpm,
        chars_per_min       = payload.chars_per_min,
        avg_hold_ms         = payload.avg_hold_ms,
        avg_flight_ms       = payload.avg_flight_ms,
        error_rate          = payload.error_rate,
        pause_count         = payload.pause_count,
        avg_pause_ms        = payload.avg_pause_ms,
        typing_variance     = payload.typing_variance,
        avg_cursor_speed    = payload.avg_cursor_speed,
        movement_distance   = payload.movement_distance,
        click_rate          = payload.click_rate,
        double_click_rate   = payload.double_click_rate,
        scroll_rate         = payload.scroll_rate,
        idle_time_pct       = payload.idle_time_pct,
        avg_hover_ms        = payload.avg_hover_ms,
        movement_smoothness = payload.movement_smoothness,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return BehaviorResponse(
        status="stored",
        session_id=session.id,
        record_id=record.id,
    )
