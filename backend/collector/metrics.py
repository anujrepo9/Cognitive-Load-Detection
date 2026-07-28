"""
metrics.py — Converts a BufferState snapshot into a flat feature dict.
One dict = one CSV row = one ML sample.
"""

import time
from typing import Optional
from buffer import BufferState


def _avg(values: list) -> float:
    return sum(values) / len(values) if values else 0.0


def _std(values: list) -> float:
    if len(values) < 2:
        return 0.0
    m = _avg(values)
    return (sum((x - m) ** 2 for x in values) / len(values)) ** 0.5


def calculate(state: BufferState, window_sec: float) -> dict:
    """
    Returns a feature dict with all 16 ML features + metadata.
    window_sec: duration of the collection window (usually 5.0)
    """
    keys  = state.key_events
    moves = state.mouse_moves
    window_min = window_sec / 60.0

    # ── Keyboard features ─────────────────────────────────────────────────────
    key_count   = len(keys)
    backspaces  = sum(1 for k in keys if k.is_backspace)
    space_count = sum(1 for k in keys if k.key == " ")

    wpm         = round(space_count / window_min) if window_min > 0 else 0
    cpm         = round(key_count   / window_min) if window_min > 0 else 0
    error_rate  = round(backspaces / key_count, 4) if key_count > 0 else 0.0

    holds       = [k.hold_ms   for k in keys]
    flights     = [k.flight_ms for k in keys if k.flight_ms is not None]

    avg_hold    = round(_avg(holds),   2)
    avg_flight  = round(_avg(flights), 2)

    # Pauses: inter-key gaps > 2 000 ms
    pauses      = [f for f in flights if f > 2000]
    pause_count = len(pauses)
    avg_pause   = round(_avg(pauses), 2)

    # Typing consistency (lower = more erratic)
    hold_std        = _std(holds)
    typing_variance = round(hold_std / avg_hold, 4) if avg_hold > 0 else 0.0

    # ── Mouse features ────────────────────────────────────────────────────────
    speeds     = [m.speed_px_s  for m in moves]
    distances  = [m.distance_px for m in moves]

    avg_speed  = round(_avg(speeds),    2)
    total_dist = round(sum(distances),  2)
    click_rate = round(state.clicks / window_min, 2) if window_min > 0 else 0.0
    dbl_rate   = round(state.double_clicks / window_min, 2) if window_min > 0 else 0.0
    scroll_rate = round(state.scrolls / window_min, 2) if window_min > 0 else 0.0

    # Smoothness: inverse of speed variance (higher = smoother)
    speed_cv    = _std(speeds) / avg_speed if avg_speed > 0 else 1.0
    smoothness  = round(max(0.1, min(1.0, 1 - speed_cv)), 4)

    # ── Idle ─────────────────────────────────────────────────────────────────
    idle_pct = round(
        min(state.idle_total_ms / (window_sec * 1000), 0.95), 4
    ) if window_sec > 0 else 0.0

    return {
        # metadata
        "timestamp":           time.strftime("%H:%M:%S"),
        "duration_s":          round(window_sec, 1),
        "keys_pressed":        key_count,
        "backspaces":          backspaces,
        # keyboard features
        "typing_wpm":          wpm,
        "chars_per_min":       cpm,
        "avg_hold_ms":         avg_hold,
        "avg_flight_ms":       avg_flight,
        "error_rate":          error_rate,
        "pause_count":         pause_count,
        "avg_pause_ms":        avg_pause,
        "typing_variance":     typing_variance,
        # mouse features
        "avg_cursor_speed":    avg_speed,
        "movement_distance":   total_dist,
        "click_rate":          click_rate,
        "double_click_rate":   dbl_rate,
        "scroll_rate":         scroll_rate,
        "idle_time_pct":       idle_pct,
        "avg_hover_ms":        0,           # populated if hover tracking added
        "movement_smoothness": smoothness,
        # label — filled in by main after optional self-report prompt
        "label": None,
    }
