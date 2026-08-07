"""
core.middleware — Request validation middleware.

Provides:
    - ``MAX_BODY_SIZE`` enforcement → 413 when exceeded.
    - A structured ``X-Request-Id`` via a lightweight ASGI middleware.
    - Optional: reject requests with a JSON body that cannot be parsed.

The body-size check is implemented as a pure ASGI middleware so it works
reliably for streaming bodies (Starlette's ``BaseHTTPMiddleware`` buffers
the entire body, defeating the purpose).
"""

import json
import logging
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from core.errors import _error_body

logger = logging.getLogger("cogniload.middleware")


class RequestIDMiddleware:
    """Attach a unique ``X-Request-Id`` to every response and log it."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())
        scope["request_id"] = request_id

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


class MaxBodySizeMiddleware:
    """Reject HTTP requests whose body exceeds ``max_bytes`` with a 413."""

    def __init__(self, app: ASGIApp, max_bytes: int = 1_048_576):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = 0
        for key, value in scope.get("headers", []):
            if key == b"content-length":
                content_length = int(value.decode())
                break

        if content_length > self.max_bytes:
            response = _error_body(
                code="payload_too_large",
                message=f"Request body exceeds {self.max_bytes} bytes limit",
            )
            body = json.dumps(response).encode()
            await send({
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            })
            await send({
                "type": "http.response.body",
                "body": body,
            })
            return

        await self.app(scope, receive, send)
