import json
import asyncio
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, Prediction, BehaviorData
from auth.jwt import get_current_user
from api.schemas import BehaviorPayload, PredictionResponse
from services.predictor import get_predictor
from routes.behavior import _get_or_create_active_session

router = APIRouter(tags=["prediction"])


async def _broadcast_prediction(user_id: int, payload: dict) -> None:
    """Push prediction to all WebSocket subscribers for this user (best-effort)."""
    try:
        # Import here to avoid circular imports at module load time
        from routes.ws import manager
        await manager.send_to_user(user_id, {"type": "prediction", **payload})
    except Exception:
        pass  # WebSocket broadcast is fire-and-forget — never fail the HTTP response


@router.post("/predict", response_model=PredictionResponse)
async def predict(
    payload: BehaviorPayload,
    background_tasks: BackgroundTasks,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    result  = get_predictor().predict(payload)
    session = _get_or_create_active_session(user, db)

    # Always persist the raw behavior record so it is linked to the prediction
    behavior_record = BehaviorData(
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
    db.add(behavior_record)
    db.flush()   # get behavior_record.id before committing prediction

    record = Prediction(
        session_id  = session.id,
        behavior_id = behavior_record.id,
        load_level  = result["load_level"],
        confidence  = result["confidence"],
        raw_scores  = json.dumps(result["scores"]),
    )
    db.add(record)
    db.commit()

    ws_payload = {
        "load_level": result["load_level"],
        "confidence": result["confidence"],
        "scores":     result["scores"],
        "session_id": session.id,
        "typing_wpm":  payload.typing_wpm,
    }

    # Broadcast to WebSocket clients — background so HTTP response isn't delayed
    background_tasks.add_task(_broadcast_prediction, user.id, ws_payload)

    return PredictionResponse(
        load_level = result["load_level"],
        confidence = result["confidence"],
        scores     = result["scores"],
        session_id = session.id,
    )
