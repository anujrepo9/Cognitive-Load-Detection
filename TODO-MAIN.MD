# CogniLoad — Implementation Roadmap

> AI-powered Cognitive Load Detection System
> Backend (FastAPI) + Windows Collector + React Frontend

---

## Current State Analysis

### ✅ What Exists
| Area | Status |
|------|--------|
| Backend (FastAPI) | ✅ Working — `main.py`, `start.py` unified launcher, CORS, lifespan startup |
| Auth | ✅ Register / Login / Profile with JWT (HS256) + bcrypt |
| Database | ✅ SQLite via SQLAlchemy — `users`, `sessions`, `behavior_data`, `predictions` |
| Behavior API | ✅ `POST /behavior` — stores 16 feature vectors per session |
| Prediction API | ✅ `POST /predict` — rule-based fallback (no trained model) |
| Dashboard API | ✅ `GET /dashboard`, `GET /history` |
| Recommendation API | ✅ `GET /recommendation` — rule-based engine |
| Collector (raw) | ✅ EventBuffer (thread-safe), Keyboard/Mouse listeners, metrics.py, CSVWriter |
| ML Dataset | ✅ `ml/datasets/train.csv` (~3000 synthetic rows) + `generate_data.py` |
| Frontend Pages | ✅ All 10 pages rendered (Dashboard, Live, History, Analytics, Reports, Recommendations, Settings, Profile, Login, Register) |
| Frontend API client | ✅ Axios with JWT interceptor + `useBehaviorTracker` hook |

