import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"
import { authAPI } from "../services/api"

const AuthContext = createContext(null)

const BASE = import.meta.env.VITE_API_URL || ""

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(
    () => JSON.parse(localStorage.getItem("user") || "null")
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const storedToken  = localStorage.getItem("token")
    const refreshToken = localStorage.getItem("refreshToken")

    // No tokens — not logged in
    if (!storedToken && !refreshToken) {
      setUser(null)
      localStorage.removeItem("user")
      setReady(true)
      return
    }

    // Validate the stored access token.
    // The axios interceptor will auto-refresh on 401/403 and retry, so
    // .then() here means we have a confirmed valid (possibly just-refreshed) token.
    authAPI.profile()
      .then(({ data }) => {
        setUser(data)
        localStorage.setItem("user", JSON.stringify(data))
        setReady(true)
      })
      .catch(async () => {
        // Both the original request AND the interceptor's refresh attempt failed.
        // Try one final explicit refresh before giving up.
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
          // Fetch profile with the brand-new token
          const { data: profileData } = await authAPI.profile()
          setUser(profileData)
          localStorage.setItem("user", JSON.stringify(profileData))
          setReady(true)
        } catch {
          // Truly dead session — clear everything and send to login
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
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem("refreshToken")
    if (refreshToken) {
      try { await authAPI.logout({ refresh_token: refreshToken }) } catch { /* ignore */ }
    }
    _clearLocalSession()
    setUser(null)
  }

  // Don't render anything until auth state is confirmed — this guarantees
  // no child component fires an API call before the token is valid.
  if (!ready) return null

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

function _clearLocalSession() {
  localStorage.removeItem("token")
  localStorage.removeItem("refreshToken")
  localStorage.removeItem("user")
}

export const useAuth = () => useContext(AuthContext)