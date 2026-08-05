import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Mail, Lock, User, BrainCircuit, ArrowRight, Eye, EyeOff } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authAPI } from "../services/api"

const benefits = [
  "Free to start — no card required",
  "Monitor your focus instantly",
  "Get personalized recommendations",
]

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
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
    <div className="min-h-screen bg-white dark:bg-slate-950 flex">
      {/* Marketing panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br
        from-primary to-accent text-white flex-col justify-between p-12">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-black/10 blur-3xl" />

        <div className="flex items-center gap-2.5 relative">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur
            flex items-center justify-center">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold">CogniLoad</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-snug mb-4">
            Take control of your focus today
          </h2>
          <p className="text-white/80 mb-8 max-w-md">
            Join thousands who understand their cognitive performance and work smarter.
          </p>
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center
                  justify-center text-xs">✓</span>
                <span className="text-sm text-white/90">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-white/60 text-sm relative">
          © 2025 CogniLoad · Cognitive Load Detector
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent
              flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">CogniLoad</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Create account
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
            Start tracking your cognitive load
          </p>

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600
                dark:text-gray-300 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input pl-9" placeholder="Jane Doe" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600
                dark:text-gray-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input pl-9" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600
                dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPw ? "text" : "password"} required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input pl-9 pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                    hover:text-gray-600 dark:hover:text-gray-200">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-danger text-xs">{error}</p>}

            <button type="submit" disabled={loading}
              className="btn-primary w-full">
              {loading ? "Creating account…" : "Create account"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
