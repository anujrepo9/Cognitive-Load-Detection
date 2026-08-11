"""
ml/retrain.py — Periodic retraining from collected DB data.

Reads behavior_data rows from the SQLite DB (joined with predictions
for labels), merges with the original synthetic CSV, and retrains.

Usage:
    python ml/retrain.py                        # merge DB + train.csv, retrain
    python ml/retrain.py --db-only              # use only DB data (no synthetic)
    python ml/retrain.py --min-samples 200      # abort if too few DB rows
    python ml/retrain.py --dry-run              # export merged CSV, don't train
"""

import argparse
import sys
from pathlib import Path

# Allow running from project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import pandas as pd

FEATURE_ORDER = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "movement_smoothness",
]
LABEL_COL    = "label"
SYNTHETIC_CSV = Path("ml/datasets/train.csv")
MERGED_CSV    = Path("ml/datasets/retrain_merged.csv")
DB_PATH       = Path("backend/cogniload.db")


def extract_from_db(db_path: Path) -> pd.DataFrame:
    """Pull behavior rows that have a matching prediction (the label source)."""
    import sqlite3

    if not db_path.exists():
        print(f"[WARN] DB not found at {db_path} — no real data to add")
        return pd.DataFrame()

    conn = sqlite3.connect(db_path)
    query = """
        SELECT
            b.typing_wpm, b.chars_per_min, b.avg_hold_ms, b.avg_flight_ms,
            b.error_rate, b.pause_count, b.avg_pause_ms, b.typing_variance,
            b.avg_cursor_speed, b.movement_distance, b.click_rate,
            b.double_click_rate, b.scroll_rate, b.idle_time_pct,
            b.avg_hover_ms, b.movement_smoothness,
            p.load_level AS label
        FROM behavior_data b
        JOIN predictions p ON p.behavior_id = b.id
        WHERE p.load_level IN ('low', 'medium', 'high')
    """
    try:
        df = pd.read_sql_query(query, conn)
    except Exception as exc:
        print(f"[WARN] DB query failed: {exc}")
        df = pd.DataFrame()
    finally:
        conn.close()

    return df


def retrain(
    db_only:     bool = False,
    min_samples: int  = 50,
    dry_run:     bool = False,
    model:       str  = "rf",
):
    # ── Gather data ───────────────────────────────────────────────────────────
    db_df = extract_from_db(DB_PATH)
    print(f"DB rows with labels : {len(db_df)}")

    if len(db_df) < min_samples:
        print(
            f"[INFO] Only {len(db_df)} real samples — minimum is {min_samples}. "
            f"{'Aborting.' if db_only else 'Using synthetic data only.'}"
        )
        if db_only:
            sys.exit(0)
        db_df = pd.DataFrame()

    if db_only:
        merged = db_df[FEATURE_ORDER + [LABEL_COL]]
    else:
        synthetic = pd.read_csv(SYNTHETIC_CSV) if SYNTHETIC_CSV.exists() else pd.DataFrame()
        print(f"Synthetic rows      : {len(synthetic)}")
        frames = [f for f in [synthetic, db_df] if len(f) > 0]
        merged = pd.concat(frames, ignore_index=True)[FEATURE_ORDER + [LABEL_COL]]

    merged = merged.dropna(subset=[LABEL_COL])
    print(f"Total merged rows   : {len(merged)}")
    print(merged[LABEL_COL].value_counts().to_string())

    if dry_run:
        merged.to_csv(MERGED_CSV, index=False)
        print(f"[dry-run] Saved merged CSV → {MERGED_CSV}")
        return

    # ── Retrain ───────────────────────────────────────────────────────────────
    merged.to_csv(MERGED_CSV, index=False)
    from ml.train import train as run_train
    acc, meta = run_train(
        data_path  = str(MERGED_CSV),
        model_name = model,
        calibrate  = True,
        verbose    = True,
    )
    print(f"\nRetrain complete — accuracy: {acc:.4f}")

    # Invalidate the singleton so next request reloads the new model
    import services.predictor as pred_module
    pred_module._predictor = None
    print("Predictor singleton reset — next request will load new model.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Retrain CogniLoad from real + synthetic data")
    parser.add_argument("--db-only",     action="store_true", help="Use only DB data")
    parser.add_argument("--min-samples", type=int, default=50, help="Min DB rows before using real data")
    parser.add_argument("--dry-run",     action="store_true", help="Export merged CSV only, no training")
    parser.add_argument("--model",       default="rf", choices=["rf", "gb"])
    args = parser.parse_args()

    retrain(
        db_only     = args.db_only,
        min_samples = args.min_samples,
        dry_run     = args.dry_run,
        model       = args.model,
    )
