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

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthLabel = ["", "Weak", "Fair", "Strong"]
  const strengthColors = ["", "#FF5364", "#FFB547", "#37D9A0"]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError("Please fill in all fields."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    setLoading(true); setError(null)
    try {
      const result = await authAPI.register({ name, email, password })
      login(result.user, result.access_token, result.refresh_token)
      navigate(result.user?.role === "admin" ? "/admin/dashboard" : "/dashboard")
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed. Please try again."))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "#05080D" }}>
      {/* Ambient glows */}
      <div className="fixed top-0 left-0 w-96 h-96 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(0,217,232,0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />
      <div className="fixed bottom-0 right-0 w-64 h-64 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(119,117,255,0.06) 0%, transparent 70%)", filter: "blur(48px)" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative z-10">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00D9E8, #00BFA6)", boxShadow: "0 0 20px rgba(0,217,232,0.40)" }}>
              <BrainCircuit className="w-5 h-5" style={{ color: "#05080D" }} />
            </div>
            <span className="text-xl font-bold" style={{ color: "#EAF2F8" }}>
              Cogni<span style={{ color: "#00D9E8" }}>Load</span>
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="p-8 rounded-2xl"
          style={{
            background: "#0B1420",
            border: "1px solid rgba(100,170,190,0.14)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,217,232,0.05)",
          }}>
          <div className="mb-7">
            <h2 className="text-2xl font-bold" style={{ color: "#EAF2F8" }}>Create account</h2>
            <p className="text-sm mt-1.5" style={{ color: "#8493A7" }}>Start monitoring your cognitive load</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm mb-5"
              style={{ background: "rgba(255,83,100,0.10)", border: "1px solid rgba(255,83,100,0.25)", color: "#FF5364" }}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} />
                <input id="name" type="text" autoComplete="name"
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="input pl-9" placeholder="Your name" aria-required="true" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} />
                <input id="email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9" placeholder="you@example.com" aria-required="true" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} />
                <input id="password" type={showPwd ? "text" : "password"} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 pr-10" placeholder="Min. 6 characters" aria-required="true" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#536477" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#00D9E8"}
                  onMouseLeave={e => e.currentTarget.style.color = "#536477"}
                  aria-label={showPwd ? "Hide password" : "Show password"}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map((s) => (
                      <div key={s} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: strength >= s ? strengthColors[strength] : "rgba(100,170,190,0.12)" }} />
                    ))}
                  </div>
                  <p className="text-[11px]" style={{ color: strengthColors[strength] || "#536477" }}>
                    {strengthLabel[strength]}
                  </p>
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

          <p className="text-center text-sm mt-6" style={{ color: "#536477" }}>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold transition-colors" style={{ color: "#00D9E8" }}>
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}