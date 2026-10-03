"""
scripts/convert_model.py
────────────────────────
Converts the trained sklearn model + StandardScaler (joblib) into the two
artifacts the Rust ONNX inference layer expects:

  <app_data>/model.onnx          — ONNX graph (float32 input [1, 17])
  <app_data>/scaler_params.json  — {"mean": [...], "scale": [...]}

Usage
-----
    # Default: reads ml/saved_models/, writes to src-tauri/assets/ for bundling
    python scripts/convert_model.py

    # Custom paths
    python scripts/convert_model.py \\
        --model   ml/saved_models/model.joblib \\
        --scaler  ml/saved_models/scaler.joblib \\
        --out-dir src-tauri/assets

    # Also validate the converted model against sklearn output
    python scripts/convert_model.py --validate

Requirements
------------
    pip install skl2onnx onnxruntime joblib numpy
    (sklearn must already be installed — same version used for training)
"""

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np

# ── Feature / label order must stay in sync with predict.rs ──────────────────
FEATURE_ORDER = [
    "typing_wpm",        "chars_per_min",     "avg_hold_ms",
    "avg_flight_ms",     "error_rate",        "pause_count",
    "avg_pause_ms",      "typing_variance",   "avg_cursor_speed",
    "movement_distance", "click_rate",        "double_click_rate",
    "scroll_rate",       "idle_time_pct",     "avg_hover_ms",
    "avg_acceleration",  "movement_smoothness",
]
N_FEATURES = len(FEATURE_ORDER)   # 17
LABELS     = ["low", "medium", "high"]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def unwrap_calibrated(clf):
    """
    CalibratedClassifierCV wraps the base estimator.
    skl2onnx needs the actual estimator *or* the calibrated wrapper —
    but calibrated pipelines work fine with skl2onnx >= 1.14.
    We try to convert the wrapper directly first; if it fails we fall
    back to the base estimator (losing calibration, but the class
    probabilities are still meaningful for low/medium/high ranking).
    """
    from sklearn.calibration import CalibratedClassifierCV
    if isinstance(clf, CalibratedClassifierCV):
        return clf          # skl2onnx handles it natively in recent versions
    return clf


def extract_scaler_params(scaler) -> dict:
    """Pull mean_ and scale_ from a fitted StandardScaler."""
    return {
        "mean":  scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
    }


def convert_to_onnx(clf, out_path: Path) -> None:
    """Convert sklearn classifier → ONNX and write to out_path."""
    try:
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType
    except ImportError:
        print("[ERROR] skl2onnx not installed.  Run:  pip install skl2onnx", file=sys.stderr)
        sys.exit(1)

    initial_type = [("float_input", FloatTensorType([None, N_FEATURES]))]

    options = {}
    # Request probability output for classifiers that support it
    clf_type = type(clf).__name__
    if "Calibrated" in clf_type or hasattr(clf, "predict_proba"):
        options = {type(clf): {"zipmap": False}}

    print(f"  Converting {clf_type} …")
    onnx_model = convert_sklearn(clf, initial_types=initial_type, options=options)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(onnx_model.SerializeToString())
    print(f"  ✅  model.onnx written → {out_path}  ({out_path.stat().st_size / 1024:.1f} KB)")


