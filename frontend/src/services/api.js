/**
 * api.js — Universal API adapter for CogniLoad
 *
 * Works across THREE environments without any code changes:
 *
 *  1. Tauri desktop shell  (window.__TAURI__ present)
 *     → invoke() calls Rust commands directly.
 *
 *  2. PyInstaller .exe  (Edge opens http://127.0.0.1:8000)
 *     → fetch() with absolute URL: http://127.0.0.1:8000/api/...
 *
 *  3. Uvicorn dev  (Vite on :5173 proxies /api → :8000)
 *     → fetch() with root-relative /api/... (Vite proxy handles it)
 */

// ── Runtime detection ─────────────────────────────────────────────────────────

/**
 * isTauri() — lazy function, evaluated on FIRST CALL not at module load time.
 *
 * WHY this must be a function, not a top-level const:
 *
 *   tauri.conf.json sets `withGlobalTauri: true`, which tells the Tauri runtime
 *   to inject `window.__TAURI__` synchronously into the WebView page BEFORE the
 *   HTML document is parsed — but AFTER the Vite JS bundle's own module
 *   evaluation.  `window.__TAURI_INTERNALS__` is injected even earlier (Tauri 2
 *   only).  The net result is:
 *
 *     • When JavaScript evaluates `const IS_TAURI = "__TAURI__" in window`
 *       at the TOP LEVEL of this module (import time), the Tauri globals may not
 *       yet exist → IS_TAURI = false → every auth / session / behavior call
 *       falls through to HTTP fetch → "Backend unreachable:
 *       error sending request for url (http://127.0.0.1:8000/api/auth/signin)".
 *
 *     • By the time any async function body runs (e.g. authAPI.login()),
 *       Tauri has completed its synchronous injection, so the check then returns
 *       true correctly.
 *
 *   Converting to a lazy function means the detection runs exactly when the
 *   result is needed — inside async call-sites — and the race disappears.
 *
 * The PyInstaller .exe opens a plain Edge/Chrome window (no WebView injection).
 * Both globals remain absent at all times → isTauri() returns false → HTTP.
 *
 * Cache: once we detect Tauri we cache true; once we detect non-Tauri we also
 * cache false (the environment cannot change after page load).
 */
let _isTauriCache = null
export function isTauri() {
  if (_isTauriCache !== null) return _isTauriCache
  _isTauriCache =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  return _isTauriCache
}

/**
 * Resolve the API base URL once at startup.
 *
 * Rules:
 *  - Tauri:     not used (invoke() bypasses HTTP entirely)
 *  - Port 5173/3000/4173 (Vite dev server): root-relative "/api" so Vite's
 *    proxy forwards requests to the backend on port 8000.
 *  - Any other port (8000 in the .exe, or any custom port): build a fully
 *    absolute URL from window.location so fetch() never misresolves.
 */
function _resolveApiBase() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000/api"  // Node / SSR guard
  }

  const { protocol, hostname, port } = window.location

  // Vite dev server — use root-relative path, proxy handles the forwarding
  const VITE_PORTS = ["5173", "3000", "4173"]
  if (VITE_PORTS.includes(port)) {
    return "/api"
  }

  // Production / exe — absolute URL guarantees no misresolution in Edge
  const portSuffix = port ? `:${port}` : ""
  return `${protocol}//${hostname}${portSuffix}/api`
}

const API_BASE = _resolveApiBase()

// Always log the resolved base in non-dev environments so you can confirm
// it in Edge DevTools (F12 → Console) immediately on page load.
if (typeof window !== "undefined" && !["5173","3000","4173"].includes(window.location.port)) {
  console.log("[CogniLoad] isTauri() =", isTauri())
  console.log("[CogniLoad] API_BASE =", API_BASE)
}

// ── Lazy Tauri invoke import ──────────────────────────────────────────────────

let _invoke = null
async function getInvoke() {
  if (_invoke) return _invoke
  try {
    const mod = await import("@tauri-apps/api/core")
    _invoke = mod.invoke
  } catch {
    // Not in Tauri — should never reach here because isTauri() guards all calls
    console.warn("[CogniLoad] @tauri-apps/api/core not available")
    _invoke = async () => { throw new Error("Not in Tauri environment") }
  }
  return _invoke
}

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken()        { return localStorage.getItem("token")        ?? "" }
export function getRefreshToken() { return localStorage.getItem("refreshToken") ?? "" }

function storeTokens(access, refresh) {
  localStorage.setItem("token",        access)
  localStorage.setItem("refreshToken", refresh)
}

