import { createContext, useContext, useState, useEffect } from "react"
import { authAPI } from "../services/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(
    () => JSON.parse(localStorage.getItem("user") || "null")
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token        = localStorage.getItem("token")
    const refreshToken = localStorage.getItem("refreshToken")

    if (!token && !refreshToken) {
      setUser(null)
      localStorage.removeItem("user")
      setReady(true)
      return
    }

    // invoke() returns the value directly — no .data wrapper
    authAPI.profile()
      .then((userData) => {
        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
        setReady(true)
      })
      .catch(async (err) => {
        const latestRefresh = localStorage.getItem("refreshToken")
        if (!latestRefresh) {
          _clearSession()
          setUser(null)
          setReady(true)
          window.location.href = "/login"
          return
        }
        try {
          const result = await authAPI.refresh()
          localStorage.setItem("token",        result.access_token)
          localStorage.setItem("refreshToken", result.refresh_token ?? latestRefresh)
          const profileData = await authAPI.profile()
          setUser(profileData)
          localStorage.setItem("user", JSON.stringify(profileData))
          setReady(true)
        } catch {
          _clearSession()
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
    try { await authAPI.logout() } catch { /* ignore */ }
    _clearSession()
    setUser(null)
  }

  if (!ready) return null

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

function _clearSession() {
  localStorage.removeItem("token")
  localStorage.removeItem("refreshToken")
  localStorage.removeItem("user")
}

export const useAuth = () => useContext(AuthContext)