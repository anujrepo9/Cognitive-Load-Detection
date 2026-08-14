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
| Prediction API | ✅ `POST /predict` — ML model + rule-based fallback; broadcasts over WS |
| Dashboard API | ✅ `GET /dashboard`, `GET /history` |
| Recommendation API | ✅ `GET /recommendation` — rule-based engine |
| Collector (raw) | ✅ EventBuffer (thread-safe), Keyboard/Mouse listeners, metrics.py, CSVWriter |
| ML Dataset | ✅ `ml/datasets/train.csv` (~3000 synthetic rows) + `generate_data.py` |
| Frontend Pages | ✅ All 10 pages fully wired — no mock data remaining |
| Frontend API client | ✅ Axios with JWT interceptor + refresh-token auto-retry + `useBehaviorTracker` hook |
| WebSocket | ✅ `/ws/predictions` — JWT auth, per-user broadcast, heartbeat ping/pong, auto-reconnect |

### ⚠️ Partial / Broken
| Area | Issue |
|------|-------|
| ML Model | ⚠️ No trained model file — `predictor.py` falls back to rule-based (run `ml/train.py` to fix) |
| Session lifecycle | ⚠️ Sessions get `end_time` set via `POST /session/end`; clients must call it on unload |

### ❌ Missing Entirely
- Docker / production deployment config (Phase 10)
- Full test suite (Phase 9)

---

## Phase 1 — Project Analysis ✅ (DONE)
## Phase 2 — Backend Foundation ✅ (DONE)
## Phase 3 — Authentication Hardening ✅ (DONE)
## Phase 4 — Windows Background Collector ✅ (DONE)
## Phase 5 — API Development ✅ (DONE)
## Phase 6 — AI Pipeline ✅ (DONE)

## Phase 7 — Real-Time Communication ✅ (DONE)

- [x] Add WebSocket support:
  - [x] `backend/routes/ws.py` — `/ws/predictions` endpoint with JWT auth (query param `?token=`)
  - [x] Connection manager (track active clients per user, `defaultdict(set)`)
  - [x] Broadcast new predictions to subscribed clients (fired from `POST /predict` background task)
  - [x] Heartbeat ping/pong every 30s; 60s idle timeout triggers reconnect
- [x] Frontend:
  - [x] `frontend/src/hooks/useWebSocket.js` — connect, auto-reconnect with exponential back-off (cap 30s)
  - [x] Dashboard subscribes to live prediction stream (replaces `setInterval` polling)
  - [x] LiveMonitoring subscribes to live prediction stream (replaces `setInterval` polling)
  - [x] Connection status indicator on both pages (connected / reconnecting / offline)

## Phase 8 — Frontend Integration ✅ (DONE)

- [x] **Reports.jsx** — wired to real `GET /reports/daily` + `GET /reports/weekly` + CSV export
- [x] **Profile.jsx** — "Save changes" calls `PATCH /auth/profile`; change-password calls `POST /auth/change-password`; updates AuthContext user in-memory
- [x] **Settings.jsx** — wired to `GET /settings` (load on mount) + `PUT /settings` (save); removed localStorage-only
- [x] **Dashboard.jsx** — real `typing_events`, `mouse_events`, `avg_wpm`, `model_version` from backend; WS-driven updates
- [x] **LiveMonitoring.jsx** — WebSocket stream; real mouse event count; WS status indicator
- [x] **History.jsx** — date-range filter + export button wired to `GET /reports/export` ✅ (was already wired)
- [x] **Analytics.jsx** — trend charts from `GET /analytics/trends`; feature stats from `GET /analytics/features`; time-range selector
- [x] **api.js** — refresh-token interceptor (auto-refresh on 401, retry original request, queue concurrent requests)
- [x] **useBehaviorTracker.js** — configurable flush interval from `GET /settings`; sends to `/predict` (drives WS broadcast)
- [x] All mock/dummy data removed across pages

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
Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4 ✅ → Phase 5 ✅ → Phase 6 ✅ → Phase 7 ✅ → Phase 8 ✅ → Phase 9 → Phase 10
```

> Work sequentially — complete one phase before starting the next.
> After each phase: explain what was implemented, list modified files, mark TODO items, suggest next phase.