function clearTokens() {
  localStorage.removeItem("token")
  localStorage.removeItem("refreshToken")
  localStorage.removeItem("user")
}

// ── HTTP fetch helper ─────────────────────────────────────────────────────────

/**
 * Make a REST call to the FastAPI backend.
 *
 * @param {string} method  - "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
 * @param {string} path    - route path starting with "/", e.g. "/auth/signin"
 * @param {object} opts
 *   @param {any}    opts.body   - JS object, JSON-serialised automatically
 *   @param {string} opts.token  - explicit token; "" = no auth header;
 *                                 undefined = use localStorage token
 */
async function httpFetchRaw(path) {
  const headers = { "Content-Type": "application/json" }
  const tok = getToken()
  if (tok) headers["Authorization"] = `Bearer ${tok}`
  const res = await fetch(`${API_BASE}${path}`, { method: "GET", headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function httpFetch(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" }

  // token === ""  → intentionally no Authorization (login, register, refresh)
  // token === undefined → fall back to whatever is stored
  const tok = (token === "" || token === null) ? "" : (token || getToken())
  if (tok) headers["Authorization"] = `Bearer ${tok}`

  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)

  const url = `${API_BASE}${path}`
  const res = await fetch(url, opts)

  if (res.status === 204) return null

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { detail: text } }

  if (!res.ok) {
    const detail = json?.detail ?? `HTTP ${res.status}`
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail)
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return json
}

// ── Auto-refresh token logic ──────────────────────────────────────────────────

let _refreshing  = false
let _waitQueue   = []

function _processQueue(err, token = null) {
  _waitQueue.forEach(({ resolve, reject }) => err ? reject(err) : resolve(token))
  _waitQueue = []
}

/**
 * Execute an API call with automatic token-refresh on 401.
 * @param {Function} fn      - async (token: string) => result
 * @param {string}   cmdName - used to avoid refresh-looping on auth calls
 */
async function withAutoRefresh(fn, cmdName = "") {
  const isAuthCmd = /refresh|logout|login|register/i.test(cmdName)

  try {
    return await fn(getToken())
  } catch (err) {
    const is401 =
      err?.status === 401 ||
      // Tauri returns string errors — detect expired token by message
      (!err?.status && /token expired|invalid.*token|not an access token/i.test(err?.message ?? ""))

    // Only retry for 401; 404/500/network errors throw immediately
    if (!is401 || isAuthCmd) throw err

    const rt = getRefreshToken()
    if (!rt) { clearTokens(); throw err }

    if (_refreshing) {
      return new Promise((resolve, reject) => {
        _waitQueue.push({ resolve, reject })
      }).then((newToken) => fn(newToken))
    }

    _refreshing = true
    try {
      const result = await _doRefresh(rt)
      const newAccess  = result.access_token
      const newRefresh = result.refresh_token ?? rt
      storeTokens(newAccess, newRefresh)
      _processQueue(null, newAccess)
      return fn(newAccess)
    } catch (refreshErr) {
      _processQueue(refreshErr)
      clearTokens()
      throw refreshErr
    } finally {
      _refreshing = false
    }
  }
}

// ── Internal call helpers ─────────────────────────────────────────────────────

async function tauriCall(command, args = {}) {
  const invoke = await getInvoke()
  return invoke(command, args)
}

/**
 * Universal call — Tauri invoke OR HTTP fetch, chosen automatically.
 * isTauri() is called lazily here, well after Tauri has injected its globals.
 */
async function universalCall(tauriCmd, tauriArgs, httpMethod, httpPath, httpBody) {
  if (isTauri()) {
    return withAutoRefresh(
      (tok) => tauriCall(tauriCmd, { ...tauriArgs, token: tok }),
      tauriCmd,
    )
  }
  return withAutoRefresh(
    (tok) => httpFetch(httpMethod, httpPath, { body: httpBody, token: tok }),
    httpPath,
  )
}

async function _doRefresh(refreshToken) {
  if (isTauri()) {
    return tauriCall("refresh_token", { refresh_token: refreshToken })
  }
  return httpFetch("POST", "/auth/refresh", { body: { refresh_token: refreshToken }, token: "" })
}

// ── Error helper ──────────────────────────────────────────────────────────────

export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback
  return typeof err === "string" ? err : (err?.message ?? fallback)
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authAPI = {
  register: ({ name, email, password }) => {
    if (isTauri()) return tauriCall("register", { name, email, password })
    return httpFetch("POST", "/auth/register", { body: { name, email, password }, token: "" })
  },

  login: ({ email, password }) => {
    if (isTauri()) return tauriCall("login", { email, password })
    // Backend accepts both /auth/signin and /auth/login
    return httpFetch("POST", "/auth/signin", { body: { email, password }, token: "" })
  },

  logout: () => {
    const rt = getRefreshToken()
    clearTokens()
    if (isTauri()) return tauriCall("logout", { refresh_token: rt })
    return httpFetch("POST", "/auth/logout", { body: { refresh_token: rt }, token: "" })
  },

  profile: () =>
    universalCall("get_current_user", {}, "GET", "/auth/profile", undefined),

  refresh: () => _doRefresh(getRefreshToken()),

  updateProfile: ({ name, email }) =>
    universalCall("update_profile", { name, email }, "PATCH", "/auth/profile", { name, email }),

  changePassword: ({ current_password, new_password }) =>
    universalCall(
      "change_password", { current_password, new_password },
      "POST", "/auth/change-password", { current_password, new_password },
    ),
}

// ── Session API ───────────────────────────────────────────────────────────────

export const sessionAPI = {
  start: () =>
    universalCall("start_session", {}, "POST", "/session/start", undefined),

  end: (sessionId) =>
    universalCall(
      "end_session", { session_id: sessionId },
      "POST", "/session/end", { session_id: sessionId },
    ),

  current: () =>
    universalCall("get_current_session", {}, "GET", "/session/current", undefined),

  pause: () =>
    universalCall("pause_session", {}, "POST", "/session/pause", undefined),

  resume: () =>
    universalCall("resume_session", {}, "POST", "/session/resume", undefined),

  list: () =>
    universalCall("get_sessions", {}, "GET", "/dashboard/history", undefined),
}

// ── Behavior API ──────────────────────────────────────────────────────────────

export const behaviorAPI = {
  flush: (sessionId) => {
    if (isTauri()) {
      return universalCall(
        "flush_behavior", { session_id: sessionId },
        "POST", `/behavior`, { session_id: sessionId },
      )
    }
    // In exe/uvicorn mode the pynput collector pushes behavior automatically server-side.
    // Return a minimal resolved value so Tauri-path callers that await this don't error.
    return Promise.resolve({ id: null, session_id: sessionId })
  },

  history: (sessionId, limit = 50) =>
    universalCall(
      "get_behavior_history", { session_id: sessionId, limit },
      "GET", `/history?session_id=${sessionId}&limit=${limit}`, undefined,
    ),
}

// ── Prediction API ────────────────────────────────────────────────────────────

export const predictAPI = {
  /**
   * predict(sessionId, payload, behaviorId)
   *
   * Tauri: invoke Rust predict_load command directly.
   * HTTP (uvicorn dev / .exe):  POST /api/predict with the feature payload.
   *   - The backend does NOT use session_id or behavior_id from the request
   *     body; it derives the session from the JWT and creates the BehaviorData
   *     row itself.  Only send the 17-feature BehaviorPayload fields.
   */
  predict: (sessionId, payload, behaviorId = null) => {
    if (isTauri()) {
      return universalCall(
        "predict_load", { session_id: sessionId, behavior_id: behaviorId, payload },
        "POST", "/predict", payload,
      )
    }
    // HTTP mode (uvicorn dev server OR packaged .exe):
    // The pynput system collector already pushes to /api/predict automatically.
    // When the browser tracker is active (no system collector), also push here
    // so the frontend-collected features produce a prediction + WebSocket push.
    if (!payload) return Promise.resolve(null)
    return withAutoRefresh(
      (tok) => httpFetch("POST", "/predict", { body: payload, token: tok }),
      "/predict",
    )
  },

  list: (sessionId, limit = 50) =>
    universalCall(
      "get_predictions", { session_id: sessionId, limit },
      "GET", `/history?session_id=${sessionId}&limit=${limit}`, undefined,
    ),
}

// ── Collector API ─────────────────────────────────────────────────────────────

export const collectorAPI = {
  setEnabled: (enabled) => {
    if (isTauri()) return tauriCall("set_tracking_enabled", { enabled })
    return Promise.resolve({ enabled })
  },

  status: () => {
    if (isTauri()) return tauriCall("get_tracking_status")
    return Promise.resolve({ enabled: false, mode: "system" })
  },
}

// ── Settings API ──────────────────────────────────────────────────────────────

export const settingsAPI = {
  get: () =>
    universalCall("get_settings", {}, "GET", "/settings", undefined),

  update: (payload) =>
    universalCall("update_settings", payload, "PUT", "/settings", payload),

  getAutostart: () => {
    if (isTauri()) return tauriCall("get_autostart")
    return httpFetch("GET", "/settings/autostart")
  },

  enableAutostart: () => {
    if (isTauri()) return tauriCall("set_autostart", { enabled: true })
    return httpFetch("POST", "/settings/autostart")
  },

  disableAutostart: () => {
    if (isTauri()) return tauriCall("set_autostart", { enabled: false })
    return httpFetch("DELETE", "/settings/autostart")
  },
}

// ── Dashboard API ─────────────────────────────────────────────────────────────

export const dashboardAPI = {
  overview: () =>
    universalCall("get_overview", {}, "GET", "/dashboard", undefined),

  history: ({ page = 1, per_page = 20, from_date, to_date } = {}) => {
    const params = new URLSearchParams({ page, per_page })
    if (from_date) params.set("from_date", from_date)
    if (to_date)   params.set("to_date",   to_date)
    return universalCall(
      "get_history", { page, per_page, from_date, to_date },
      "GET", `/dashboard/history?${params}`, undefined,
    )
  },

  recommendation: () =>
    universalCall("get_recommendation", {}, "GET", "/recommendation", undefined),
}

// ── Model API ─────────────────────────────────────────────────────────────────

export const modelAPI = {
  info: () => {
    if (isTauri()) return tauriCall("get_model_info")
    return httpFetch("GET", "/model/info")
  },
}

// ── Reports API ───────────────────────────────────────────────────────────────

export const reportsAPI = {
  export: () => {
    if (isTauri()) return tauriCall("export_csv", {})
    return withAutoRefresh(() => httpFetchRaw("/reports/export"), "/reports/export")
  },

  daily: (days = 14) =>
    universalCall("get_daily_reports", { days }, "GET", `/reports/daily?days=${days}`, undefined),

  weekly: (weeks = 8) =>
    universalCall("get_weekly_reports", { weeks }, "GET", `/reports/weekly?weeks=${weeks}`, undefined),

  exportAppUsage: (days = 30) =>
    withAutoRefresh(
      () => httpFetchRaw(`/reports/export-app-usage?days=${days}`),
      "/reports/export-app-usage",
    ),
}

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsAPI = {
  trends: (hours = 24, limit = 500) =>
    universalCall(
      "get_analytics_trends", { hours, limit },
      "GET", `/analytics/trends?hours=${hours}&limit=${limit}`, undefined,
    ),

  features: () =>
    universalCall("get_analytics_features", {}, "GET", "/analytics/features", undefined),
}

// ── Legacy call() shim ────────────────────────────────────────────────────────
// Backwards compat for any code still calling call(command, args) directly.

export async function call(command, args = {}) {
  if (isTauri()) {
    const invoke = await getInvoke()
    return withAutoRefresh((tok) => invoke(command, { ...args, token: tok }), command)
  }

  const HTTP_MAP = {
    get_current_user:       ["GET",  "/auth/profile"],
    get_overview:           ["GET",  "/dashboard"],
    get_recommendation:     ["GET",  "/recommendation"],
    get_daily_reports:      ["GET",  `/reports/daily?days=${args.days ?? 14}`],
    get_weekly_reports:     ["GET",  `/reports/weekly?weeks=${args.weeks ?? 8}`],
    export_csv:             ["GET",  "/reports/export"],
    get_analytics_trends:   ["GET",  `/analytics/trends?hours=${args.hours ?? 24}&limit=${args.limit ?? 500}`],
    get_analytics_features: ["GET",  "/analytics/features"],
    get_settings:           ["GET",  "/settings"],
    update_settings:        ["PUT",  "/settings"],
  }

  const mapped = HTTP_MAP[command]
  if (mapped) {
    const [method, path] = mapped
    return withAutoRefresh(
      (tok) => httpFetch(method, path, { body: method !== "GET" ? args : undefined, token: tok }),
      path,
    )
  }

  throw new Error(`[CogniLoad api.js] Unmapped HTTP command: "${command}". Add it to HTTP_MAP.`)
}
export const appUsageAPI = {
  summary: (hours = 24) =>
    universalCall(
      "get_app_usage_summary", { hours },
      "GET", `/app-usage/summary?hours=${hours}`, undefined,
    ),

  timeline: (hours = 8, limit = 200) =>
    universalCall(
      "get_app_usage_timeline", { hours, limit },
      "GET", `/app-usage/timeline?hours=${hours}&limit=${limit}`, undefined,
    ),
}