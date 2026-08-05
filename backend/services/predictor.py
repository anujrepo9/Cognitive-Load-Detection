"""
services/predictor.py — Loads the trained model and runs inference.
Falls back to a rule-based predictor if no model file exists yet (Phase 7).
"""

import os
import json
import logging
from pathlib import Path

import numpy as np

from config import MODEL_PATH
from api.schemas import BehaviorPayload

logger = logging.getLogger(__name__)

FEATURE_ORDER = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "movement_smoothness",
]

LABELS = ["low", "medium", "high"]


class Predictor:
    def __init__(self):
        self._model = None
        self._load()

    def _load(self):
        path = Path(MODEL_PATH)
        if path.exists():
            try:
                import joblib
                self._model = joblib.load(path)
                logger.info(f"Model loaded from {path}")
            except Exception as e:
                logger.warning(f"Could not load model: {e} — using rule-based fallback")
        else:
            logger.info(f"No model at {path} — using rule-based fallback")

    def predict(self, payload: BehaviorPayload) -> dict:
        """Returns {load_level, confidence, scores}."""
        if self._model:
            return self._ml_predict(payload)
        return self._rule_predict(payload)

    def _ml_predict(self, payload: BehaviorPayload) -> dict:
        vec = np.array([[getattr(payload, f) for f in FEATURE_ORDER]])
        proba = self._model.predict_proba(vec)[0]
        classes = list(self._model.classes_)
        scores = {c: round(float(p), 4) for c, p in zip(classes, proba)}
        best   = max(scores, key=scores.get)
        return {
            "load_level": best,
            "confidence": scores[best],
            "scores":     scores,
        }

    def _rule_predict(self, payload: BehaviorPayload) -> dict:
        """
        Heuristic fallback matching Phase 1 label thresholds.
        Used before the ML model is trained (Phase 7).
        """
        score = 0

        # Typing speed
        if payload.typing_wpm < 35:    score += 2
        elif payload.typing_wpm > 55:  score -= 1

        # Error rate
        if payload.error_rate > 0.08:  score += 2
        elif payload.error_rate < 0.03: score -= 1

        # Idle
        if payload.idle_time_pct > 0.25:  score += 2
        elif payload.idle_time_pct < 0.10: score -= 1

        # Pauses
        if payload.pause_count > 5:    score += 2
        elif payload.pause_count < 2:  score -= 1

        # Hold time
        if payload.avg_hold_ms > 140:  score += 1
        elif payload.avg_hold_ms < 100: score -= 1

        # Map score → label
        if score >= 4:
            label, conf = "high",   min(0.95, 0.60 + score * 0.04)
        elif score <= -2:
            label, conf = "low",    min(0.95, 0.60 + abs(score) * 0.04)
        else:
            label, conf = "medium", 0.55

        others = (1 - conf) / 2
        scores = {l: round(others, 4) for l in LABELS}
        scores[label] = round(conf, 4)

        return {"load_level": label, "confidence": conf, "scores": scores}


# Singleton — one model loaded at startup
_predictor: Predictor | None = None


def get_predictor() -> Predictor:
    global _predictor
    if _predictor is None:
        _predictor = Predictor()
    return _predictor
