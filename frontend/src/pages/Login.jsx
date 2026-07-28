import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { authAPI } from "../services/api"

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handle = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { data } = await authAPI.login(form)
      login(data.user, data.access_token)
      navigate("/dashboard")
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">CogniLoad</h1>
        <p className="text-gray-500 text-sm mb-8">Sign in to your account</p>

        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input
              type="email" required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5
                text-sm text-gray-100 placeholder-gray-600 focus:outline-none
                focus:border-brand focus:ring-1 focus:ring-brand transition"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <input
              type="password" required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5
                text-sm text-gray-100 placeholder-gray-600 focus:outline-none
                focus:border-brand focus:ring-1 focus:ring-brand transition"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50
              text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-6">
          No account?{" "}
          <Link to="/register" className="text-brand hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
