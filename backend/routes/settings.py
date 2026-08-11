"""
routes/settings.py — User preferences endpoints.

  GET /settings     — fetch current settings (or defaults)
  PUT /settings     — update one or more settings fields
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, UserSettings
from auth.jwt import get_current_user
from api.schemas import SettingsResponse, SettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(user: User, db: Session) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=SettingsResponse)
def get_settings(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    return _get_or_create_settings(user, db)


@router.put("", response_model=SettingsResponse)
def update_settings(
    body: SettingsUpdateRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    settings = _get_or_create_settings(user, db)
    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
