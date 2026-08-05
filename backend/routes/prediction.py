import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, Session as UserSession, Prediction
from auth.jwt import get_current_user
from api.schemas import BehaviorPayload, PredictionResponse
from services.predictor import get_predictor
from routes.behavior import _get_or_create_active_session

router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
def predict(
    payload: BehaviorPayload,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    result  = get_predictor().predict(payload)
    session = _get_or_create_active_session(user, db)

    record = Prediction(
        session_id = session.id,
        load_level = result["load_level"],
        confidence = result["confidence"],
        raw_scores = json.dumps(result["scores"]),
    )
    db.add(record)
    db.commit()

    return PredictionResponse(
        load_level = result["load_level"],
        confidence = result["confidence"],
        scores     = result["scores"],
        session_id = session.id,
    )
