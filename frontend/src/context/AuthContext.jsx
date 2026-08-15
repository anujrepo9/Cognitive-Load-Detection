import { createContext, useContext, useState, useEffect } from "react"
import { authAPI } from "../services/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Seed user from localStorage so the UI doesn't flash a login redirect
  // on hard refresh.  We then validate the token silently in the background.
  const [user,  setUser]  = useState(
    () => JSON.parse(localStorage.getItem("user") || "null")
  )
  const [ready, setReady] = useState(false)

  // ── Silent token validation on mount ────────────────────────────────────────
  // After a page refresh the stored access token may be expired.  We call
  // GET /auth/profile (which requires a valid token) to confirm the session is
  // still live.  The axios interceptor in api.js will automatically try to
  // refresh an expired access token using the refresh token — so this call
  // succeeds silently in the happy path.  Only if both tokens are gone/invalid
  // will it redirect to /login.
  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    if (!storedToken) {
      // No token at all — clear any stale user state and mark ready
      setUser(null)
      localStorage.removeItem("user")
      setReady(true)
      return
    }

    authAPI.profile()
      .then(({ data }) => {
        // Token still valid; update user in case profile changed
        setUser(data)
        localStorage.setItem("user", JSON.stringify(data))
      })
      .catch(() => {
        // Both access and refresh tokens failed (interceptor already tried).
        // _clearSession() in api.js will redirect to /login, but we also
        // clean up state here defensively.
        setUser(null)
        localStorage.removeItem("token")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("user")
      })
      .finally(() => setReady(true))
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
      try {
        await authAPI.logout({ refresh_token: refreshToken })
      } catch {
        // ignore — clear locally regardless
      }
    }
    localStorage.removeItem("token")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
    setUser(null)
  }

  // Don't render children until we know whether the stored token is valid.
  // This prevents a flash where protected pages briefly render with stale
  // user data before the profile check completes.
  if (!ready) return null

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
