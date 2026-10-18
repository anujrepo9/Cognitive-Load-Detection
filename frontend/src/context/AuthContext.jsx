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

    // Safety net: if the profile call hangs (e.g. Tauri backend not ready yet,
    // or network issue in web mode), unblock the UI after 8 s instead of
    // showing a white / blank screen indefinitely.
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
        localStorage.setItem("user", JSON.stringify(userData))
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
          localStorage.setItem("user", JSON.stringify(profileData))
          setReady(true)
        } catch {
          _clearSession()
          setUser(null)
          setReady(true)
          // Do NOT call window.location.href here — let React Router handle
          // the redirect via the <Navigate> in GuestLayout. Imperative
          // navigation causes a full page reload, which breaks Tauri's WebView.
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

  // FIX: return a minimal loading indicator instead of null.
  //
  // The old code returned null while `ready` was false, which rendered as a
  // completely white screen. This happens in BOTH web and Tauri — any time
  // there's a stored token the app makes a network call before painting.
  //
  // The spinner below uses only inline styles (no Tailwind, no external CSS)
  // so it works even before the stylesheet is parsed, and matches both
  // light and dark OS themes via prefers-color-scheme.
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