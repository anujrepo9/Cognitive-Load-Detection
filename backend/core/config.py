"""
core.config — Centralized settings wrapper.

Single source of truth for application configuration. Re-exports the values
from the module-level ``config.py`` and adds a few convenience helpers plus
new settings introduced across later phases (refresh tokens, WebSocket, model
metadata, logging, request size limits).

Importing this module does NOT load extra dependencies — it re-uses the
``python-dotenv`` loading performed by :mod:`config`.
"""

import os

from config import (  # noqa: F401  (re-exported for convenience)
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    CORS_ORIGINS,
    DATABASE_URL,
    MODEL_PATH,
    SECRET_KEY,
)

# ── New settings introduced in later phases ─────────────────────────────────
JWT_REFRESH_SECRET        = os.getenv("JWT_REFRESH_SECRET", SECRET_KEY + "-refresh")
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))
WS_ENABLED                = os.getenv("WS_ENABLED", "false").lower() in ("1", "true", "yes")
MODEL_VERSION             = os.getenv("MODEL_VERSION", "0.1.0-rulebased")
MODEL_TRAINED_AT          = os.getenv("MODEL_TRAINED_AT", "")
MODEL_ACCURACY            = float(os.getenv("MODEL_ACCURACY", 0.0)) if os.getenv("MODEL_ACCURACY") else None

# Logging / request handling
LOG_LEVEL      = os.getenv("LOG_LEVEL", "INFO")
LOG_DIR        = os.getenv("LOG_DIR", "")
MAX_BODY_SIZE  = int(os.getenv("MAX_BODY_SIZE", 1_048_576))   # 1 MB default

# ── Convenience accessors (mirrors the raw values in config.py) ─────────────
settings = {
    "DATABASE_URL": DATABASE_URL,
    "SECRET_KEY": SECRET_KEY,
    "ALGORITHM": ALGORITHM,
    "ACCESS_TOKEN_EXPIRE_MINUTES": ACCESS_TOKEN_EXPIRE_MINUTES,
    "MODEL_PATH": MODEL_PATH,
    "CORS_ORIGINS": CORS_ORIGINS,
}

