# 🧠 CogniLoad — Cognitive Load Detection

An AI-powered application that estimates a user's mental **cognitive load** (Low / Medium / High) in real time by analyzing **keyboard and mouse behavior**. Combines a FastAPI backend, a React frontend, and a scikit-learn ML model (with a rule-based fallback).

---

## ✨ Features

- **Real-time monitoring** — live predictions pushed via WebSocket after each flush interval, with confidence scores.
- **Session tracking** — start / pause / resume / end sessions; timer survives page navigation without losing elapsed time.
- **Behavioral signals** — 16 computed features from typing (WPM, hold/flight times, error rate, pauses) and mouse (speed, click rate, scroll rate, idle %).
- **ML classification** — predicts `low` / `medium` / `high` cognitive load; falls back to rule-based heuristics when no trained model is present.
- **Smart recommendations** — rule-based engine maps load level to actionable suggestions.
- **Secure auth** — JWT access + refresh tokens, bcrypt password hashing, rate limiting, auto-refresh on 401.
- **Analytics & reports** — trends, load distributions, daily/weekly reports, CSV export (Recharts).
- **Privacy-first** — all behavioral data stays in your own database.

---

## 🧱 Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python · FastAPI · SQLAlchemy · scikit-learn · joblib · python-jose · bcrypt · pynput |
| **Frontend** | React 19 · Vite · Tailwind CSS · Recharts · Framer Motion · axios |
| **Database** | SQLite (default) · PostgreSQL via `DATABASE_URL` |
| **Real-time** | WebSocket (`/ws/predictions`) · per-user broadcast · heartbeat ping/pong |

---

## 📁 Project Structure

```
backend/
  api/              # Pydantic schemas (UTC-aware datetime serialization)
  auth/             # JWT access + refresh token logic
  collector/        # Standalone keyboard/mouse data collector (pynput)
  core/             # Config, logging, error handlers, middleware, rate limiting
  database/         # SQLAlchemy models & engine
  preprocessing/    # Feature pipeline
  recommendations/  # Rule-based recommendation engine
  routes/           # auth, behavior, prediction, session, dashboard,
                    # analytics, reports, recommendation, settings, ws
  services/         # ML predictor (scikit-learn + rule-based fallback)
  tests/            # pytest test suite (auth, behavior, prediction)
  main.py           # FastAPI app entry point
  start.py          # One-command launcher (backend + optional frontend)

frontend/
  src/
    pages/          # Dashboard, LiveMonitoring, Analytics, History,
                    # Reports, Recommendations, Profile, Settings,
                    # Login, Register, Landing
    components/     # UI kit (StatCard, LoadBadge, ChartCard, …) + layout
    context/        # AuthContext, TrackingContext, ThemeContext
    hooks/          # useSessionTracker, useBehaviorTracker,
                    # useWebSocket, useAuthFetch
    services/       # api.js — axios client with JWT interceptor + refresh retry

ml/
  datasets/         # train.csv (~3000 synthetic labeled rows)
  saved_models/     # model.joblib + scaler.joblib (after training)

generate_data.py    # Synthetic dataset generator
```

---

## 🚀 Getting Started

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows:   venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # edit SECRET_KEY and JWT_REFRESH_SECRET at minimum

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

### 3. One-command launcher

```bash
python backend/start.py           # backend only
python backend/start.py --full    # backend + frontend, opens browser
```

### 4. Data collector (optional — desktop background agent)

```bash
cd backend/collector
pip install -r requirements.txt
python main.py --api   # collect keyboard/mouse events and POST to backend
```

### 5. Train the ML model (optional)

Without a trained model the backend uses the rule-based fallback predictor automatically.

```bash
# Generate synthetic training data
python generate_data.py              # 3 000 samples → dataset.csv
python generate_data.py --n 5000 --seed 99

# Train (places artifacts in ml/saved_models/)
python ml/train.py
```

---

## 🔑 Environment Variables

