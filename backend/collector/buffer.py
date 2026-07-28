"""
buffer.py — Thread-safe in-memory event buffer.
All keyboard and mouse events land here first.
Nothing touches disk until the 5-second flush.
"""

import threading
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class KeyEvent:
    key: str
    hold_ms: float          # key press duration
    flight_ms: Optional[float]  # gap since previous keyup
    is_backspace: bool
    timestamp: float        # epoch ms


@dataclass
class MouseMoveEvent:
    x: int
    y: int
    speed_px_s: float
    distance_px: float
    timestamp: float


@dataclass
class BufferState:
    key_events:   list = field(default_factory=list)
    mouse_moves:  list = field(default_factory=list)
    clicks:       int  = 0
    double_clicks: int = 0
    scrolls:      int  = 0
    scroll_delta: float = 0.0
    idle_start:   Optional[float] = None   # epoch ms when idle began
    idle_total_ms: float = 0.0
    window_start: float  = 0.0            # epoch ms when this window opened


class EventBuffer:
    """Thread-safe wrapper around BufferState."""

    def __init__(self):
        self._lock = threading.Lock()
        self._state = BufferState()

    # ── Writers (called from listener threads) ────────────────────────────────

    def add_key(self, event: KeyEvent):
        with self._lock:
            self._state.key_events.append(event)

    def add_mouse_move(self, event: MouseMoveEvent):
        with self._lock:
            self._state.mouse_moves.append(event)

    def add_click(self, double=False):
        with self._lock:
            self._state.clicks += 1
            if double:
                self._state.double_clicks += 1

    def add_scroll(self, delta: float):
        with self._lock:
            self._state.scrolls += 1
            self._state.scroll_delta += abs(delta)

    def mark_idle_start(self, ts: float):
        with self._lock:
            if self._state.idle_start is None:
                self._state.idle_start = ts

    def mark_active(self, ts: float):
        with self._lock:
            if self._state.idle_start is not None:
                self._state.idle_total_ms += (ts - self._state.idle_start) * 1000
                self._state.idle_start = None

    # ── Reader + reset (called from flush thread) ─────────────────────────────

    def snapshot_and_reset(self, new_window_start: float) -> BufferState:
        """Atomically grab current state and clear for next window."""
        with self._lock:
            snap = self._state
            # Close any open idle window
            if snap.idle_start is not None:
                snap.idle_total_ms += (new_window_start - snap.idle_start) * 1000
                snap.idle_start = None
            self._state = BufferState(window_start=new_window_start)
            return snap

    def set_window_start(self, ts: float):
        with self._lock:
            self._state.window_start = ts
