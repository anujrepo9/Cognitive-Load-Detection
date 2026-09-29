"""
backend/routes/session.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, Prediction
from auth.jwt import get_current_user, create_access_token
from api.schemas import CurrentSessionResponse, EndSessionResponse

# Ensure backend/ is on sys.path so collector_process.py imports correctly
# regardless of what directory uvicorn is launched from.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import collector_process  # noqa: E402

router = APIRouter(prefix="/session", tags=["session"])

_BACKEND_URL    = os.getenv("BACKEND_SELF_URL", "http://127.0.0.1:8000")
_FLUSH_INTERVAL = int(os.getenv("COLLECTOR_FLUSH_INTERVAL", "15"))


def _active_session(db: Session, user_id: int) -> UserSession | None:
    return (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.end_time.is_(None))
        .order_by(UserSession.start_time.desc())
        .first()
    )


def _session_response(db: Session, sess: UserSession) -> CurrentSessionResponse:
    now   = datetime.now(timezone.utc)
    start = sess.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    latest_pred = (
        db.query(Prediction)
        .filter(Prediction.session_id == sess.id)
        .order_by(Prediction.created_at.desc())
        .first()
    )
    running = collector_process.is_running()
    return CurrentSessionResponse(
        session_id=sess.id,
        start_time=sess.start_time,
        duration_seconds=int((now - start).total_seconds()),
        prediction_count=len(sess.predictions),
        latest_load=latest_pred.load_level if latest_pred else None,
        latest_confidence=latest_pred.confidence if latest_pred else None,
        collector_running=running,
        collector_mode="system" if running else "browser",
        collector_error=None if running else collector_process.last_error(),
    )


@router.post("/start", response_model=CurrentSessionResponse)
def start_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    sess = _active_session(db, user.id)
    if not sess:
        sess = UserSession(user_id=user.id)
        db.add(sess)
        db.commit()
        db.refresh(sess)

    token = create_access_token({"sub": str(user.id)})

    if not collector_process.is_running():
        started = collector_process.start(
            api_url=_BACKEND_URL,
            token=token,
            flush_interval=_FLUSH_INTERVAL,
        )
        if not started:
            print(
                "[session] Windows collector failed to start; "
                f"{collector_process.last_error()}"
            )

    return _session_response(db, sess)


@router.get("/current", response_model=CurrentSessionResponse)
def current_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    sess = _active_session(db, user.id)
    if not sess:
        raise HTTPException(status_code=404, detail="No active session")
    return _session_response(db, sess)


@router.post("/pause", response_model=CurrentSessionResponse)
def pause_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    sess = _active_session(db, user.id)
    if not sess:
        raise HTTPException(status_code=404, detail="No active session")
    collector_process.stop()
    return _session_response(db, sess)


@router.post("/resume", response_model=CurrentSessionResponse)
def resume_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    sess = _active_session(db, user.id)
    if not sess:
        raise HTTPException(status_code=404, detail="No active session")
    token = create_access_token({"sub": str(user.id)})
    if not collector_process.restart():
        collector_process.start(
            api_url=_BACKEND_URL,
            token=token,
            flush_interval=_FLUSH_INTERVAL,
        )
    return _session_response(db, sess)


@router.post("/end", response_model=EndSessionResponse)
def end_session(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    sess = _active_session(db, user.id)
    if not sess:
        raise HTTPException(status_code=404, detail="No active session to end")

    now = datetime.now(timezone.utc)
    sess.end_time = now
    db.commit()
    db.refresh(sess)

    collector_process.stop()

    start = sess.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    total_sec    = int((now - start).total_seconds())
    duration_str = f"{total_sec // 3600}h {(total_sec % 3600) // 60}m {total_sec % 60}s"

    return EndSessionResponse(
        session_id=sess.id,
        end_time=now,
        duration=duration_str,
    )