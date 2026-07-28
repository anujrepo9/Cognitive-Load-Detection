"""
mouse_listener.py — Captures mousemove, click, and scroll events via pynput.
Throttles move events to max 30/s to keep buffer lean.
"""

import time
from pynput import mouse as ms

from buffer import EventBuffer, MouseMoveEvent

MOVE_THROTTLE_S = 1 / 30   # max 30 move samples per second
DOUBLE_CLICK_GAP_S = 0.25  # two clicks within this = double-click


class MouseListener:
    def __init__(self, buffer: EventBuffer, raw_writer=None):
        self._buf       = buffer
        self._raw       = raw_writer
        self._last_move = 0.0          # epoch s of last sampled move
        self._last_x    = 0
        self._last_y    = 0
        self._last_move_time = 0.0

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

        self._buf.add_mouse_move(MouseMoveEvent(
            x=x, y=y,
            speed_px_s=round(speed, 2),
            distance_px=round(dist, 2),
            timestamp=now * 1000,
        ))
        self._buf.mark_active(now)

        self._last_move      = now
        self._last_move_time = now
        self._last_x, self._last_y = x, y

        if self._raw:
            self._raw.write("mousemove", f"({x},{y})", now * 1000)

    def _on_click(self, x: int, y: int, button: ms.Button, pressed: bool):
        if not pressed:
            return
        now = time.time()
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

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        self._listener.start()

    def stop(self):
        self._listener.stop()
