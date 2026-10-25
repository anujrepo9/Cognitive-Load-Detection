"""
main.py — FastAPI application entry point.

This is what `uvicorn main:app` (used by both backend/start.py for dev and
cogniload_app.py for the packaged Windows app) actually imports.

All API routers are mounted under /api.
Static files (pre-built React frontend) are served when COGNILOAD_STATIC_DIR
is set (desktop / PyInstaller build only).
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

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
from routes import app_usage as app_usage_route

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
    docs_url="/docs",
    redoc_url=None,
)

# ── Global exception handlers ─────────────────────────────────────────────────
register_exception_handlers(app)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(RequestIDMiddleware)
app.add_middleware(MaxBodySizeMiddleware, max_bytes=MAX_BODY_SIZE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:8000",
        *CORS_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers — all mounted under /api ─────────────────────────────────────
#
# IMPORTANT: these are registered FIRST so FastAPI's router always matches
# /api/* paths before the SPA catch-all middleware below ever runs.
#
app.include_router(auth.router,             prefix="/api")
app.include_router(behavior.router,         prefix="/api")
app.include_router(prediction.router,       prefix="/api")
app.include_router(dashboard.router,        prefix="/api")
app.include_router(recommendation.router,   prefix="/api")
app.include_router(session.router,          prefix="/api")
app.include_router(reports.router,          prefix="/api")
app.include_router(analytics.router,        prefix="/api")
app.include_router(settings_route.router,   prefix="/api")
app.include_router(model_route.router,      prefix="/api")
app.include_router(app_usage_route.router,  prefix="/api")
app.include_router(ws_route.router)

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": "1.0.0"}

# ── Static frontend (PyInstaller .exe / packaged build only) ──────────────────
#
# COGNILOAD_STATIC_DIR is set by cogniload_app.py to the frontend/dist path.
# In dev mode (python backend/start.py) this env var is NOT set, so this
# whole block is skipped — Vite's dev server handles the frontend instead.
#
_static_dir  = os.environ.get("COGNILOAD_STATIC_DIR", "")
_static_path = Path(_static_dir) if _static_dir else None

if _static_path and _static_path.exists():

    _assets_dir = _static_path / "assets"
    if _assets_dir.exists():
        try:
            app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")
        except Exception as _e:
            logger.warning(f"Could not mount /assets — skipping: {_e}")

    _icons_dir = _static_path / "icons"
    if _icons_dir.exists():
        try:
            app.mount("/icons", StaticFiles(directory=str(_icons_dir)), name="icons")
        except Exception as _e:
            logger.warning(f"Could not mount /icons — skipping: {_e}")

    # ── SPA catch-all via Starlette middleware ────────────────────────────────
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import Response

    _API_PREFIXES = (
        "/api/",
        "/api",
        "/docs",
        "/health",
        "/assets/",
        "/icons/",
        "/openapi.json",
    )

    class SPAMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            path = request.url.path

            if any(path.startswith(p) for p in _API_PREFIXES) or path == "/api":
                return await call_next(request)

            rel = path.lstrip("/") or "index.html"
            candidate = _static_path / rel
            if candidate.exists() and candidate.is_file():
                return FileResponse(str(candidate))

            index = _static_path / "index.html"
            if index.exists():
                return FileResponse(str(index))

            return JSONResponse(
                {"error": "Frontend not built. Run: cd frontend && npm run build"},
                status_code=503,
            )

    app.add_middleware(SPAMiddleware)
    logger.info(f"Serving frontend from: {_static_path}")