import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { BrainCircuit, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, Zap, Shield, Activity } from "lucide-react"
import { authAPI, getErrorMessage } from "../services/api"
import { useAuth } from "../context/AuthContext"

const features = [
  { icon: Activity,  title: "Real-Time Detection",  desc: "Live cognitive load predictions via behavioral signals" },
  { icon: Shield,    title: "Privacy First",        desc: "Only interaction patterns — no screen or audio capture" },
  { icon: Zap,       title: "AI Recommendations",  desc: "Personalized insights to optimize your focus sessions" },
]

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
    setLoading(true); setError(null)
    try {
      const result = await authAPI.login({ email, password })
      login(result.user, result.access_token, result.refresh_token)
      navigate(result.user?.role === "admin" ? "/admin/dashboard" : "/dashboard")
    } catch (err) {
      setError(getErrorMessage(err, "Invalid credentials. Please try again."))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#05080D" }}>
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-center px-16"
        style={{ background: "linear-gradient(135deg, #050B10 0%, #090F18 100%)", borderRight: "1px solid rgba(100,170,190,0.10)" }}>
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{
            backgroundImage: "linear-gradient(rgba(0,217,232,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,232,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }} />
        {/* Ambient glows */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(0,217,232,0.10) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(119,117,255,0.08) 0%, transparent 70%)", filter: "blur(48px)" }} />

        <div className="relative z-10">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00D9E8, #00BFA6)", boxShadow: "0 0 24px rgba(0,217,232,0.40)" }}>
              <BrainCircuit className="w-6 h-6" style={{ color: "#05080D" }} />
            </div>
            <div>
              <span className="text-xl font-bold" style={{ color: "#EAF2F8" }}>
                Cogni<span style={{ color: "#00D9E8" }}>Load</span>
              </span>
              <div className="text-[10px] tracking-[0.12em] uppercase font-semibold mt-0.5" style={{ color: "#536477" }}>
                AI Command Center
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4" style={{ color: "#EAF2F8" }}>
            Monitor your mind,<br />
            <span style={{
              background: "linear-gradient(135deg, #00D9E8, #00BFA6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              not just your screen.
            </span>
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-sm" style={{ color: "#8493A7" }}>
            CogniLoad detects cognitive overload in real time using keyboard and mouse patterns —
            so you can work smarter, not harder.
          </p>

          <div className="flex flex-col gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl"
                style={{ background: "rgba(0,217,232,0.05)", border: "1px solid rgba(0,217,232,0.12)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.20)" }}>
                  <Icon className="w-4 h-4" style={{ color: "#00D9E8" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#EAF2F8" }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8493A7" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #00D9E8, #00BFA6)", boxShadow: "0 0 16px rgba(0,217,232,0.35)" }}>
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
              <h2 className="text-2xl font-bold" style={{ color: "#EAF2F8" }}>Welcome back</h2>
              <p className="text-sm mt-1.5" style={{ color: "#8493A7" }}>Sign in to your account to continue</p>
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
                <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} />
                  <input
                    id="email" type="email" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input pl-9" placeholder="you@example.com" aria-required="true"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} />
                  <input
                    id="password" type={showPwd ? "text" : "password"} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="input pl-9 pr-10" placeholder="••••••••" aria-required="true"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "#536477" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#00D9E8"}
                    onMouseLeave={e => e.currentTarget.style.color = "#536477"}
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

            <p className="text-center text-sm mt-6" style={{ color: "#536477" }}>
              No account?{" "}
              <Link to="/register" className="font-semibold transition-colors" style={{ color: "#00D9E8" }}>
                Create one free
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}