import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { authAPI } from "../services/api"

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handle = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { data } = await authAPI.register(form)
      login(data.user, data.access_token)
      navigate("/dashboard")
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">Create account</h1>
        <p className="text-gray-500 text-sm mb-8">Start tracking cognitive load</p>

        <form onSubmit={handle} className="space-y-4">
          {["name", "email", "password"].map((field) => (
            <div key={field}>
              <label className="block text-xs text-gray-400 mb-1.5 capitalize">
                {field}
              </label>
              <input
                type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                required
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5
                  text-sm text-gray-100 placeholder-gray-600 focus:outline-none
                  focus:border-brand focus:ring-1 focus:ring-brand transition"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50
              text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-6">
          Have an account?{" "}
          <Link to="/login" className="text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
