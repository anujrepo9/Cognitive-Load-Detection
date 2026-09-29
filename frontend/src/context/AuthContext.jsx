import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"
import { authAPI } from "../services/api"

const AuthContext = createContext(null)

const _rawApiUrl = import.meta.env.VITE_API_URL
const _isLocalhost = _rawApiUrl && /localhost|127\\.0\\.0\\.1/.test(_rawApiUrl)
const BASE = (!_rawApiUrl || _isLocalhost) ? "/api" : _rawApiUrl

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(
    () => JSON.parse(localStorage.getItem("user") || "null")
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const storedToken  = localStorage.getItem("token")
    const refreshToken = localStorage.getItem("refreshToken")

    if (!storedToken && !refreshToken) {
      setUser(null)
      localStorage.removeItem("user")
      setReady(true)
      return
    }

    authAPI.profile()
      .then(({ data }) => {
        setUser(data)
        localStorage.setItem("user", JSON.stringify(data))
        setReady(true)
        // Tell the backend to hand the current token to the local collector.
        // Fire-and-forget: if the backend isn't running yet this is harmless.
        _registerCollectorToken()
      })
      .catch(async () => {
        const latestRefreshToken = localStorage.getItem("refreshToken")
        if (!latestRefreshToken) {
          _clearLocalSession()
          setUser(null)
          setReady(true)
          window.location.href = "/login"
          return
        }
        try {
          const { data } = await axios.post(`${BASE}/auth/refresh`, {
            refresh_token: latestRefreshToken,
          })
          localStorage.setItem("token",        data.access_token)
          localStorage.setItem("refreshToken", data.refresh_token ?? latestRefreshToken)
          const { data: profileData } = await authAPI.profile()
          setUser(profileData)
          localStorage.setItem("user", JSON.stringify(profileData))
          setReady(true)
          _registerCollectorToken()
        } catch {
          _clearLocalSession()
          setUser(null)
          setReady(true)
          window.location.href = "/login"
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = (userData, token, refreshToken = null) => {
    localStorage.setItem("token",        token)
    localStorage.setItem("refreshToken", refreshToken || "")
    localStorage.setItem("user",         JSON.stringify(userData))
    setUser(userData)
    // Hand the new token to the collector so it can send keyboard/mouse data
    // to /behavior on behalf of the logged-in user.
    _registerCollectorToken()
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem("refreshToken")
    if (refreshToken) {
      try { await authAPI.logout({ refresh_token: refreshToken }) } catch { /* ignore */ }
    }
    _clearLocalSession()
    setUser(null)
  }

  if (!ready) return null

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * POST the current access token to /auth/register-collector.
 * The backend writes it into collector_config.json so the pynput collector
 * process can authenticate its /behavior pushes.
 * Silently ignored if the endpoint is unavailable (non-desktop builds).
 */
function _registerCollectorToken() {
  const token = localStorage.getItem("token")
  if (!token) return
  fetch(`${BASE}/auth/register-collector`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ access_token: token }),
  }).catch(() => { /* desktop-only endpoint — ignore in web/CI */ })
}

function _clearLocalSession() {
  localStorage.removeItem("token")
  localStorage.removeItem("refreshToken")
  localStorage.removeItem("user")
}

export const useAuth = () => useContext(AuthContext)