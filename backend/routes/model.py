"""
routes/model.py — ML model metadata endpoint.

  GET /model/info — version, accuracy, trained_at, features
"""

from fastapi import APIRouter, Depends
from database.models import User
from auth.jwt import get_current_user
from api.schemas import ModelInfoResponse
from services.predictor import get_predictor

router = APIRouter(prefix="/model", tags=["model"])


@router.get("/info", response_model=ModelInfoResponse)
def model_info(user: User = Depends(get_current_user)):
    """Return metadata about the currently loaded ML model."""
    info = get_predictor().get_model_info()
    return ModelInfoResponse(**info)