Copy `backend/.env.example` to `backend/.env`. Key variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./cogniload.db` | DB connection string |
| `SECRET_KEY` | *(change this)* | JWT access-token signing secret |
| `JWT_REFRESH_SECRET` | *(change this)* | JWT refresh-token signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token TTL |
| `MODEL_PATH` | `ml/saved_models/model.joblib` | Trained classifier |
| `SCALER_PATH` | `ml/saved_models/scaler.joblib` | Feature scaler |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins |
| `WS_ENABLED` | `true` | Enable WebSocket broadcast |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

---

## 🧪 ML Model

The classifier is trained on **16 keyboard + mouse features**:

| Category | Features |
|---|---|
| Typing | WPM, chars/min, avg hold ms, avg flight ms, error rate, pause count, avg pause ms, typing variance |
| Mouse | avg cursor speed, movement distance, click rate, double-click rate, scroll rate, idle time %, avg hover ms, movement smoothness |

If no model file exists at `MODEL_PATH`, the predictor falls back to a deterministic rule-based classifier automatically — no manual configuration needed.

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Get access + refresh tokens |
| `POST` | `/auth/refresh` | Rotate refresh token |
| `GET/PATCH` | `/auth/profile` | View / update profile |
| `POST` | `/auth/change-password` | Change password |
| `POST` | `/session/start` | Start or resume active session |
| `GET` | `/session/current` | Active session + latest prediction |
| `POST` | `/session/end` | End active session |
| `POST` | `/predict` | Submit behavior window → prediction + WS broadcast |
| `GET` | `/dashboard` | Aggregated stats for dashboard |
| `GET` | `/analytics/trends` | Load trend over time |
| `GET` | `/analytics/features` | Feature importance breakdown |
| `GET` | `/reports/daily` | Daily report |
| `GET` | `/reports/weekly` | Weekly report |
| `GET` | `/reports/export` | CSV export |
| `GET` | `/recommendation` | Actionable suggestions for current load |
| `GET/PUT` | `/settings` | User preferences (flush interval, theme, …) |
| `WS` | `/ws/predictions` | Real-time prediction stream (JWT via `?token=`) |

---

## 🐛 Known Fixes (recent)

### Session timer resets to 0 on page navigation
**Symptom:** Navigating away from Live Monitoring / Dashboard and returning showed the session timer starting from 0 even though the backend session was still running.

**Root cause:** React refs initialize from their `useRef(initialValue)` on every remount. The `useEffect` that re-anchors the timer only fires when deps *change* — but `session_id` hadn't changed (session still live in context), so the effect never fired.

**Fix (`LiveMonitoring.jsx`, `Dashboard.jsx`):** Refs are now seeded at declaration time using `start_time` (UTC-safe — backend always serialises with a `Z` suffix via Pydantic's `_as_utc` validator), so the timer resumes at the correct offset the instant the component mounts.

### Session timer shows +330 minutes on start (IST / GMT+5:30)
**Symptom:** On session start the timer immediately showed ~330 minutes elapsed for users in IST.

**Root cause:** SQLite returns naive `datetime` objects (no timezone info). Without the `Z` suffix, `new Date(start_time)` in JavaScript parses the string as **local time**, adding the local UTC offset to the elapsed calculation.

**Fix:** Backend `schemas.py` already had a `_as_utc` Pydantic validator that attaches `timezone.utc` to naive datetimes before serialisation, ensuring the JSON output always ends with `Z`. Frontend now additionally uses `session.duration_seconds` (pre-computed server-side) as the base offset, making the timer immune to any timezone parsing edge case.

### WPM chart blank / error with single data point
**Symptom:** The typing speed chart on Live Monitoring showed nothing or threw a rendering error when only one WPM reading had been collected.

**Root cause:** Recharts `LineChart` cannot draw a line with fewer than 2 data points; the `YAxis` also produced erratic auto-ticks on a narrow value range.

**Fix (`LiveMonitoring.jsx`):** Added `dot` prop that renders a visible circle for single-point sessions; disabled enter animation for single points (`isAnimationActive`); added a padded `domain` function to `YAxis` so ticks are always sensibly spaced.

---

## 🪟 Windows EXE Build

CogniLoad can be packaged as a standalone Windows executable (no Python or Node.js required on the target machine) using PyInstaller + an optional Inno Setup installer.

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) [Inno Setup 6](https://jrsoftware.org/isdl.php) — only needed to produce a `CogniLoad_Setup.exe` installer; the portable `.exe` is built regardless.

### Steps

**1. Rename the build script** — GitHub strips `.bat` on upload, so the file ships as `build_windows.bat.txt`. Rename it before running:

```
# In File Explorer: rename scriptsuild_windows.bat.txt → scriptsuild_windows.bat
# Or in PowerShell (run from project root):
Rename-Item scriptsuild_windows.bat.txt build_windows.bat
```

**2. Run the build pipeline** (from project root in PowerShell / CMD):

```powershell
.\scriptsuild_windows.bat
```

The script automatically:
1. Activates `.venv` if present
2. Installs Python dependencies (`backend
equirements.txt`) + `pyinstaller`, `pystray`, `Pillow`
3. Builds the React frontend (`npm run build → frontend\dist`)
4. Generates a placeholder icon if `resources\icon.ico` is missing
5. Runs PyInstaller via `cogniload.spec` → `dist\CogniLoad\`
6. Compiles the Inno Setup installer → `installer\Output\CogniLoad_Setup_1.0.0.exe` *(if Inno Setup is installed; skipped otherwise with a warning)*

**3. Launch the app:**

```powershell
.\dist\CogniLoad\CogniLoad.exe
```

### Build outputs

| Path | Description |
|---|---|
| `dist\CogniLoad\CogniLoad.exe` | Portable executable (run directly, no install needed) |
| `installer\Output\CogniLoad_Setup_1.0.0.exe` | Full installer (requires Inno Setup during build) |

> **Note:** If Inno Setup is not installed the build still completes successfully — only the installer step is skipped. The portable `dist\CogniLoad\CogniLoad.exe` is always produced.

---

## 🗺️ Roadmap

| Phase | Status |
|---|---|
| 1 — Project analysis | ✅ Done |
| 2 — Backend foundation | ✅ Done |
| 3 — Auth hardening | ✅ Done |
| 4 — Desktop collector | ✅ Done |
| 5 — API development | ✅ Done |
| 6 — AI pipeline | ✅ Done |
| 7 — Real-time WebSocket | ✅ Done |
| 8 — Full frontend integration | ✅ Done |
| 9 — Test suite | 🔲 Pending |
| 10 — Production / Docker | 🔲 Pending |

---

## 📄 License

MIT