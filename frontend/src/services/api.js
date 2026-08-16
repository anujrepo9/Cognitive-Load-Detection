import axios from "axios"

const BASE = import.meta.env.VITE_API_URL || ""

const api = axios.create({ baseURL: BASE, timeout: 10000 })

// ── Request: attach access token ──────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: auto-refresh on 401 / 403, retry once ──────────────────────────
let _refreshing = false
let _waitQueue  = []

function _processQueue(error, token = null) {
  _waitQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  _waitQueue = []
}

function _isAuthError(status) {
  return status === 401 || status === 403
}

function _isAuthRoute(url = "") {
  return url.includes("/auth/refresh") || url.includes("/auth/logout")
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const status   = err.response?.status

    // Pass through immediately for non-auth errors, already-retried, or auth endpoints
    if (!_isAuthError(status) || original._retried || _isAuthRoute(original.url)) {
      // Do NOT call _clearSession here — let AuthContext decide what to do.
      // A failed /auth/refresh just means tokens are dead; callers handle it.
      return Promise.reject(err)
    }

    const refreshToken = localStorage.getItem("refreshToken")
    if (!refreshToken) {
      // No refresh token — reject without redirecting; AuthContext will handle it
      return Promise.reject(err)
    }

    original._retried = true

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
      const { data } = await axios.post(`${BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      const newAccess  = data.access_token
      const newRefresh = data.refresh_token ?? refreshToken

      localStorage.setItem("token",        newAccess)
      localStorage.setItem("refreshToken", newRefresh)
      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`

      _processQueue(null, newAccess)
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${newAccess}`
      return api(original)
    } catch (refreshErr) {
      _processQueue(refreshErr)
      // Remove tokens so AuthContext knows the session is dead,
      // but do NOT hard-redirect here — AuthContext controls navigation.
      localStorage.removeItem("token")
      localStorage.removeItem("refreshToken")
      localStorage.removeItem("user")
      return Promise.reject(refreshErr)
    } finally {
      _refreshing = false
    }
  },
)

// ── Proactive token bootstrap ──────────────────────────────────────────────────
;(function _bootstrapToken() {
  const token = localStorage.getItem("token")
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
})()

// ── Centralised error helper ──────────────────────────────────────────────────
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