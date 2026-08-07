"""
core.rate_limit — Lightweight in-memory sliding-window rate limiter.

Designed to guard expensive / abuse-prone auth endpoints (login, register)
without pulling in a heavy dependency. Uses a per-key deque of timestamps in
memory; safe for single-process deployments.

For multi-worker / distributed deployments, swap this for a Redis-backed
limiter (e.g. ``slowapi`` + ``redis``).
"""

import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request


class SlidingWindowRateLimiter:
    """Sliding-window limiter keyed by an arbitrary string (e.g. client IP)."""

    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def _cleanup(self, now: float) -> None:
        """Drop expired entries for all keys (called periodically inside lock)."""
        cutoff = now - self.window_seconds
        expired = [k for k, hits in self._hits.items()
                   if not hits or hits[0] > cutoff]
        for k in expired:
            del self._hits[k]

    def allow(self, key: str) -> bool:
        """Register a hit and return True if the request is within the limit."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            self._cleanup(now)
            hits = self._hits.setdefault(key, deque())
            # Drop hits outside the sliding window
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.max_attempts:
                return False
            hits.append(now)
            return True

    def remaining(self, key: str) -> int:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits.get(key)
            if not hits:
                return self.max_attempts
            while hits and hits[0] <= cutoff:
                hits.popleft()
            return max(0, self.max_attempts - len(hits))


# ── Shared instances (per endpoint) ─────────────────────────────────────────

def _client_ip(request: Request) -> str:
    """Best-effort client IP. Behind a reverse proxy use X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def make_limiter(max_attempts: int, window_seconds: int):
    """Return a FastAPI dependency that rate-limits by client IP."""
    limiter = SlidingWindowRateLimiter(max_attempts, window_seconds)

    def dependency(request: Request):
        key = _client_ip(request)
        if not limiter.allow(key):
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again shortly.",
                headers={
                    "Retry-After": str(limiter.window_seconds),
                    "X-RateLimit-Remaining": str(limiter.remaining(key)),
                },
            )
        return True

    dependency.limiter = limiter  # expose for introspection/testing
    return dependency
