"""
core.logging — Centralized logging configuration.

Sets up a logger with:
    - a rotating file handler (default 5 MB per file, keeps 5 backups) under ``backend/logs/``
    - a console handler (streams to stdout/stderr)
    - configurable level via ``LOG_LEVEL`` env var (default INFO)

Usage:
    from core.logging import get_logger

    logger = get_logger(__name__)
    logger.info("Hello")
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Defaults — overridable via env vars.
LOG_LEVEL       = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_DIR         = os.getenv("LOG_DIR", str(Path(__file__).resolve().parent.parent / "logs"))
LOG_FILE        = os.getenv("LOG_FILE", "app.log")
LOG_MAX_BYTES   = int(os.getenv("LOG_MAX_BYTES", 5 * 1024 * 1024))   # 5 MB
LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", 5))
LOG_FORMAT       = os.getenv(
    "LOG_FORMAT",
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

_CONFIGURED = False


def _ensure_log_dir(path: str) -> Path:
    """Create the log directory if it does not exist."""
    dir_path = Path(path)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def setup_logging(level: str | None = None) -> None:
    """
    Configure the root logger once.

    Safe to call multiple times; subsequent calls are no-ops unless
    ``force`` is used internally.

    Args:
        level: logging level (string or int). Defaults to ``LOG_LEVEL``.
    """
    global _CONFIGURED

    if _CONFIGURED:
        return

    _CONFIGURED = True

    log_level = (level or LOG_LEVEL).upper()
    numeric_level = getattr(logging, log_level, logging.INFO)

    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Avoid duplicate handlers if called again in tests.
    root.handlers.clear()

    formatter = logging.Formatter(LOG_FORMAT)

    # ── Console handler ─────────────────────────────────────────────────────
    console = logging.StreamHandler()
    console.setLevel(numeric_level)
    console.setFormatter(formatter)
    root.addHandler(console)

    # ── Rotating file handler ───────────────────────────────────────────────
    log_dir = _ensure_log_dir(LOG_DIR)
    file_handler = RotatingFileHandler(
        filename=str(log_dir / LOG_FILE),
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(numeric_level)
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    # Quiet down noisy third-party loggers unless explicit debug is requested.
    if numeric_level > logging.DEBUG:
        for noisy in ("uvicorn.access", "httpx", "urllib3"):
            logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> logging.Logger:
    """
    Return a logger for ``name``. Ensures logging is configured beforehand.

    Args:
        name: typically ``__name__`` of the calling module.
    """
    setup_logging()
    return logging.getLogger(name)

