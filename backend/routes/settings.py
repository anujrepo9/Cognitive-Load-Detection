"""
routes/settings.py — User preferences endpoints.

  GET  /settings            — fetch current settings (or defaults)
  PUT  /settings            — update one or more settings fields
  GET  /settings/autostart  — check if app is registered for Windows startup
  POST /settings/autostart  — enable Windows startup registration
  DELETE /settings/autostart — disable Windows startup registration
"""

import sys
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User, UserSettings
from auth.jwt import get_current_user
from api.schemas import SettingsResponse, SettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["settings"])

# ── Autostart helpers (Windows-only, no admin rights needed) ──────────────────

_RUN_KEY  = r"Software\Microsoft\Windows\CurrentVersion\Run"
_APP_NAME = "CogniLoad"


def _exe_path() -> str:
    """Return the absolute path to the running .exe (or python in dev)."""
    return sys.executable


def _autostart_get() -> bool:
    """Return True if the Run registry key exists for this app."""
    if not sys.platform.startswith("win"):
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY, 0,
                            winreg.KEY_QUERY_VALUE) as key:
            winreg.QueryValueEx(key, _APP_NAME)
        return True
    except (ImportError, OSError):
        return False


def _autostart_enable() -> bool:
    """Register the .exe in HKCU Run. Returns True on success."""
    if not sys.platform.startswith("win"):
        return False
    try:
        import winreg
        cmd = f'"{_exe_path()}"'
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY, 0,
                            winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, _APP_NAME, 0, winreg.REG_SZ, cmd)
        return True
    except (ImportError, OSError):
        return False


def _autostart_disable() -> bool:
    """Remove the Run registry entry. Returns True if it was removed."""
    if not sys.platform.startswith("win"):
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY, 0,
                            winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, _APP_NAME)
        return True
    except (ImportError, OSError):
        return False


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


# ── Autostart endpoints ───────────────────────────────────────────────────────

@router.get("/autostart")
def get_autostart(_: User = Depends(get_current_user)):
    """Return whether the app is registered to launch at Windows login."""
    return {"enabled": _autostart_get()}


@router.post("/autostart", status_code=200)
def enable_autostart(_: User = Depends(get_current_user)):
    """Register the app to launch automatically at Windows login."""
    if not sys.platform.startswith("win"):
        raise HTTPException(status_code=400, detail="Autostart is only supported on Windows.")
    ok = _autostart_enable()
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to register autostart. Check permissions.")
    return {"enabled": True}


@router.delete("/autostart", status_code=200)
def disable_autostart(_: User = Depends(get_current_user)):
    """Remove the app from Windows login startup."""
    if not sys.platform.startswith("win"):
        raise HTTPException(status_code=400, detail="Autostart is only supported on Windows.")
    _autostart_disable()   # idempotent — no error if key didn't exist
    return {"enabled": False}