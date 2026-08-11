import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL               = os.getenv("DATABASE_URL", "sqlite:///./cogniload.db")
SECRET_KEY                 = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM                  = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
MODEL_PATH                 = os.getenv("MODEL_PATH",  "ml/saved_models/model.joblib")
SCALER_PATH                = os.getenv("SCALER_PATH", "ml/saved_models/scaler.joblib")
MODEL_META_PATH            = os.getenv("MODEL_META_PATH", "ml/saved_models/meta.json")
CORS_ORIGINS               = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

# ── New settings (Phase 2) ───────────────────────────────────────────────────
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

# ── Auth hardening (Phase 3) ─────────────────────────────────────────────────
REFRESH_TOKEN_BYTES   = int(os.getenv("REFRESH_TOKEN_BYTES", 48))   # random bytes
RATE_LIMIT_LOGIN_MIN  = int(os.getenv("RATE_LIMIT_LOGIN_MIN", 5))       # attempts / window
RATE_LIMIT_LOGIN_WINDOW = int(os.getenv("RATE_LIMIT_LOGIN_WINDOW", 60))  # seconds
RATE_LIMIT_REGISTER_MIN = int(os.getenv("RATE_LIMIT_REGISTER_MIN", 5))
RATE_LIMIT_REGISTER_WINDOW = int(os.getenv("RATE_LIMIT_REGISTER_WINDOW", 300))  # seconds
