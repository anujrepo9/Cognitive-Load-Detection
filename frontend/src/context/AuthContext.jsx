import { createContext, useContext, useState, useEffect } from "react"
import { authAPI } from "../services/api"

const AuthContext = createContext(null)

// Safe JSON parse: returns null for null, "undefined", "", or any invalid JSON
// instead of throwing. This prevents a crash on first launch after a bad session
// stored the literal string "undefined" (from JSON.stringify(undefined) → undefined
// → localStorage coercion → the string "undefined" → JSON.parse throws).
function _safeParseUser(raw) {
  if (!raw || raw === "undefined" || raw === "null") return null
  try { return JSON.parse(raw) } catch { return null }
}

// Safe localStorage write for user object — never store undefined/null as a string
function _saveUser(userData) {
  if (userData == null) {
    localStorage.removeItem("user")
  } else {
    const str = JSON.stringify(userData)
    if (str !== undefined) localStorage.setItem("user", str)
  }
}

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(
    () => _safeParseUser(localStorage.getItem("user"))
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

    const timeout = setTimeout(() => {
      console.warn("[CogniLoad] Auth profile check timed out — clearing session")
      _clearSession()
      setUser(null)
      setReady(true)
    }, 8000)

    authAPI.profile()
      .then((userData) => {
        clearTimeout(timeout)
        setUser(userData)
        _saveUser(userData)
        setReady(true)
      })
      .catch(async () => {
        clearTimeout(timeout)
        const latestRefresh = localStorage.getItem("refreshToken")
        if (!latestRefresh) {
          _clearSession()
          setUser(null)
          setReady(true)
          return
        }
        try {
          const result = await authAPI.refresh()
          localStorage.setItem("token",        result.access_token)
          localStorage.setItem("refreshToken", result.refresh_token ?? latestRefresh)
          const profileData = await authAPI.profile()
          setUser(profileData)
          _saveUser(profileData)
          setReady(true)
        } catch {
          _clearSession()
          setUser(null)
          setReady(true)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = (userData, token, refreshToken = null) => {
    localStorage.setItem("token",        token)
    localStorage.setItem("refreshToken", refreshToken || "")
    _saveUser(userData)
    setUser(userData)
  }

  const logout = async () => {
    try { await authAPI.logout() } catch { /* ignore */ }
    _clearSession()
    setUser(null)
  }

  if (!ready) {
    return (
      <>
        <style>{`
          @keyframes _cogni_spin {
            to { transform: rotate(360deg); }
          }
          @media (prefers-color-scheme: dark) {
            ._cogni_bg  { background: #0a0a0a !important; }
            ._cogni_txt { color: #64748b !important; }
            ._cogni_rim { border-color: #1e293b !important; border-top-color: #6366f1 !important; }
          }
        `}</style>
        <div className="_cogni_bg" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100vh", flexDirection: "column", gap: 16,
          background: "#f8fafc",
        }}>
          <div className="_cogni_rim" style={{
            width: 36, height: 36,
            border: "3px solid #e2e8f0",
            borderTopColor: "#6366f1",
            borderRadius: "50%",
            animation: "_cogni_spin 0.7s linear infinite",
          }} />
          <span className="_cogni_txt" style={{
            color: "#94a3b8", fontSize: 13,
            fontFamily: "Inter, system-ui, sans-serif",
          }}>
            Starting CogniLoad…
          </span>
        </div>
      </>
    )
  }

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