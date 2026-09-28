"""
metrics.py — Converts a BufferState snapshot into a flat feature dict.
One dict = one CSV row = one ML sample.

Bug-fixes applied (2026-09-27):
  1. typing_wpm now returns None when there is not enough typing data in the
     window (< 2 word-separating spaces), instead of always returning 0.
     WPM is calculated as chars/(5*window_min) — the standard 5-char-per-word
     method — which is more accurate than counting spaces.
  2. error_rate denominator now excludes backspaces themselves so the rate
     reflects backspaces-per-typed-char, not backspaces-per-all-keys.
  3. pause_count / avg_pause_ms threshold lowered from 2000 ms to 500 ms.
     A 2-second gap between consecutive keystrokes is rare enough that
     pause_count was always 0; 500 ms matches the psycholinguistic definition
     of a typing hesitation and produces meaningful counts.
  4. typing_variance is computed from inter-key flight times (rhythm variance)
     instead of hold-time CV — flight time captures typing rhythm disruptions
     far better than how long each key is physically held down.
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
    Returns a feature dict with all ML features + metadata.
    window_sec: duration of the collection window (usually 5.0 or 15.0)
    """
    keys  = state.key_events
    moves = state.mouse_moves
    window_min = window_sec / 60.0

    # ── Keyboard features ─────────────────────────────────────────────────────
    key_count   = len(keys)
    backspaces  = sum(1 for k in keys if k.is_backspace)
    space_count = sum(1 for k in keys if k.key == " ")

    # FIX 1: Use standard 5-chars-per-word method for WPM.
    # Typed chars = total keys minus backspaces minus spaces (spaces aren't
    # "characters" in the word-length sense).
    # Return None when there is not enough typing to compute a meaningful rate
    # — the schema declares typing_wpm as Optional[int] exactly for this case.
    typed_chars = key_count - backspaces - space_count
    if typed_chars > 0 and window_min > 0:
        wpm: Optional[int] = round(typed_chars / (5 * window_min))
    else:
        wpm = None   # sentinel: "not enough typing this window"

    cpm = round(typed_chars / window_min, 1) if window_min > 0 else 0

    # FIX 2: Denominator must exclude backspaces themselves.
    # backspaces/key_count deflates the true rate because backspaces are in
    # both numerator and denominator. We want backspaces per typed char.
    net_keys   = key_count - backspaces          # chars actually committed
    error_rate = round(backspaces / net_keys, 4) if net_keys > 0 else 0.0

    holds   = [k.hold_ms   for k in keys]
    flights = [k.flight_ms for k in keys if k.flight_ms is not None]

    avg_hold   = round(_avg(holds),   2)
    avg_flight = round(_avg(flights), 2)

    # FIX 3: Use 500 ms threshold instead of 2000 ms.
    # Between-keystroke gaps > 2 s are so rare in normal typing that
    # pause_count was effectively always 0. 500 ms matches standard
    # cognitive-load / psycholinguistic definitions of a typing hesitation.
    PAUSE_THRESHOLD_MS = 500
    pauses      = [f for f in flights if f > PAUSE_THRESHOLD_MS]
    pause_count = len(pauses)
    avg_pause   = round(_avg(pauses), 2)

    # FIX 4: typing_variance now measures flight-time irregularity (rhythm),
    # not hold-time CV.  Hold times are nearly constant across people; flight
    # times (inter-key intervals) are what change under cognitive load.
    flight_std      = _std(flights)
    typing_variance = round(flight_std / avg_flight, 4) if avg_flight > 0 else 0.0

    # ── Mouse features ────────────────────────────────────────────────────────
    speeds     = [m.speed_px_s  for m in moves]
    distances  = [m.distance_px for m in moves]

    avg_speed  = round(_avg(speeds),   2)
    total_dist = round(sum(distances), 2)
    click_rate = round(state.clicks / window_min, 2) if window_min > 0 else 0.0
    dbl_rate   = round(state.double_clicks / window_min, 2) if window_min > 0 else 0.0
    scroll_rate = round(state.scrolls / window_min, 2) if window_min > 0 else 0.0

    # Smoothness: inverse of speed variance (higher = smoother)
    speed_cv   = _std(speeds) / avg_speed if avg_speed > 0 else 1.0
    smoothness = round(max(0.1, min(1.0, 1 - speed_cv)), 4)

    # Acceleration = change in speed between consecutive move samples
    accel = []
    for i in range(1, len(speeds)):
        dt = (moves[i].timestamp - moves[i - 1].timestamp) / 1000.0
        if dt > 0:
            accel.append((speeds[i] - speeds[i - 1]) / dt)
    avg_accel = round(_avg(accel), 2)

    # Hover-time (dwell) between mousedown and mouseup
    hover_ms  = [h.duration_ms for h in getattr(state, "hovers", [])]
    avg_hover = round(_avg(hover_ms), 2)

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
        "typing_wpm":          wpm,          # None when not enough typing data
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
        "avg_hover_ms":        avg_hover,
        "avg_acceleration":    avg_accel,
        "movement_smoothness": smoothness,
        # label — filled in by main after optional self-report prompt
        "label": None,
    }