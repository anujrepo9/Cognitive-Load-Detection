import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database.db import init_db
from services.predictor import get_predictor
from routes import auth, behavior, prediction, dashboard, recommendation

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s:%(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    init_db()
    logger.info("Loading ML model…")
    get_predictor()
    logger.info("Backend ready.")
    yield


app = FastAPI(
    title="CogniLoad API",
    version="1.0.0",
    description="Cognitive Load Detection — REST API",
    lifespan=lifespan,
)

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

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(behavior.router)
app.include_router(prediction.router)
app.include_router(dashboard.router)
app.include_router(recommendation.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": "1.0.0"}
