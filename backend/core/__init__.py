"""
core — Centralized application foundation.

Contains cross-cutting concerns shared across the application:
    - configuration wrapper   (core.config)
    - logging setup           (core.logging)
    - error handling          (core.errors)
    - request middleware      (core.middleware)
"""
from core.config import settings
from core.logging import get_logger, setup_logging

__all__ = ["settings", "get_logger", "setup_logging"]

