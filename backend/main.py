from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, MAX_BODY_SIZE
from core.logging import get_logger, setup_logging
from core.errors import register_exception_handlers
from core.middleware import RequestIDMiddleware, MaxBodySizeMiddleware
from database.db import init_db, dispose_engine
from services.predictor import get_predictor
from routes import auth, behavior, prediction, dashboard, recommendation, session, reports, analytics
from routes import settings as settings_route
from routes import model as model_route
from routes import ws as ws_route

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    init_db()
    logger.info("Loading ML model…")
    get_predictor()
    logger.info("Backend ready.")
    try:
        yield
    finally:
        logger.info("Shutting down — disposing database engine.")
        dispose_engine()


app = FastAPI(
    title="CogniLoad API",
    version="1.0.0",
    description="Cognitive Load Detection — REST API",
    lifespan=lifespan,
)

# ── Global exception handlers ────────────────────────────────────────────────
register_exception_handlers(app)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow all localhost ports for local development.
# In production, replace with your real frontend URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",   # CRA / alternate
        "http://localhost:4173",   # Vite preview
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        *CORS_ORIGINS,             # anything extra from .env
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request validation / metadata middleware ─────────────────────────────────
app.add_middleware(RequestIDMiddleware)
app.add_middleware(MaxBodySizeMiddleware, max_bytes=MAX_BODY_SIZE)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(behavior.router)
app.include_router(prediction.router)
app.include_router(dashboard.router)
app.include_router(recommendation.router)
app.include_router(session.router)
app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(settings_route.router)
app.include_router(model_route.router)
app.include_router(ws_route.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": "1.0.0"}
