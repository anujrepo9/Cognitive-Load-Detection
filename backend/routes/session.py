"""
routes/session.py — Session lifecycle endpoints.

  POST /session/end     — close the active session
  GET  /session/current — return active session + latest prediction
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, Prediction
from auth.jwt import get_current_user
from api.schemas import CurrentSessionResponse, EndSessionResponse

router = APIRouter(prefix="/session", tags=["session"])


@router.get("/current", response_model=CurrentSessionResponse)
def current_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Return the user's currently active session and latest prediction."""
    sess = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.end_time.is_(None))
        .order_by(UserSession.start_time.desc())
        .first()
    )
    if not sess:
        raise HTTPException(status_code=404, detail="No active session")

    now = datetime.now(timezone.utc)
    start = sess.start_time
    # Ensure both are tz-aware for subtraction
    if start.tzinfo is None:
        from datetime import timezone as tz
        start = start.replace(tzinfo=tz.utc)
    duration_sec = int((now - start).total_seconds())

    latest_pred = (
        db.query(Prediction)
        .filter(Prediction.session_id == sess.id)
        .order_by(Prediction.created_at.desc())
        .first()
    )

    return CurrentSessionResponse(
        session_id        = sess.id,
        start_time        = sess.start_time,
        duration_seconds  = duration_sec,
        prediction_count  = len(sess.predictions),
        latest_load       = latest_pred.load_level if latest_pred else None,
        latest_confidence = latest_pred.confidence  if latest_pred else None,
    )


@router.post("/end", response_model=EndSessionResponse)
def end_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Close the user's active session by setting end_time."""
    sess = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.end_time.is_(None))
        .order_by(UserSession.start_time.desc())
        .first()
    )
    if not sess:
        raise HTTPException(status_code=404, detail="No active session to end")

    now = datetime.now(timezone.utc)
    sess.end_time = now
    db.commit()
    db.refresh(sess)

    start = sess.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    total_sec = int((now - start).total_seconds())
    duration_str = f"{total_sec // 3600}h {(total_sec % 3600) // 60}m {total_sec % 60}s"

    return EndSessionResponse(
        session_id = sess.id,
        end_time   = now,
        duration   = duration_str,
    )
