# ml/inject_real.py  — add this script
import pandas as pd
from pathlib import Path

FEATURE_ORDER = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "movement_smoothness",
]

real = pd.read_csv("backend/collector/output/behavior_data.csv")

# Keep only hand-labeled rows (drop rows where label is empty/NaN)
real = real.dropna(subset=["label"])
real = real[real["label"].isin(["low", "medium", "high"])]

print(f"Real labeled rows: {len(real)}")
print(real["label"].value_counts())

synthetic = pd.read_csv("ml/datasets/train.csv")

# Merge and save
merged = pd.concat(
    [synthetic[FEATURE_ORDER + ["label"]], real[FEATURE_ORDER + ["label"]]],
    ignore_index=True
)
merged.to_csv("ml/datasets/train.csv", index=False)
print(f"Total rows after merge: {len(merged)}")