# CogniLoad — Build Guide (Pure Rust Native)

No Python. No FastAPI. No sidecars. One `.exe`.

---

## Prerequisites (install once)

| Tool | Where |
|---|---|
| Rust + Cargo | https://rustup.rs — stable toolchain |
| Node.js 20+ | https://nodejs.org |
| WebView2 | Already on Windows 10 21H2+ / Windows 11. Otherwise: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ |
| NSIS (for installer) | `winget install NSIS.NSIS` |

Verify:
```bat
rustc --version
cargo --version
node --version
```

---

## One-time setup

### 1. Remove deleted files

Delete these from your project — they are fully replaced:

```
frontend/src/hooks/useBehaviorTracker.js   ← deleted (Rust collector replaces it)
frontend/src/hooks/useSessionTracker.js    ← deleted
frontend/src/hooks/useWebSocket.js         ← deleted
```

### 2. Install frontend deps

```bat
cd frontend
npm install
cd ..
```

This will also uninstall `axios` (removed from `package.json`).

### 3. Convert the ML model to ONNX

```bat
pip install skl2onnx onnxruntime joblib numpy

:: Train first if you haven't
python ml/train.py

:: Convert
python scripts/convert_model.py --validate
```

This writes two files to `src-tauri/assets/`:
- `model.onnx`
- `scaler_params.json`

Tauri bundles everything in `src-tauri/assets/` automatically. At first launch
the app copies them to `%APPDATA%\CogniLoad\` where the Rust code reads them.

> **If you don't have a trained model yet**, the app still runs — predictions
> will return an error until `model.onnx` is present. All other features work.

---

## Development (hot-reload)

```bat
cargo tauri dev
```

This starts Vite dev server + Tauri shell together.  
The Rust collector starts immediately and hooks into Windows input APIs.

> **Admin note**: `rdev` hooks global keyboard/mouse. On the first run Windows
> may show a UAC prompt. If input collection silently fails, run the app as
> Administrator once to allow the hook.

---

## Production build (.exe + NSIS installer)

```bat
cargo tauri build
```

Output:
```
src-tauri/target/release/cognitive-load-detection.exe   ← standalone exe
src-tauri/target/release/bundle/nsis/CogniLoad_1.0.0_x64-setup.exe   ← installer
```

The installer puts everything under `%LOCALAPPDATA%\CogniLoad\` (current user,
no admin required — `installMode: currentUser` in `tauri.conf.json`).

---

## File placement summary

Copy each changed file to its original path in the project:

```
src-tauri/Cargo.toml
src-tauri/tauri.conf.json
src-tauri/src/main.rs
src-tauri/src/collector.rs      ← NEW
src-tauri/src/session.rs
src-tauri/src/behavior.rs
src-tauri/src/predict.rs
src-tauri/src/settings.rs       ← NEW

frontend/package.json
frontend/src/services/api.js
frontend/src/context/AuthContext.jsx
frontend/src/context/TrackingContext.jsx
frontend/src/hooks/useTauri.js
frontend/src/pages/Login.jsx
frontend/src/pages/Register.jsx
frontend/src/pages/Dashboard.jsx
frontend/src/pages/History.jsx
frontend/src/pages/Settings.jsx
frontend/src/pages/Profile.jsx
frontend/src/pages/Recommendations.jsx
frontend/src/pages/Analytics.jsx
frontend/src/pages/Reports.jsx
frontend/src/pages/LiveMonitoring.jsx

scripts/convert_model.py        ← NEW
```

Files not listed above are **unchanged** — do not replace them.

---

## Architecture overview

```
┌─────────────────────────────────────────┐
│  Tauri shell (Rust)                     │
│                                         │
│  ┌─────────────┐   ┌─────────────────┐  │
│  │  collector  │   │  SQLite (WAL)   │  │
│  │  (rdev)     │──▶│  cogniload.db   │  │
│  └─────────────┘   └────────┬────────┘  │
│                             │           │
│  ┌─────────────┐            │           │
│  │  ONNX       │◀───────────┘           │
│  │  inference  │                        │
│  └─────────────┘                        │
│        │                                │
│   invoke() IPC                          │
│        │                                │
│  ┌─────▼───────────────────────────┐    │
│  │  React + Vite (WebView2)        │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- **No HTTP server** — all communication is Tauri `invoke()` IPC (same process)
- **No Python** — collector is native Rust (`rdev`), ML is ONNX (`ort`)
- **No WebSocket** — predictions are pushed via the flush timer → `invoke()`
- **SQLite WAL** — concurrent reads from UI thread + writes from collector thread are safe

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `rdev` doesn't capture input | Run as Administrator once; Windows requires elevated permissions for global hooks |
| `model.onnx not found` | Run `python scripts/convert_model.py` and check `src-tauri/assets/` |
| `cargo tauri build` fails on `ort` | Install [ONNX Runtime DLL](https://github.com/microsoft/onnxruntime/releases) and add to PATH, or use `ort` feature `load-dynamic = false` to statically link |
| Blank white screen on launch | Check WebView2 is installed (`winget install Microsoft.EdgeWebView2Runtime`) |
| `rdev` compile error | Run `rustup update stable` — rdev needs a recent stable toolchain |