### ⚠️ Partial / Broken
| Area | Issue |
|------|-------|
| ML Model | ❌ No trained model file — `predictor.py` silently falls back to rule-based |
| Reports page | ❌ Uses hardcoded mock data — no backend `GET /reports` |
| Profile page | ❌ "Save changes" only sets a local flag — no API call |
| Settings page | ❌ Saves to localStorage only — no user preferences backend |
| Dashboard session metrics | ❌ `typing_events`, `mouse_events`, `avg_wpm`, `model_version` show "—" (backend doesn't return them) |
| Live Monitoring | ❌ Polls every 5s — no WebSocket/SSE real-time push |
| Collector → API | ✅ `--api` flag now supports auth token, buffered retry, offline queue (Phase 4) |
| Session lifecycle | ❌ Sessions never get `end_time` set — always "active" |
| Prediction storage | ❌ `POST /predict` stores prediction but not the raw behavior record |
| Preprocessing | ❌ `preprocessing/__init__.py` is empty — no pipeline |
| User profile | ✅ PATCH `/auth/profile` added (Phase 3) |

### ❌ Missing Entirely
- WebSocket / Server-Sent Events for live dashboard updates
- Model training script (`ml/train.py`)
- Docker / production deployment config
- Analytics endpoints for deeper trends (per-day, per-feature)
- Report generation endpoint (PDF/CSV export)
- User preferences / settings persistence

---

## Phase 1 — Project Analysis ✅ (DONE)

- [x] Inspect frontend — all pages, API client, hooks, contexts
- [x] Inspect backend — routes, services, models, auth, config
- [x] Inspect collector — buffer, listeners, metrics, CSV writer
- [x] Inspect ML pipeline — dataset, generator, predictor fallback
- [x] Document current architecture (table above)

## Phase 2 — Backend Foundation ✅ (DONE)

- [x] Add centralized logging config (`backend/core/logging.py`) with rotating file + console handlers
- [x] Add global exception handler + structured error responses (`backend/core/errors.py`)
- [x] Add request validation middleware (enforce sane JSON body sizes, reject unknown fields)
- [x] Add `backend/core/__init__.py` and `backend/core/config.py` wrapper around `config.py`
- [x] Add `.env.example` entries for: `JWT_REFRESH_SECRET`, `REFRESH_TOKEN_EXPIRE_DAYS`, `WS_ENABLED`, `MODEL_*`
- [x] Add graceful shutdown (close DB engine, stop background tasks) in `main.py` lifespan

## Phase 3 — Authentication Hardening ✅ (DONE)

- [x] Add refresh token flow:
  - [x] `POST /auth/refresh` — issue new access token from refresh token
  - [x] `POST /auth/logout` — revoke refresh token
  - [x] Store refresh token (hashed) in `refresh_tokens` table
- [x] Add `PATCH /auth/profile` — update name/email
- [x] Add `POST /auth/change-password`
- [x] Rate-limit login/register endpoints (in-memory sliding window)
- [x] Email verification — skipped (out of scope)

## Phase 4 — Windows Background Collector ✅ (DONE)

- [x] Add `backend/collector/autostart.py` — register a Windows startup entry (registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`)
- [x] Add tray icon support (`pystray`) — optional (`--tray` flag)
- [x] Add local JSONL queue for offline buffering:
  - [x] `backend/collector/offline_queue.py` — persistent queue with retry (renamed from `queue.py` to avoid stdlib shadowing)
  - [x] On failure, store feature row locally; retry on next flush
  - [x] On success, clear queued rows
- [x] Add config file for collector (`collector_config.json`):
  - [x] `flush_interval` (default 15s)
  - [x] `api_url`, `api_token` (JWT from login)
  - [x] `offline_mode` (bool)
  - [x] `start_on_login` (bool)
- [x] Add `--daemon` flag to run as background process (no console window on Windows)
- [x] Add mouse path / acceleration tracking in `mouse_listener.py` (store path segments, compute acceleration)
- [x] Add hover-time tracking (time between mouse-down and mouse-up on same element region)
- [x] Add secure token storage (DPAPI on Windows via `keyring`) — `secure_store.py`
- [x] Add `--save-token`, `--start-on-login`, `--stop-on-login`, `--offline`, `--online-predict` CLI flags
- [x] Add `collector_config.example.json` template
- [x] Extend `test_collector.py` with queue/config/secure-store tests (15 passing)

## Phase 5 — API Development

- [x] `POST /behavior` — also store the raw feature row when a prediction is requested (link prediction ↔ behavior)
- [x] Add `POST /session/end` — close the active session (set `end_time`)
- [x] Add `GET /session/current` — return active session + latest prediction
- [x] Add `GET /reports/daily` — aggregate per-day stats (avg load, sessions, WPM trend)
- [x] Add `GET /reports/weekly` — weekly summary
- [x] Add `GET /reports/export` — CSV export of behavior + predictions
- [x] Add `GET /analytics/trends` — time-series of load levels, feature correlation
- [x] Add `GET /analytics/features` — per-feature distribution over time
- [x] Add `GET /settings` + `PUT /settings` — user preferences (notification on/off, interval, theme)
- [x] Add `PATCH /auth/profile` — (see Phase 3)
- [x] Add pagination + date filtering to `GET /history`

## Phase 6 — AI Pipeline

- [x] Create `ml/train.py` — train a classifier (RandomForest / GradientBoosting) on `train.csv`
- [x] Save model + feature order + scaler to `ml/saved_models/model.joblib` (and `scaler.joblib`)
- [x] Update `backend/config.py` — `MODEL_PATH`, `SCALER_PATH`
- [x] Implement `backend/preprocessing/pipeline.py`:
  - [x] Load scaler, apply transform
  - [x] Handle missing/zero features (impute with 0)
  - [x] Feature selection / validation
- [x] Update `backend/services/predictor.py`:
  - [x] Use preprocessing pipeline before `model.predict_proba`
  - [x] Add model metadata (version, trained_at, accuracy) endpoint `GET /model/info`
  - [x] Add confidence calibration (e.g., `calibrated_classifier_cv`)
- [x] Add periodic model retraining script `ml/retrain.py` (reads collected `behavior_data` from CSV/DB)

## Phase 7 — Real-Time Communication

- [ ] Add WebSocket support:
  - [ ] `backend/routes/ws.py` — `/ws/predictions` endpoint with JWT auth
  - [ ] Connection manager (track active clients per user)
  - [ ] Broadcast new predictions to subscribed clients
  - [ ] Heartbeat ping/pong every 30s
- [ ] Frontend:
  - [ ] `frontend/src/hooks/useWebSocket.js` — connect, auto-reconnect with backoff
  - [ ] Dashboard + LiveMonitoring subscribe to live prediction stream
  - [ ] Replace polling (`behaviorAPI.predict`) with WebSocket push where possible
  - [ ] Show connection status indicator (connected / reconnecting / offline)

## Phase 8 — Frontend Integration

- [ ] **Reports.jsx** — replace mock data with real `GET /reports/daily` + `GET /reports/weekly`
- [ ] **Profile.jsx** — wire "Save changes" to `PATCH /auth/profile`
- [ ] **Settings.jsx** — wire toggles to `GET/PUT /settings`; remove localStorage-only
- [ ] **Dashboard.jsx** — display real `typing_events`, `mouse_events`, `avg_wpm`, `model_version` from backend
- [ ] **LiveMonitoring.jsx** — use WebSocket stream; show real mouse event count
- [ ] **History.jsx** — add date-range filter + export button wired to `GET /reports/export`
- [ ] **Analytics.jsx** — add trend charts from `GET /analytics/trends`
- [ ] **api.js** — add refresh-token interceptor (auto-refresh on 401, retry original request)
- [ ] **useBehaviorTracker.js** — support configurable flush interval (from settings), send `session_id` with payloads
- [ ] Remove all remaining mock/dummy data across pages

## Phase 9 — Testing

- [ ] Backend unit tests (`pytest`):
  - [ ] `tests/test_auth.py` — register, login, profile, refresh, change-password
  - [ ] `tests/test_behavior.py` — POST /behavior validation
  - [ ] `tests/test_prediction.py` — rule-based + ML prediction
  - [ ] `tests/test_dashboard.py` — dashboard/history/reports/analytics
  - [ ] `tests/test_recommendation.py` — recommendation engine
  - [ ] `tests/test_ws.py` — WebSocket connect + broadcast
- [ ] Collector tests — extend `test_collector.py` for queue/retry/offline
- [ ] Frontend tests (Vitest + React Testing Library):
  - [ ] Login/Register flow
  - [ ] Dashboard rendering with mocked API
  - [ ] WebSocket hook
- [ ] Integration test — collector → API → DB → WebSocket → Dashboard
- [ ] Performance test — 100 concurrent WS clients, 1000 predictions

## Phase 10 — Production Readiness

- [ ] Add `Dockerfile` (backend) + `docker-compose.yml` (backend + postgres + frontend)
- [ ] Switch `DATABASE_URL` to PostgreSQL in production
- [ ] Add `alembic` migrations for schema versioning
- [ ] Add `uvicorn` workers config (gunicorn/uvicorn in prod)
- [ ] Add HTTPS / reverse-proxy config (Caddy or nginx)
- [ ] Add structured logging (JSON) + `Sentry`/`Logfire` optional
- [ ] Add health-check + readiness endpoints (already have `/health` — extend with DB/model status)
- [ ] Add CI/CD (GitHub Actions): lint → test → build → deploy
- [ ] Add `.env.production` template
- [ ] Secure JWT secrets, rotate keys, add `SECRET_KEY` enforcement (fail fast if default in prod)

---

## Execution Order

```
Phase 1 ✅ (analysis complete)
   ↓
Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10
```

> Work sequentially — complete one phase before starting the next.
> After each phase: explain what was implemented, list modified files, mark TODO items, suggest next phase.
