"""
core.errors — Global exception handlers & structured error responses.

Registers handlers for:
    - :class:`RequestValidationError` (Pydantic) → 422 structured
    - :class:`HTTPException` (FastAPI)          → structured status
    - generic ``Exception``                     → 500 structured

Every error response follows a consistent shape::

    {
        "error": {
            "code": "validation_error",
            "message": "Human-readable summary",
            "details": [ ... optional field-level detail ... ]
        }
    }
"""

import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("cogniload.errors")


class AppError(Exception):
    """Base application error with a stable machine-readable ``code``."""

    def __init__(self, message: str, code: str = "app_error", details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


class NotFoundError(AppError):
    def __init__(self, message: str, details=None):
        super().__init__(message, code="not_found", details=details)


class ForbiddenError(AppError):
    def __init__(self, message: str, details=None):
        super().__init__(message, code="forbidden", details=details)


class ConflictError(AppError):
    def __init__(self, message: str, details=None):
        super().__init__(message, code="conflict", details=details)


def _error_body(code: str, message: str, details=None) -> dict:
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


def _http_status_for(code: str) -> int:
    mapping = {
        "not_found": status.HTTP_404_NOT_FOUND,
        "forbidden": status.HTTP_403_FORBIDDEN,
        "conflict": status.HTTP_409_CONFLICT,
        "validation_error": status.HTTP_422_UNPROCESSABLE_ENTITY,
    }
    return mapping.get(code, status.HTTP_400_BAD_REQUEST)


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Structured handler for FastAPI/Starlette HTTPExceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(
            code=_code_for_status(exc.status_code),
            message=str(exc.detail),
        ),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Structured handler for Pydantic request validation errors (422)."""
    errors = exc.errors()
    details = []
    for err in errors:
        loc = err.get("loc", ())
        details.append(
            {
                "field": ".".join(str(p) for p in loc if p != "body"),
                "type": err.get("type"),
                "message": err.get("msg"),
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            code="validation_error",
            message="Request validation failed",
            details=details,
        ),
    )


async def app_error_handler(request: Request, exc: AppError):
    """Handler for application-level :class:`AppError` subclasses."""
    return JSONResponse(
        status_code=_http_status_for(exc.code),
        content=_error_body(code=exc.code, message=exc.message, details=exc.details),
    )


async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all — log the traceback and return a generic 500."""
    logger.error(
        "Unhandled exception on %s %s\n%s",
        request.method,
        request.url.path,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body(
            code="internal_error",
            message="An unexpected error occurred",
        ),
    )


def _code_for_status(http_status: int) -> str:
    mapping = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        429: "too_many_requests",
        500: "internal_error",
    }
    return mapping.get(http_status, "http_error")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI app."""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
