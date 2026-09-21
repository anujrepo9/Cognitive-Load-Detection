"""
Synthetic Cognitive Load Dataset Generator
===========================================
Generates realistic keyboard + mouse behavioral data
labeled Low / Medium / High cognitive load.

Usage:
    python generate_data.py              # 3000 samples -> dataset.csv
    python generate_data.py --n 5000     # custom count
    python generate_data.py --seed 99    # reproducible
"""

import argparse
import numpy as np
import pandas as pd
from pathlib import Path

# ── Label thresholds (from Phase 1 spec) ──────────────────────────────────────
PROFILES = {
    "low": {
        "typing_wpm":          (62, 8),    # mean, std
        "avg_hold_ms":         (95, 12),
        "avg_flight_ms":       (80, 10),
        "error_rate":          (0.018, 0.007),
        "pause_count":         (1.2, 0.6),
        "avg_pause_ms":        (820, 150),
        "typing_variance":     (0.08, 0.02),
        "chars_per_min":       (310, 35),
        "avg_cursor_speed":    (420, 60),
        "click_rate":          (8, 2),
        "double_click_rate":   (0.9, 0.3),
        "scroll_rate":         (5, 1.5),
        "idle_time_pct":       (0.07, 0.02),
        "avg_hover_ms":        (280, 50),
        "movement_distance":   (3200, 400),
        "movement_smoothness": (0.82, 0.05),
    },
    "medium": {
        "typing_wpm":          (44, 7),
        "avg_hold_ms":         (118, 15),
        "avg_flight_ms":       (105, 14),
        "error_rate":          (0.055, 0.012),
        "pause_count":         (3.5, 0.9),
        "avg_pause_ms":        (1350, 250),
        "typing_variance":     (0.18, 0.04),
        "chars_per_min":       (215, 30),
        "avg_cursor_speed":    (290, 55),
        "click_rate":          (12, 3),
        "double_click_rate":   (1.8, 0.5),
        "scroll_rate":         (9, 2),
        "idle_time_pct":       (0.17, 0.04),
        "avg_hover_ms":        (420, 80),
        "movement_distance":   (2100, 350),
        "movement_smoothness": (0.65, 0.07),
    },
    "high": {
        "typing_wpm":          (26, 6),
        "avg_hold_ms":         (155, 20),
        "avg_flight_ms":       (145, 20),
        "error_rate":          (0.11, 0.025),
        "pause_count":         (7.2, 1.4),
        "avg_pause_ms":        (2100, 400),
        "typing_variance":     (0.31, 0.06),
        "chars_per_min":       (125, 25),
        "avg_cursor_speed":    (160, 40),
        "click_rate":          (18, 4),
        "double_click_rate":   (3.1, 0.8),
        "scroll_rate":         (14, 3),
        "idle_time_pct":       (0.34, 0.06),
        "avg_hover_ms":        (620, 120),
        "movement_distance":   (1100, 250),
        "movement_smoothness": (0.42, 0.08),
    },
}

FEATURES = list(next(iter(PROFILES.values())).keys())

# Hard clamps so no physically impossible values slip through
CLAMPS = {
    "typing_wpm":          (5,   150),
    "avg_hold_ms":         (40,  400),
    "avg_flight_ms":       (20,  400),
    "error_rate":          (0,   0.5),
    "pause_count":         (0,   20),
    "avg_pause_ms":        (200, 6000),
    "typing_variance":     (0,   1),
    "chars_per_min":       (20,  700),
    "avg_cursor_speed":    (10,  900),
    "click_rate":          (0,   40),
    "double_click_rate":   (0,   8),
    "scroll_rate":         (0,   30),
    "idle_time_pct":       (0,   0.95),
    "avg_hover_ms":        (50,  2000),
    "movement_distance":   (100, 7000),
    "movement_smoothness": (0.1, 1),
}


def sample_label(n: int, label: str, rng: np.random.Generator) -> pd.DataFrame:
    profile = PROFILES[label]
    rows = {}
    for feat, (mean, std) in profile.items():
        vals = rng.normal(mean, std, n)
        lo, hi = CLAMPS[feat]
        rows[feat] = np.clip(vals, lo, hi)
    df = pd.DataFrame(rows)
    df["label"] = label
    return df


def add_noise_samples(df: pd.DataFrame, rng: np.random.Generator,
                      pct: float = 0.05) -> pd.DataFrame:
    """Add a small fraction of borderline samples to improve generalization."""
    n_noise = max(1, int(len(df) * pct))
    noise = df.sample(n=n_noise, random_state=int(rng.integers(0, 9999)))
    for feat in FEATURES:
        lo, hi = CLAMPS[feat]
        noise[feat] = np.clip(
            noise[feat] + rng.normal(0, noise[feat].std() * 0.4, n_noise),
            lo, hi
        )
    return pd.concat([df, noise], ignore_index=True)


def generate(n_total: int = 3000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # Balanced split: 33% each label
    n_each = n_total // 3
    remainder = n_total - n_each * 3

    frames = [
        sample_label(n_each + (1 if i < remainder else 0), label, rng)
        for i, label in enumerate(["low", "medium", "high"])
    ]
    df = pd.concat(frames, ignore_index=True)
    df = add_noise_samples(df, rng)

    # Shuffle
    df = df.sample(frac=1, random_state=int(rng.integers(0, 9999))).reset_index(drop=True)

    # Round for readability
    int_cols = ["typing_wpm", "avg_hold_ms", "avg_flight_ms",
                "pause_count", "avg_pause_ms", "chars_per_min",
                "avg_cursor_speed", "click_rate", "movement_distance",
                "avg_hover_ms"]
    for col in int_cols:
        if col in df.columns:
            df[col] = df[col].round(0).astype(int)

    float_cols = ["error_rate", "typing_variance", "idle_time_pct",
                  "movement_smoothness", "double_click_rate", "scroll_rate"]
    for col in float_cols:
        if col in df.columns:
            df[col] = df[col].round(4)

    return df


def print_summary(df: pd.DataFrame) -> None:
    print("\n── Dataset summary ──────────────────────────────")
    print(f"Total samples : {len(df)}")
    print(f"Features      : {len(FEATURES)}")
    print(f"\nLabel distribution:")
    vc = df["label"].value_counts()
    for label, count in vc.items():
        bar = "█" * (count // 30)
        print(f"  {label:<8} {count:>5}  {bar}")
    print(f"\nFeature ranges (mean ± std):")
    for feat in FEATURES:
        m, s = df[feat].mean(), df[feat].std()
        print(f"  {feat:<24} {m:>8.2f} ± {s:.2f}")
    print("─────────────────────────────────────────────────\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic cognitive load data")
    parser.add_argument("--n",    type=int, default=3000, help="Total samples (default 3000)")
    parser.add_argument("--seed", type=int, default=42,   help="Random seed (default 42)")
    parser.add_argument("--out",  type=str, default="dataset.csv", help="Output file")
    args = parser.parse_args()

    print(f"Generating {args.n} samples (seed={args.seed})...")
    df = generate(n_total=args.n, seed=args.seed)

    out_path = Path(args.out)
    df.to_csv(out_path, index=False)
    print(f"Saved → {out_path}")
    print_summary(df)
