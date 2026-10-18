import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { BrainCircuit, User, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, Sparkles } from "lucide-react"
import { authAPI, getErrorMessage } from "../services/api"
import { useAuth } from "../context/AuthContext"

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthLabel = ["", "Weak", "Fair", "Strong"]
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-emerald-500"]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError("Please fill in all fields."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    setLoading(true)
    setError(null)
    try {
      const result = await authAPI.register({ name, email, password })
      login(result.user, result.access_token, result.refresh_token)
      navigate("/dashboard")
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#080b14]">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden
        bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 left-0 w-72 h-72 rounded-full bg-indigo-900/40 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20
            flex items-center justify-center mb-8">
            <BrainCircuit className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Start understanding<br />how you work.
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed max-w-sm">
            Join CogniLoad and start tracking your cognitive load in real time.
            Your data stays private — always.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { val: "~99%", lbl: "Model accuracy" },
              { val: "5s", lbl: "Prediction interval" },
              { val: "0%", lbl: "Content recorded" },
              { val: "Live", lbl: "WebSocket updates" },
            ].map(({ val, lbl }) => (
              <div key={lbl} className="bg-white/10 rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold">{val}</div>
                <div className="text-xs text-indigo-200 mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm">

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5">Start monitoring your cognitive load</p>
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
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="name" type="text" autoComplete="name"
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="input pl-9" placeholder="Ada Lovelace" aria-required="true" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9" placeholder="you@example.com" aria-required="true" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="password" type={showPwd ? "text" : "password"} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 pr-10" placeholder="••••••••" aria-required="true" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                    hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={showPwd ? "Hide password" : "Show password"}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1,2,3].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300
                        ${i <= strength ? strengthColor[strength] : "bg-gray-200 dark:bg-gray-700"}`} />
                    ))}
                  </div>
                  <span className={`text-[11px] font-medium
                    ${strength === 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : "text-emerald-500"}`}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center mt-2 py-3"
              aria-disabled={loading}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
