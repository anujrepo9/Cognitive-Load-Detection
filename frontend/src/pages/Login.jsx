import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { BrainCircuit, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, Sparkles } from "lucide-react"
import { authAPI, getErrorMessage } from "../services/api"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError("Please fill in all fields."); return }
    setLoading(true)
    setError(null)
    try {
      const result = await authAPI.login({ email, password })
      login(result.user, result.access_token, result.refresh_token)
      navigate("/dashboard")
    } catch (err) {
      setError(getErrorMessage(err, "Invalid credentials. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#080b14]">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden
        bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
        {/* Mesh orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-purple-900/40 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-indigo-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20
            flex items-center justify-center mb-8">
            <BrainCircuit className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Monitor your mind,<br />not just your screen.
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed max-w-sm">
            CogniLoad detects cognitive overload in real time using keyboard and mouse patterns —
            so you can work smarter, not harder.
          </p>
          <div className="mt-10 flex flex-col gap-3">
            {[
              "No screen reading. Only interaction patterns.",
              "Real-time load predictions via WebSocket.",
              "Personalized recommendations to reduce stress.",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-indigo-100">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm">

          {/* Logo for mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
                flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Cogni<span className="text-indigo-500">Load</span>
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5">Sign in to your account to continue</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20
                border border-red-200 dark:border-red-800
                px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="you@example.com"
                  aria-required="true"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password" type={showPwd ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  aria-required="true"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                    hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={showPwd ? "Hide password" : "Show password"}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center mt-2 py-3"
              aria-disabled={loading}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            No account?{" "}
            <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Create one free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
