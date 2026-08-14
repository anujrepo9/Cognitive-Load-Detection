import axios from "axios"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

const api = axios.create({ baseURL: BASE, timeout: 10000 })

// ── Request: attach access token ──────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: auto-refresh on 401, retry once ─────────────────────────────────
let _refreshing = false
let _waitQueue  = []  // { resolve, reject }[]

function _processQueue(error, token = null) {
  _waitQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  _waitQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    // Only handle 401 once per request; skip refresh & logout endpoints
    if (
      err.response?.status !== 401 ||
      original._retried ||
      original.url?.includes("/auth/refresh") ||
      original.url?.includes("/auth/logout")
    ) {
      // Hard logout if we get a 401 on the refresh call itself
      if (original.url?.includes("/auth/refresh")) {
        _clearSession()
      }
      return Promise.reject(err)
    }

    original._retried = true

    const refreshToken = localStorage.getItem("refreshToken")
    if (!refreshToken) {
      _clearSession()
      return Promise.reject(err)
    }

    if (_refreshing) {
      // Another request already started a refresh — wait for it
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

      // Patch stored user if returned
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user))
      }

      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`
      _processQueue(null, newAccess)
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
