import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 10000,
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login:          (data) => api.post("/auth/login", data),
  register:       (data) => api.post("/auth/register", data),
  profile:        ()     => api.get("/auth/profile"),
  refresh:        (data) => api.post("/auth/refresh", data),
  logout:         (data) => api.post("/auth/logout", data),
  updateProfile:  (data) => api.patch("/auth/profile", data),
  changePassword: (data) => api.post("/auth/change-password", data),
}

export const behaviorAPI = {
  send:    (payload) => api.post("/behavior", payload),
  predict: (payload) => api.post("/predict", payload),
}

export const sessionAPI = {
  current: ()     => api.get("/session/current"),
  end:     ()     => api.post("/session/end"),
}

export const dashboardAPI = {
  overview:       ()                          => api.get("/dashboard"),
  history:        (params = {})              => api.get("/history", { params }),
  recommendation: ()                          => api.get("/recommendation"),
}

export const reportsAPI = {
  daily:   (days = 7)   => api.get("/reports/daily",  { params: { days } }),
  weekly:  (weeks = 4)  => api.get("/reports/weekly", { params: { weeks } }),
  export:  ()           => api.get("/reports/export",  { responseType: "blob" }),
}

export const analyticsAPI = {
  trends:   (hours = 24, limit = 200) => api.get("/analytics/trends",   { params: { hours, limit } }),
  features: ()                        => api.get("/analytics/features"),
}

export const settingsAPI = {
  get:    ()     => api.get("/settings"),
  update: (data) => api.put("/settings", data),
}

export default api
