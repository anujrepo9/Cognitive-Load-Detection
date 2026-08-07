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

export const dashboardAPI = {
  overview:       ()        => api.get("/dashboard"),
  history:        (limit=20) => api.get(`/history?limit=${limit}`),
  recommendation: ()        => api.get("/recommendation"),
}

export default api