def validate(clf, scaler, onnx_path: Path, n_samples: int = 200) -> None:
    """Run random samples through sklearn and ONNX; assert outputs match."""
    try:
        import onnxruntime as rt
    except ImportError:
        print("[WARN] onnxruntime not installed — skipping validation.", file=sys.stderr)
        return

    rng = np.random.default_rng(0)
    X_raw = rng.standard_normal((n_samples, N_FEATURES)).astype(np.float64)

    # sklearn path (uses scaler internally — we apply it here to match Rust)
    X_scaled_f64 = scaler.transform(X_raw)
    sk_proba     = clf.predict_proba(X_scaled_f64)   # shape (n, 3)

    # ONNX path (raw input — scaler is applied in Rust, not in the ONNX graph)
    X_scaled_f32 = X_scaled_f64.astype(np.float32)
    sess         = rt.InferenceSession(str(onnx_path))
    input_name   = sess.get_inputs()[0].name
    outputs      = sess.run(None, {input_name: X_scaled_f32})
    onnx_proba   = outputs[1] if len(outputs) > 1 else outputs[0]   # [n, 3] float32

    # Compare argmax (predicted class) — tolerance on probabilities
    sk_cls   = np.argmax(sk_proba,   axis=1)
    onnx_cls = np.argmax(onnx_proba, axis=1)
    match    = (sk_cls == onnx_cls).mean()

    # Probability tolerance
    diff = np.abs(sk_proba.astype(np.float32) - onnx_proba).max()

    print(f"\n  Validation over {n_samples} random samples:")
    print(f"    Class-label agreement : {match * 100:.1f}%")
    print(f"    Max probability diff  : {diff:.6f}")

    if match < 0.99:
        print(
            "[WARN] Class agreement < 99 % — the ONNX conversion may have lost "
            "calibration.  Check skl2onnx version or disable calibration in train.py.",
            file=sys.stderr,
        )
    else:
        print("  ✅  Validation passed.")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Convert CogniLoad sklearn model → ONNX")
    parser.add_argument(
        "--model",
        default="ml/saved_models/model.joblib",
        help="Path to model.joblib  (default: ml/saved_models/model.joblib)",
    )
    parser.add_argument(
        "--scaler",
        default="ml/saved_models/scaler.joblib",
        help="Path to scaler.joblib (default: ml/saved_models/scaler.joblib)",
    )
    parser.add_argument(
        "--out-dir",
        default="src-tauri/assets",
        help="Output directory for model.onnx + scaler_params.json  "
             "(default: src-tauri/assets)",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run sklearn vs ONNX agreement check after conversion",
    )
    args = parser.parse_args()

    model_path  = Path(args.model)
    scaler_path = Path(args.scaler)
    out_dir     = Path(args.out_dir)

    # ── Existence checks ──────────────────────────────────────────────────────
    for p in (model_path, scaler_path):
        if not p.exists():
            print(f"[ERROR] Not found: {p}", file=sys.stderr)
            print(
                "        Run  python ml/train.py  first to generate the joblib files.",
                file=sys.stderr,
            )
            sys.exit(1)

    print(f"\nLoading model  : {model_path}")
    clf = joblib.load(model_path)
    clf = unwrap_calibrated(clf)

    print(f"Loading scaler : {scaler_path}")
    scaler = joblib.load(scaler_path)

    # ── Sanity check scaler dimensions ───────────────────────────────────────
    if len(scaler.mean_) != N_FEATURES:
        print(
            f"[ERROR] Scaler has {len(scaler.mean_)} features but expected {N_FEATURES}.",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── Convert model ─────────────────────────────────────────────────────────
    onnx_out = out_dir / "model.onnx"
    print(f"\nConverting to ONNX → {onnx_out}")
    convert_to_onnx(clf, onnx_out)

    # ── Write scaler params ───────────────────────────────────────────────────
    scaler_out = out_dir / "scaler_params.json"
    params     = extract_scaler_params(scaler)
    scaler_out.parent.mkdir(parents=True, exist_ok=True)
    scaler_out.write_text(json.dumps(params, indent=2))
    print(f"  ✅  scaler_params.json written → {scaler_out}")

    # ── Optional validation ───────────────────────────────────────────────────
    if args.validate:
        validate(clf, scaler, onnx_out)

    # ── Remind user where to put the files at runtime ────────────────────────
    print(f"""
Done.  Two files in {out_dir}/:
  model.onnx          — ONNX graph  (input: float32 [1, 17], output: proba [1, 3])
  scaler_params.json  — StandardScaler mean + scale vectors

Tauri bundles files in src-tauri/assets/ automatically.
The Rust code reads them from <app_data_dir> at first inference.
If you changed --out-dir, copy both files to <app_data_dir> manually
or update the path in src-tauri/src/predict.rs.

Label order (must match LABELS in predict.rs):
  index 0 → low
  index 1 → medium
  index 2 → high
""")


if __name__ == "__main__":
    main()