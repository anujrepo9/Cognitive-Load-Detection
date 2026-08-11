"""
ml/train.py — Train the CogniLoad classifier.

Usage:
    python ml/train.py                          # defaults
    python ml/train.py --data ml/datasets/train.csv
    python ml/train.py --model gb               # gradient boosting
    python ml/train.py --no-calibrate           # skip calibration

Outputs (to ml/saved_models/):
    model.joblib    — calibrated classifier
    scaler.joblib   — StandardScaler
    meta.json       — version, accuracy, feature order, trained_at
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler

# ── Feature order must match BehaviorPayload / predictor.py ──────────────────
FEATURE_ORDER = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "movement_smoothness",
]

LABEL_COL = "label"
LABELS    = ["low", "medium", "high"]

SAVED_DIR = Path(__file__).parent / "saved_models"
MODEL_PATH  = SAVED_DIR / "model.joblib"
SCALER_PATH = SAVED_DIR / "scaler.joblib"
META_PATH   = SAVED_DIR / "meta.json"


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_dataset(csv_path: str) -> tuple[np.ndarray, np.ndarray]:
    df = pd.read_csv(csv_path)
    missing = [f for f in FEATURE_ORDER if f not in df.columns]
    if missing:
        print(f"[ERROR] Missing columns in dataset: {missing}", file=sys.stderr)
        sys.exit(1)
    if LABEL_COL not in df.columns:
        print(f"[ERROR] No '{LABEL_COL}' column found.", file=sys.stderr)
        sys.exit(1)

    X = df[FEATURE_ORDER].fillna(0).values.astype(float)
    y = df[LABEL_COL].values
    return X, y


def build_classifier(name: str):
    if name == "rf":
        return RandomForestClassifier(
            n_estimators    = 300,
            max_depth       = None,
            min_samples_leaf= 2,
            class_weight    = "balanced",
            random_state    = 42,
            n_jobs          = -1,
        )
    if name == "gb":
        return GradientBoostingClassifier(
            n_estimators    = 200,
            max_depth       = 4,
            learning_rate   = 0.08,
            subsample       = 0.85,
            random_state    = 42,
        )
    print(f"[ERROR] Unknown model '{name}'. Choose rf or gb.", file=sys.stderr)
    sys.exit(1)


def print_section(title: str):
    print(f"\n{'─' * 50}")
    print(f"  {title}")
    print('─' * 50)


# ── Main ──────────────────────────────────────────────────────────────────────

def train(
    data_path:   str  = "ml/datasets/train.csv",
    model_name:  str  = "rf",
    calibrate:   bool = True,
    test_size:   float = 0.20,
    verbose:     bool = True,
):
    if verbose:
        print_section(f"Loading dataset: {data_path}")
    X, y = load_dataset(data_path)

    if verbose:
        unique, counts = np.unique(y, return_counts=True)
        print(f"  Samples : {len(X)}")
        print(f"  Features: {len(FEATURE_ORDER)}")
        for lbl, cnt in zip(unique, counts):
            print(f"  {lbl:<8} {cnt}")

    # ── Split ─────────────────────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=42
    )

    # ── Scale ─────────────────────────────────────────────────────────────────
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    # ── Cross-validation ──────────────────────────────────────────────────────
    if verbose:
        print_section(f"Cross-validation ({model_name.upper()})")
    clf_raw = build_classifier(model_name)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(clf_raw, X_train_s, y_train, cv=cv, scoring="accuracy", n_jobs=-1)
    if verbose:
        print(f"  CV accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
        print(f"  Folds: {[f'{s:.4f}' for s in cv_scores]}")

    # ── Train final model ─────────────────────────────────────────────────────
    if verbose:
        print_section("Training final model")
    clf_raw.fit(X_train_s, y_train)

    # ── Calibration ───────────────────────────────────────────────────────────
    if calibrate:
        if verbose:
            print("  Applying isotonic calibration (CalibratedClassifierCV)…")
        clf = CalibratedClassifierCV(clf_raw, method="isotonic", cv=3)
        clf.fit(X_train_s, y_train)
    else:
        clf = clf_raw

    # ── Evaluation ────────────────────────────────────────────────────────────
    y_pred = clf.predict(X_test_s)
    acc    = accuracy_score(y_test, y_pred)

    if verbose:
        print_section("Evaluation on held-out test set")
        print(f"  Accuracy: {acc:.4f}  ({acc * 100:.1f}%)\n")
        print(classification_report(y_test, y_pred, target_names=LABELS, zero_division=0))
        cm = confusion_matrix(y_test, y_pred, labels=LABELS)
        print("  Confusion matrix (rows=actual, cols=predicted):")
        print(f"  {'':>8} " + "  ".join(f"{l:>8}" for l in LABELS))
        for lbl, row in zip(LABELS, cm):
            print(f"  {lbl:>8} " + "  ".join(f"{v:>8}" for v in row))

    # ── Feature importances (RF only) ─────────────────────────────────────────
    base = clf_raw if calibrate else clf
    if hasattr(base, "feature_importances_") and verbose:
        print_section("Feature importances")
        importances = base.feature_importances_
        ranked = sorted(zip(FEATURE_ORDER, importances), key=lambda x: -x[1])
        for feat, imp in ranked:
            bar = "█" * int(imp * 80)
            print(f"  {feat:<24} {imp:.4f}  {bar}")

    # ── Save ──────────────────────────────────────────────────────────────────
    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf,    MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    meta = {
        "model_type":    model_name,
        "calibrated":    calibrate,
        "version":       "1.0.0",
        "trained_at":    datetime.now(timezone.utc).isoformat(),
        "accuracy":      round(float(acc), 6),
        "cv_mean":       round(float(cv_scores.mean()), 6),
        "cv_std":        round(float(cv_scores.std()), 6),
        "n_samples":     int(len(X)),
        "feature_order": FEATURE_ORDER,
        "labels":        LABELS,
        "data_path":     str(data_path),
    }
    META_PATH.write_text(json.dumps(meta, indent=2))

    if verbose:
        print_section("Saved")
        print(f"  Model  → {MODEL_PATH}")
        print(f"  Scaler → {SCALER_PATH}")
        print(f"  Meta   → {META_PATH}")
        print(f"\n  ✅  Accuracy: {acc * 100:.1f}%  |  CV: {cv_scores.mean() * 100:.1f}% ± {cv_scores.std() * 100:.1f}%\n")

    return acc, meta


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train CogniLoad classifier")
    parser.add_argument("--data",         default="ml/datasets/train.csv", help="Path to CSV dataset")
    parser.add_argument("--model",        default="rf", choices=["rf", "gb"], help="rf=RandomForest, gb=GradientBoosting")
    parser.add_argument("--no-calibrate", action="store_true", help="Skip probability calibration")
    parser.add_argument("--test-size",    type=float, default=0.20, help="Test split fraction (default 0.2)")
    args = parser.parse_args()

    train(
        data_path  = args.data,
        model_name = args.model,
        calibrate  = not args.no_calibrate,
        test_size  = args.test_size,
    )
