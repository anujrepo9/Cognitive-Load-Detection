"""
mouse_listener.py — Captures mousemove, click, and scroll events via pynput.
Throttles move events to max 30/s to keep buffer lean.

Phase 4 additions:
    * Path segments — keeps the last N move samples so we can compute path
      curvature / acceleration from speed deltas.
    * Acceleration tracking — change in cursor speed between consecutive
      samples (px/s²).
    * Hover-time tracking — time between mousedown and mouseup on the same
      element region (used for interaction dwell metrics).
"""

import time
from collections import deque
from pynput import mouse as ms

from buffer import EventBuffer, MouseMoveEvent, MouseHoverEvent

MOVE_THROTTLE_S = 1 / 30   # max 30 move samples per second
DOUBLE_CLICK_GAP_S = 0.25  # two clicks within this = double-click
PATH_SEGMENTS = 8          # how many recent move samples to keep
HOVER_RADIUS_PX = 40       # max movement radius considered "same region" hover


class MouseListener:
    def __init__(self, buffer: EventBuffer, raw_writer=None):
        self._buf       = buffer
        self._raw       = raw_writer
        self._last_move = 0.0          # epoch s of last sampled move
        self._last_x    = 0
        self._last_y    = 0
        self._last_move_time = 0.0
        self._last_speed = 0.0

        # Recent path (x, y, speed) for acceleration / path tracking
        self._path = deque(maxlen=PATH_SEGMENTS)

        # Press-state for hover tracking
        self._press_x = None
        self._press_y = None
        self._press_t = None

        self._last_click_time = 0.0    # for double-click detection
        self._listener = ms.Listener(
            on_move=self._on_move,
            on_click=self._on_click,
            on_scroll=self._on_scroll,
        )

    # ── pynput callbacks ──────────────────────────────────────────────────────

    def _on_move(self, x: int, y: int):
        now = time.time()

        # Throttle: skip if last sample was too recent
        if now - self._last_move < MOVE_THROTTLE_S:
            return

        dt = now - self._last_move_time or 0.001
        dx = x - self._last_x
        dy = y - self._last_y
        dist = (dx * dx + dy * dy) ** 0.5
        speed = dist / dt

        # Acceleration: change in speed divided by dt (px/s²)
        accel = (speed - self._last_speed) / dt if self._last_move_time else 0.0

        self._buf.add_mouse_move(MouseMoveEvent(
            x=x, y=y,
            speed_px_s=round(speed, 2),
            distance_px=round(dist, 2),
            timestamp=now * 1000,
        ))
        self._buf.mark_active(now)

        self._path.append((x, y, speed, accel))
        self._last_move      = now
        self._last_move_time = now
        self._last_speed     = speed
        self._last_x, self._last_y = x, y

        if self._raw:
            self._raw.write("mousemove", f"({x},{y})", now * 1000)

    def _on_click(self, x: int, y: int, button: ms.Button, pressed: bool):
        now = time.time()

        if pressed:
            # Mouse down — begin hover (dwell) window
            self._press_x = x
            self._press_y = y
            self._press_t = now
            return

        # Mouse up — compute hover duration if within the same region
        if self._press_t is not None:
            dx = (x - self._press_x) if self._press_x is not None else 0
            dy = (y - self._press_y) if self._press_y is not None else 0
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= HOVER_RADIUS_PX:
                duration_ms = (now - self._press_t) * 1000
                self._buf.add_hover(MouseHoverEvent(
                    duration_ms=round(duration_ms, 2),
                    timestamp=now * 1000,
                ))
            self._press_x = self._press_y = self._press_t = None

        is_double = (now - self._last_click_time) < DOUBLE_CLICK_GAP_S
        self._buf.add_click(double=is_double)
        self._buf.mark_active(now)
        self._last_click_time = now

        if self._raw:
            label = "doubleclick" if is_double else "click"
            self._raw.write(label, str(button), now * 1000)

    def _on_scroll(self, x: int, y: int, dx: int, dy: int):
        now = time.time()
        self._buf.add_scroll(float(abs(dy)))
        self._buf.mark_active(now)

        if self._raw:
            self._raw.write("scroll", str(dy), now * 1000)

    # ── Path / acceleration accessors (used by metrics) ──────────────────────

    def recent_accel(self) -> list:
        """Return the recent acceleration samples (px/s²)."""
        return [seg[3] for seg in self._path]

    def recent_path(self) -> list:
        """Return the recent path segments as (x, y, speed, accel)."""
        return list(self._path)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        self._listener.start()

    def stop(self):
        self._listener.stop()
