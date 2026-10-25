"""
mouse_clicks.py — Click, double-click, and hover (dwell) tracking.

Extracted from mouse_listener.py (Phase 4 refactor).
Handles:
  * Single-click counting
  * Double-click detection (two clicks within DOUBLE_CLICK_MS on same region)
  * Hover/dwell time (mousedown → mouseup duration)
"""

import time
from dataclasses import dataclass, field
from buffer import EventBuffer

DOUBLE_CLICK_MS  = 400   # max ms between two clicks to count as double-click
HOVER_REGION_PX  = 20    # clicks within this pixel radius are "same region"


@dataclass
class HoverEvent:
    x: int
    y: int
    duration_ms: float


class ClickTracker:
    """Tracks clicks, double-clicks, and hover/dwell times."""

    def __init__(self, buffer: EventBuffer, raw_writer=None):
        self._buf = buffer
        self._raw = raw_writer

        # For double-click detection
        self._last_click_time: float = 0.0
        self._last_click_x: int = 0
        self._last_click_y: int = 0

        # For hover/dwell (mousedown timestamp)
        self._press_time: float = 0.0
        self._press_x: int = 0
        self._press_y: int = 0

    def on_click(self, x: int, y: int, button, pressed: bool):
        now = time.time()

        if pressed:
            # Record mousedown for hover duration
            self._press_time = now
            self._press_x = x
            self._press_y = y
        else:
            # Mouse released — compute hover duration
            if self._press_time > 0:
                duration_ms = (now - self._press_time) * 1000.0
                hover = HoverEvent(x=x, y=y, duration_ms=round(duration_ms, 2))
                # Store hover on buffer if it supports it
                if hasattr(self._buf, "add_hover"):
                    self._buf.add_hover(hover)

            # Count click
            self._buf.add_click()
            self._buf.mark_active(now)

            # Double-click detection
            dt_ms = (now - self._last_click_time) * 1000.0
            dx = abs(x - self._last_click_x)
            dy = abs(y - self._last_click_y)
            if dt_ms <= DOUBLE_CLICK_MS and dx <= HOVER_REGION_PX and dy <= HOVER_REGION_PX:
                self._buf.add_double_click()

            self._last_click_time = now
            self._last_click_x = x
            self._last_click_y = y

            if self._raw:
                btn_name = getattr(button, "name", str(button))
                self._raw.write("click", btn_name, now * 1000)