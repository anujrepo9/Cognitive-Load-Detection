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


def _active_session(db: Session, user_id: int) -> UserSession | None:
    return (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.end_time.is_(None))
        .order_by(UserSession.start_time.desc())
        .first()
    )


def _session_response(db: Session, sess: UserSession) -> CurrentSessionResponse:
    now = datetime.now(timezone.utc)
    start = sess.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    latest_pred = (
        db.query(Prediction)
        .filter(Prediction.session_id == sess.id)
        .order_by(Prediction.created_at.desc())
        .first()
    )
    return CurrentSessionResponse(
        session_id=sess.id,
        start_time=sess.start_time,
        duration_seconds=int((now - start).total_seconds()),
        prediction_count=len(sess.predictions),
        latest_load=latest_pred.load_level if latest_pred else None,
        latest_confidence=latest_pred.confidence if latest_pred else None,
    )


@router.post("/start", response_model=CurrentSessionResponse)
def start_session(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create an active session, or return the one already in progress."""
    sess = _active_session(db, user.id)
    if not sess:
        sess = UserSession(user_id=user.id)
        db.add(sess)
        db.commit()
        db.refresh(sess)
    return _session_response(db, sess)


@router.get("/current", response_model=CurrentSessionResponse)
def current_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Return the user's currently active session and latest prediction."""
    sess = _active_session(db, user.id)
    if not sess:
        raise HTTPException(status_code=404, detail="No active session")

    return _session_response(db, sess)


@router.post("/end", response_model=EndSessionResponse)
def end_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Close the user's active session by setting end_time."""
    sess = _active_session(db, user.id)
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
