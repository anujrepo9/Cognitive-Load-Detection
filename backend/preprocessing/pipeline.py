"""
backend/preprocessing/pipeline.py — Feature preprocessing for inference.

Loads the saved StandardScaler and applies it to a raw feature dict
before passing to the model. Handles missing / zero features gracefully.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

FEATURE_ORDER = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "movement_smoothness",
]

# Hard clamps — same as training generator
CLAMPS: dict[str, tuple[float, float]] = {
    "typing_wpm":          (0,    150),
    "chars_per_min":       (0,    700),
    "avg_hold_ms":         (0,    400),
    "avg_flight_ms":       (0,    400),
    "error_rate":          (0,    0.5),
    "pause_count":         (0,    20),
    "avg_pause_ms":        (0,    6000),
    "typing_variance":     (0,    1),
    "avg_cursor_speed":    (0,    900),
    "movement_distance":   (0,    7000),
    "click_rate":          (0,    40),
    "double_click_rate":   (0,    8),
    "scroll_rate":         (0,    30),
    "idle_time_pct":       (0,    0.95),
    "avg_hover_ms":        (0,    2000),
    "movement_smoothness": (0,    1),
}


class PreprocessingPipeline:
    """Wraps a fitted StandardScaler for inference-time feature preparation."""

    def __init__(self, scaler_path: Optional[str] = None):
        self._scaler = None
        if scaler_path:
            self._load(Path(scaler_path))

    def _load(self, path: Path) -> None:
        if not path.exists():
            logger.warning(f"Scaler not found at {path} — will pass raw values")
            return
        try:
            import joblib
            self._scaler = joblib.load(path)
            logger.info(f"Scaler loaded from {path}")
        except Exception as exc:
            logger.warning(f"Could not load scaler: {exc} — raw values will be used")

    @property
    def ready(self) -> bool:
        return self._scaler is not None

    def transform(self, feature_dict: dict) -> np.ndarray:
        """
        Convert a raw feature dict to a scaled (1, n_features) numpy array.
        Missing features are imputed with 0 before clamping and scaling.
        """
        raw = []
        for feat in FEATURE_ORDER:
            val = feature_dict.get(feat, 0) or 0   # None → 0
            lo, hi = CLAMPS.get(feat, (None, None))
            if lo is not None:
                val = float(np.clip(val, lo, hi))
            raw.append(float(val))

        arr = np.array([raw])   # shape (1, 16)
        if self._scaler is not None:
            arr = self._scaler.transform(arr)
        return arr


# ── Module-level singleton ────────────────────────────────────────────────────

_pipeline: Optional[PreprocessingPipeline] = None


def get_pipeline(scaler_path: Optional[str] = None) -> PreprocessingPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = PreprocessingPipeline(scaler_path)
    return _pipeline
