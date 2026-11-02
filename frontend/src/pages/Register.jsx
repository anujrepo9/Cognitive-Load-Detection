import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff,
  Users, ShieldCheck, UserCircle2, Activity, Shield, Zap,
} from "lucide-react"
import { authAPI, getErrorMessage } from "../services/api"
import { useAuth } from "../context/AuthContext"

// ── Left-panel feature cards (same style as Login) ───────────────────────────
const features = [
  { icon: Activity, title: "Real-Time Detection",  desc: "Live cognitive load predictions via behavioral signals" },
  { icon: Shield,   title: "Privacy First",        desc: "Only interaction patterns — no screen or audio capture" },
  { icon: Zap,      title: "AI Recommendations",  desc: "Personalized insights to optimize your focus sessions" },
]

// ── Account type options ──────────────────────────────────────────────────────
const ROLES = [
  {
    value: "user",
    label: "Personal",
    icon: UserCircle2,
    color: "#37D9A0",
    desc: "Individual account for personal productivity tracking.",
  },
  {
    value: "employee",
    label: "Employee",
    icon: Users,
    color: "#00D9E8",
    desc: "Org member — your admin will link you to their team.",
  },
  {
    value: "admin",
    label: "Admin",
    icon: ShieldCheck,
    color: "#7775FF",
    desc: "Manage a team, view dashboards, and send alerts.",
    requiresCode: true,
  },
]

function redirectFor(role) {
  return role === "admin" ? "/admin/dashboard" : "/dashboard"
}

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name,      setName]      = useState("")
  const [email,     setEmail]     = useState("")
  const [password,  setPassword]  = useState("")
  const [role,      setRole]      = useState("user")
  const [adminCode, setAdminCode] = useState("")
  const [showPwd,   setShowPwd]   = useState(false)
  const [showCode,  setShowCode]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const selectedRole = ROLES.find((r) => r.value === role)
  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthColors = ["", "#FF5364", "#FFB547", "#37D9A0"]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError("Please fill in all fields."); return }
    if (password.length < 6)          { setError("Password must be at least 6 characters."); return }
    if (role === "admin" && !adminCode.trim()) { setError("Admin registration code is required."); return }
    setLoading(true); setError(null)
    try {
      const payload = { name, email, password, role }
      if (role === "admin") payload.admin_code = adminCode.trim()
      const result = await authAPI.register(payload)
      login(result.user, result.access_token, result.refresh_token)
      navigate(redirectFor(result.user?.role ?? role))
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed. Please try again."))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#05080D" }}>

      {/* ── Left panel — identical structure to Login ─────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-center px-16"
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

      {/* ── Right panel — form ───────────────────────────────────────────────── */}
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

            <div className="mb-6">
              <h2 className="text-2xl font-bold" style={{ color: "#EAF2F8" }}>Create account</h2>
              <p className="text-sm mt-1.5" style={{ color: "#8493A7" }}>Start monitoring your cognitive load</p>
            </div>

            {/* Error */}
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

              {/* ── Account type ─────────────────────────────────────────── */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>
                  Account type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => {
                    const Icon = r.icon
                    const active = role === r.value
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => { setRole(r.value); setAdminCode("") }}
                        className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-center transition-all"
                        style={{
                          background: active ? `${r.color}18` : "rgba(255,255,255,0.03)",
                          border:     active ? `1.5px solid ${r.color}` : "1.5px solid rgba(100,170,190,0.10)",
                          color:      active ? r.color : "#536477",
                          cursor:     "pointer",
                        }}>
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-semibold leading-tight">{r.label}</span>
                      </button>
                    )
                  })}
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={role}
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-[11px] mt-2 leading-relaxed"
                    style={{ color: "#536477" }}>
                    {selectedRole?.desc}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* ── Full name ────────────────────────────────────────────── */}
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>
                  Full name
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    id="reg-name" type="text" autoComplete="name"
                    value={name} onChange={(e) => setName(e.target.value)}
                    className="input pl-9" placeholder="Your name" aria-required="true"
                  />
                </div>
              </div>

              {/* ── Email ────────────────────────────────────────────────── */}
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} />
                  <input
                    id="reg-email" type="email" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input pl-9" placeholder="you@example.com" aria-required="true"
                  />
                </div>
              </div>

              {/* ── Password ─────────────────────────────────────────────── */}
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium mb-1.5" style={{ color: "#8493A7" }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#536477" }} />
                  <input
                    id="reg-password" type={showPwd ? "text" : "password"} autoComplete="new-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="input pl-9 pr-10" placeholder="Min. 6 characters" aria-required="true"
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
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: strength >= s ? strengthColors[strength] : "rgba(100,170,190,0.12)" }} />
                      ))}
                    </div>
                    <p className="text-[11px]" style={{ color: strengthColors[strength] }}>
                      {["", "Weak", "Fair", "Strong"][strength]}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Admin code (animated, only for admin role) ───────────── */}
              <AnimatePresence>
                {role === "admin" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}>
                    <label htmlFor="reg-admin-code" className="block text-sm font-medium mb-1.5" style={{ color: "#7775FF" }}>
                      Admin registration code
                    </label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#7775FF" }} />
                      <input
                        id="reg-admin-code"
                        type={showCode ? "text" : "password"}
                        autoComplete="off"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        className="input pl-9 pr-10"
                        placeholder="Code provided by system admin"
                        aria-required="true"
                        style={{ borderColor: "rgba(119,117,255,0.30)" }}
                      />
                      <button type="button" onClick={() => setShowCode(!showCode)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: "#536477" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#7775FF"}
                        onMouseLeave={e => e.currentTarget.style.color = "#536477"}
                        aria-label={showCode ? "Hide code" : "Show code"}>
                        {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] mt-1.5" style={{ color: "#536477" }}>
                      Contact your system administrator to obtain this code.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

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
    </div>
  )
}