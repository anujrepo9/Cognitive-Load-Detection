import axios from "axios"

// In development Vite proxies all API paths to localhost:8000, so we use a
// same-origin base ("") which avoids any cross-origin request and therefore
// any CORS error.  In a production build you set VITE_API_URL to the real
// backend origin; the proxy is not involved there.
const BASE = import.meta.env.VITE_API_URL || ""

const api = axios.create({ baseURL: BASE, timeout: 10000 })

// ── Request: attach access token ──────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: auto-refresh on 401 / 403, retry once ──────────────────────────
//
// Why 403 in addition to 401?
// FastAPI's HTTPBearer() returns 403 "Not authenticated" when the Authorization
// header is completely absent (e.g. first request on a hard page refresh before
// the interceptor fires), and 401 when the token is present but invalid/expired.
// We treat both the same way: attempt a silent token refresh, then retry.
//
let _refreshing = false
let _waitQueue  = []

function _processQueue(error, token = null) {
  _waitQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  _waitQueue = []
}

// Helper: is this status one we should attempt a token refresh for?
function _isAuthError(status) {
  return status === 401 || status === 403
}

// Helper: is this a route we should never retry (to avoid infinite loops)?
function _isAuthRoute(url = "") {
  return url.includes("/auth/refresh") || url.includes("/auth/logout")
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const status   = err.response?.status

    // Pass through immediately if:
    //  • Not an auth error
    //  • Already retried
    //  • This is the refresh/logout endpoint itself
    if (!_isAuthError(status) || original._retried || _isAuthRoute(original.url)) {
      // Only wipe the session if the refresh endpoint itself failed (not logout)
      if (original.url?.includes("/auth/refresh")) _clearSession()
      return Promise.reject(err)
    }

    // Don't attempt refresh if there's no refresh token stored
    const refreshToken = localStorage.getItem("refreshToken")
    if (!refreshToken) {
      _clearSession()
      return Promise.reject(err)
    }

    original._retried = true

    // If a refresh is already in flight, queue this request and wait
    if (_refreshing) {
      return new Promise((resolve, reject) => {
        _waitQueue.push({ resolve, reject })
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      })
    }

    _refreshing = true
    try {
      // Use plain axios (not the instance) so this call bypasses our interceptor
      const { data } = await axios.post(`${BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      const newAccess  = data.access_token
      const newRefresh = data.refresh_token ?? refreshToken

      localStorage.setItem("token",        newAccess)
      localStorage.setItem("refreshToken", newRefresh)
      // /auth/refresh doesn't return user; preserve what's already stored

      // Prime the default header so subsequent calls don't need the interceptor
      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`

      _processQueue(null, newAccess)
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${newAccess}`
      return api(original)
    } catch (refreshErr) {
      _processQueue(refreshErr)
      _clearSession()
      return Promise.reject(refreshErr)
    } finally {
      _refreshing = false
    }
  },
)

function _clearSession() {
  localStorage.removeItem("token")
  localStorage.removeItem("refreshToken")
  localStorage.removeItem("user")
  window.location.href = "/login"
}

// ── Proactive token bootstrap ─────────────────────────────────────────────────
// On a hard page refresh the axios instance is brand-new and has no default
// Authorization header.  The request interceptor above fills it per-request,
// which is sufficient — but priming it here as well prevents any edge-case
// race where a request fires before the interceptor chain is fully set up.
;(function _bootstrapToken() {
  const token = localStorage.getItem("token")
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
})()

// ── Centralised error helper ──────────────────────────────────────────────────
// Returns a user-readable message from any axios error shape.
export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback
  const detail = err.response?.data?.error?.message
    || err.response?.data?.detail
    || err.message
  return detail || fallback
}

// ── API surfaces ──────────────────────────────────────────────────────────────

export const authAPI = {
  login:          (data) => api.post("/auth/login",           data),
  register:       (data) => api.post("/auth/register",        data),
  profile:        ()     => api.get("/auth/profile"),
  refresh:        (data) => api.post("/auth/refresh",         data),
  logout:         (data) => api.post("/auth/logout",          data),
  updateProfile:  (data) => api.patch("/auth/profile",        data),
  changePassword: (data) => api.post("/auth/change-password", data),
}

export const behaviorAPI = {
  send:    (payload) => api.post("/behavior", payload),
  predict: (payload) => api.post("/predict",  payload),
}

export const sessionAPI = {
  start:   ()     => api.post("/session/start"),
  current: ()     => api.get("/session/current"),
  end:     ()     => api.post("/session/end"),
}

export const dashboardAPI = {
  overview:       ()               => api.get("/dashboard"),
  history:        (params = {})   => api.get("/history",        { params }),
  recommendation: ()               => api.get("/recommendation"),
}

export const reportsAPI = {
  daily:  (days = 7)   => api.get("/reports/daily",  { params: { days } }),
  weekly: (weeks = 4)  => api.get("/reports/weekly", { params: { weeks } }),
  export: ()           => api.get("/reports/export",  { responseType: "blob" }),
}

export const analyticsAPI = {
  trends:   (hours = 24, limit = 200) => api.get("/analytics/trends",   { params: { hours, limit } }),
  features: ()                        => api.get("/analytics/features"),
}

export const settingsAPI = {
  get:    ()     => api.get("/settings"),
  update: (data) => api.put("/settings", data),
}

export const modelAPI = {
  info: () => api.get("/model/info"),
}

export default api
