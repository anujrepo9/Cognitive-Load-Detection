import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { BrainCircuit, User, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react"
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError("Please fill in all fields."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    setLoading(true)
    setError(null)
    try {
      const { data } = await authAPI.register({ name, email, password })
      login(data.user, data.access_token, data.refresh_token)
      navigate("/dashboard")
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent
              flex items-center justify-center shadow-glow-primary">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Cogni<span className="text-primary">Load</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start monitoring your cognitive load</p>
        </div>

        <div className="card p-8">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50
              dark:bg-red-900/20 border border-red-200 dark:border-red-800
              px-4 py-3 text-sm text-red-600 dark:text-red-400 mb-6">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="name" type="text" autoComplete="name"
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="input pl-9"
                  placeholder="Ada Lovelace"
                  aria-required="true"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              <label htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
                <span className="ml-1 text-xs text-gray-400 font-normal">(min. 6 characters)</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password" type={showPwd ? "text" : "password"} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  aria-required="true"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPwd ? "Hide password" : "Show password"}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center mt-2"
              aria-disabled={loading}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
