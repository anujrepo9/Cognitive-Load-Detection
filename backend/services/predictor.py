"""
services/predictor.py — ML inference with preprocessing pipeline.

  - Loads model.joblib + scaler.joblib at startup via get_predictor().
  - Falls back to rule-based predictor when no model file exists.
  - Exposes get_model_info() for the GET /model/info endpoint.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np

from config import MODEL_PATH, SCALER_PATH, MODEL_META_PATH
from api.schemas import BehaviorPayload
from preprocessing.pipeline import get_pipeline, FEATURE_ORDER

logger = logging.getLogger(__name__)

LABELS = ["low", "medium", "high"]


class Predictor:
    def __init__(self):
        self._model   = None
        self._meta: dict = {}
        self._load()

    # ── Loading ───────────────────────────────────────────────────────────────

    def _load(self):
        model_path  = Path(MODEL_PATH)
        scaler_path = Path(SCALER_PATH)
        meta_path   = Path(MODEL_META_PATH)

        if not model_path.exists():
            logger.info(f"No model at {model_path} — using rule-based fallback")
            return

        try:
            import joblib
            self._model = joblib.load(model_path)
            logger.info(f"Model loaded from {model_path}")
        except Exception as exc:
            logger.warning(f"Could not load model: {exc} — using rule-based fallback")
            return

        # Load scaler into the preprocessing pipeline singleton
        get_pipeline(str(scaler_path))

        # Load metadata
        if meta_path.exists():
            try:
                self._meta = json.loads(meta_path.read_text())
                logger.info(
                    f"Model v{self._meta.get('version', '?')} | "
                    f"accuracy={self._meta.get('accuracy', 0):.4f}"
                )
            except Exception:
                pass

    # ── Public interface ──────────────────────────────────────────────────────

    @property
    def using_ml(self) -> bool:
        return self._model is not None

    def predict(self, payload: BehaviorPayload) -> dict:
        """Returns {load_level, confidence, scores}."""
        if self._model:
            return self._ml_predict(payload)
        return self._rule_predict(payload)

    def get_model_info(self) -> dict:
        if not self._meta:
            return {
                "version":    "0.1.0-rulebased",
                "type":       "rule-based",
                "trained_at": None,
                "accuracy":   None,
                "cv_mean":    None,
                "n_samples":  None,
                "features":   FEATURE_ORDER,
            }
        return {
            "version":    self._meta.get("version", "unknown"),
            "type":       self._meta.get("model_type", "unknown"),
            "calibrated": self._meta.get("calibrated", False),
            "trained_at": self._meta.get("trained_at"),
            "accuracy":   self._meta.get("accuracy"),
            "cv_mean":    self._meta.get("cv_mean"),
            "cv_std":     self._meta.get("cv_std"),
            "n_samples":  self._meta.get("n_samples"),
            "features":   FEATURE_ORDER,
        }

    # ── ML inference ──────────────────────────────────────────────────────────

    def _ml_predict(self, payload: BehaviorPayload) -> dict:
        pipeline = get_pipeline()
        feat_dict = {f: getattr(payload, f, 0) for f in FEATURE_ORDER}
        X = pipeline.transform(feat_dict)

        proba   = self._model.predict_proba(X)[0]
        classes = list(self._model.classes_)
        scores  = {c: round(float(p), 4) for c, p in zip(classes, proba)}
        best    = max(scores, key=scores.get)

        return {
            "load_level": best,
            "confidence": scores[best],
            "scores":     scores,
        }

    # ── Rule-based fallback ───────────────────────────────────────────────────

    def _rule_predict(self, payload: BehaviorPayload) -> dict:
        score = 0

        if payload.typing_wpm < 35:       score += 2
        elif payload.typing_wpm > 55:     score -= 1

        if payload.error_rate > 0.08:     score += 2
        elif payload.error_rate < 0.03:   score -= 1

        if payload.idle_time_pct > 0.25:  score += 2
        elif payload.idle_time_pct < 0.10: score -= 1

        if payload.pause_count > 5:       score += 2
        elif payload.pause_count < 2:     score -= 1

        if payload.avg_hold_ms > 140:     score += 1
        elif payload.avg_hold_ms < 100:   score -= 1

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


# ── Singleton ─────────────────────────────────────────────────────────────────

_predictor: Optional[Predictor] = None


def get_predictor() -> Predictor:
    global _predictor
    if _predictor is None:
        _predictor = Predictor()
    return _predictor
