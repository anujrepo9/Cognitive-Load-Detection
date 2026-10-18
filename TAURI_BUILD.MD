# CogniLoad — Tauri Build Steps (Windows)

The src-tauri/ scaffold is already in your project. Follow these steps in order.

---

## Step 1 — Install Prerequisites (once)

Install Rust:
```bat
winget install Rustlang.Rustup
rustup default stable
rustup target add x86_64-pc-windows-msvc
```

Install Node 20+ if not already installed:
```bat
winget install OpenJS.NodeJS.LTS
```

Install NSIS (for installer):
```bat
winget install NSIS.NSIS
```

Verify all three work:
```bat
rustc --version
cargo --version
node --version
```

WebView2 is already on Windows 10 21H2+ / Windows 11 — no action needed.

---

## Step 2 — Install JS deps (root workspace + frontend)

From the project root (where the root package.json is):
```bat
npm install
cd frontend
npm install
cd ..
```

---

## Step 3 — Get onnxruntime.dll

The Rust `ort` crate needs `onnxruntime.dll` at runtime (load-dynamic mode).

Download the Windows x64 DLL from the ONNX Runtime releases page:
  https://github.com/microsoft/onnxruntime/releases/latest

Look for: `onnxruntime-win-x64-<version>.zip`

Extract it, then copy `onnxruntime.dll` to:
```
src-tauri\resources\onnxruntime.dll
```

Create the folder if it doesn't exist:
```bat
mkdir src-tauri\resources
```

---

## Step 4 — Convert ML model to ONNX

Install Python conversion deps:
```bat
pip install skl2onnx onnxruntime joblib numpy
```

Train the model if you haven't yet:
```bat
python ml\train.py
```

Convert to ONNX (writes to src-tauri\assets\):
```bat
python scripts\convert_model.py --validate
```

This creates:
```
src-tauri\assets\model.onnx
src-tauri\assets\scaler_params.json
```

Create the assets folder first if needed:
```bat
mkdir src-tauri\assets
```

---

## Step 5 — Dev mode (hot-reload)

```bat
npm run dev
```

This starts Vite dev server + Tauri shell together.
The app window opens automatically.

> First run compiles all Rust crates — takes 2–5 minutes.
> Subsequent runs are much faster (incremental).

> Note: rdev hooks global keyboard/mouse input.
> If input collection fails, run the terminal as Administrator.

---

## Step 6 — Production build

```bat
npm run build
```

Outputs:
```
src-tauri\target\release\cognitive-load-detection.exe    ← standalone exe
src-tauri\target\release\bundle\nsis\CogniLoad_1.0.0_x64-setup.exe  ← installer
```

The installer requires no admin rights (currentUser mode).

---

## Delete these old files (no longer needed)

These are replaced by Rust — delete to avoid confusion:
```
frontend\src\hooks\useBehaviorTracker.js
frontend\src\hooks\useSessionTracker.js
frontend\src\hooks\useWebSocket.js
```

The Python backend/ and collector/ are not used in the Tauri build.
Keep them if you still want the web mode; they don't interfere.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `rdev` won't compile | Run `rustup update stable` |
| `ort` / onnxruntime errors at runtime | Make sure onnxruntime.dll is in src-tauri\resources\ |
| Blank white screen | Check WebView2: `winget install Microsoft.EdgeWebView2Runtime` |
| `model.onnx not found` at predict | Run step 4 (convert_model.py) |
| Cargo build fails on first run | Check `rustup target add x86_64-pc-windows-msvc` |
| Input not captured | Run terminal/app as Administrator |