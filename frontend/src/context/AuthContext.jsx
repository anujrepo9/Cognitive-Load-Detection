import { createContext, useContext, useState } from "react"
import { authAPI } from "../services/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  )

  const login = (userData, token, refreshToken = null) => {
    localStorage.setItem("token", token)
    localStorage.setItem("refreshToken", refreshToken || "")
    localStorage.setItem("user", JSON.stringify(userData))
    setUser(userData)
  }

  const logout = async () => {
    // Best-effort revoke the refresh token server-side
    const refreshToken = localStorage.getItem("refreshToken")
    if (refreshToken) {
      try {
        await authAPI.logout({ refresh_token: refreshToken })
      } catch (_) {
        // ignore network/revoke errors — clear locally regardless
      }
    }
    localStorage.removeItem("token")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

