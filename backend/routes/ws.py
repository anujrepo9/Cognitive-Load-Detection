"""
Phase 7 — Real-Time Communication
WebSocket endpoint: /ws/predictions

Authentication: JWT passed as `?token=<access_token>` query parameter
(WebSocket browsers cannot send custom headers).

Connection manager tracks one set of sockets per user_id so that predictions
can be broadcast to every open tab / window belonging to the same user.
"""
import asyncio
import json
from collections import defaultdict
from typing import DefaultDict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError

from config import SECRET_KEY, ALGORITHM
from core.logging import get_logger
from database.db import get_db
from database.models import User

try:
    from jose import jwt as _jwt
except ImportError:
    _jwt = None  # graceful – WS auth will reject all connections

logger = get_logger(__name__)

router = APIRouter(tags=["websocket"])

HEARTBEAT_INTERVAL = 30  # seconds between server-side pings


# ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    """Thread-safe (asyncio) manager that tracks WebSocket connections per user."""

    def __init__(self) -> None:
        # user_id → set of active WebSocket connections
        self._connections: DefaultDict[int, Set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)
        logger.info("WS connected  user_id=%s  total_for_user=%s",
                    user_id, len(self._connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        self._connections[user_id].discard(websocket)
        if not self._connections[user_id]:
            del self._connections[user_id]
        logger.info("WS disconnected user_id=%s  remaining=%s",
                    user_id, len(self._connections.get(user_id, set())))

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        """Broadcast *payload* to every connection owned by *user_id*."""
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(user_id, set())):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[user_id].discard(ws)

    async def broadcast(self, payload: dict) -> None:
        """Broadcast *payload* to ALL connected users (admin / debug use)."""
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, payload)

    @property
    def active_user_ids(self) -> list[int]:
        return list(self._connections.keys())

    def connection_count(self, user_id: int) -> int:
        return len(self._connections.get(user_id, set()))


# Single shared manager instance imported by the prediction route
manager = ConnectionManager()


# ── JWT helper (query-param auth) ─────────────────────────────────────────────

def _decode_ws_token(token: str) -> int | None:
    """Decode JWT from query param; return user_id or None on failure."""
    if _jwt is None:
        return None
    try:
        payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except (JWTError, ValueError, TypeError):
        return None


def _get_user(user_id: int) -> User | None:
    """Load user from DB; return None if not found / inactive."""
    db = next(get_db())
    try:
        user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
        return user
    finally:
        db.close()


# ── Heartbeat task ────────────────────────────────────────────────────────────

async def _heartbeat(websocket: WebSocket, user_id: int) -> None:
    """Send a ping frame every HEARTBEAT_INTERVAL seconds."""
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        try:
            await websocket.send_text(json.dumps({"type": "ping"}))
        except Exception:
            break  # connection gone — let the main handler clean up


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/predictions")
async def ws_predictions(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """
    Real-time prediction stream.

    On connect the server sends:
        {"type": "connected", "user_id": <int>}

    Predictions are pushed as:
        {"type": "prediction", "load_level": "low|medium|high",
         "confidence": 0.0-1.0, "scores": {...}, "session_id": <int>}

    Heartbeat (server → client) every 30 s:
        {"type": "ping"}

    Client should respond with:
        {"type": "pong"}

    On auth failure the socket is closed with code 4001.
    """
    user_id = _decode_ws_token(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid or missing token")
        return

    user = _get_user(user_id)
    if user is None:
        await websocket.close(code=4001, reason="User not found or inactive")
        return

    await manager.connect(websocket, user_id)
    # Notify client it's live
    await websocket.send_text(json.dumps({"type": "connected", "user_id": user_id}))

    heartbeat_task = asyncio.create_task(_heartbeat(websocket, user_id))

    try:
        while True:
            # Wait for any client message (pong, or disconnect signal)
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "pong":
                    pass  # heartbeat acknowledged — nothing to do
            except (json.JSONDecodeError, AttributeError):
                pass  # ignore malformed frames
    except WebSocketDisconnect:
        logger.info("WS client disconnected user_id=%s", user_id)
    except Exception as exc:
        logger.warning("WS error user_id=%s: %s", user_id, exc)
    finally:
        heartbeat_task.cancel()
        manager.disconnect(websocket, user_id)
