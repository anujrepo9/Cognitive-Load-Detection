# 🧠 CogniLoad — Cognitive Load Detection

An AI-powered application that estimates a user's mental **cognitive load** (Low / Medium / High) in real time by analyzing **keyboard and mouse behavior**. It combines a FastAPI backend, a React frontend, and a scikit-learn ML model (with a rule-based fallback).

## ✨ Features

- **Real-time monitoring** — live predictions from typing and mouse activity with confidence scores.
- **Behavioral collector** — captures keyboard/mouse events via `pynput` and computes 16 features.
- **ML classification** — predicts `low` / `medium` / `high` cognitive load (falls back to heuristics before a model is trained).
- **Smart recommendations** — rule-based engine maps load level to actionable suggestions.
- **Secure auth** — JWT access + refresh tokens, bcrypt password hashing, rate limiting.
- **Analytics dashboard** — trends, distributions, history, and reports (Recharts).
- **Privacy-first** — behavioral data stays in your own database.

## 🧱 Tech Stack

**Backend** — Python · FastAPI · SQLAlchemy · scikit-learn · joblib · JWT (python-jose) · pynput
**Frontend** — React 19 · Vite · Tailwind CSS · Recharts · Framer Motion · axios
**Database** — SQLite (default) / PostgreSQL via `DATABASE_URL`

## 📁 Project Structure

```
backend/            # FastAPI application
  api/              #  Pydantic schemas
  auth/             #  JWT auth
  collector/        #  Keyboard/mouse data collector (pynput)
  core/             #  config, logging, errors, middleware
  database/         #  SQLAlchemy models & engine
  recommendations/  #  recommendation engine
  routes/           #  auth, behavior, prediction, dashboard, recommendation
  services/         #  ML predictor
frontend/           # React + Vite SPA
  src/pages/        # Dashboard, LiveMonitoring, Analytics, History, Reports…
  src/components/   # UI components, layout
ml/                 # datasets (train.csv) & model artifacts
generate_data.py    # synthetic labeled dataset generator
dataset.csv         # generated dataset
```

## 🚀 Getting Started

### Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- API docs (Swagger): `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: `http://localhost:5173`

### One-command launcher

```bash
python backend/start.py          # backend only
python backend/start.py --full   # backend + frontend, opens browser
```

### Data collector (optional)

```bash
cd backend/collector
pip install -r requirements.txt
python main.py --api   # collect + send to backend
```

### Generate training data (optional)

```bash
python generate_data.py          # 3000 samples → dataset.csv
python generate_data.py --n 5000 --seed 99
```

## 🔑 Environment

Copy `backend/.env.example` to `backend/.env` and adjust if needed. Key variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./cogniload.db` | Database connection |
| `SECRET_KEY` | `dev-secret-change-me` | JWT signing secret (change in production) |
| `MODEL_PATH` | `ml/saved_models/model.joblib` | Trained model location |

## 🧪 Model

The classifier is trained on 16 keyboard + mouse features (typing WPM, hold/flight times, error rate, cursor speed, click/scroll rates, idle time, etc.). If no trained model exists, the API uses a rule-based predictor until one is added at `MODEL_PATH`.

