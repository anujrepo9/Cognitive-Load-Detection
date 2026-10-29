import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Activity, Monitor, Clock, Bell,
  Send, Trash2, X, AlertTriangle, CheckCircle2,
  ShieldCheck, ShieldOff, Loader2,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts"
import { adminAPI, getErrorMessage } from "../../services/api"
import { useToast } from "../../components/ui/Toast"
import LoadBadge from "../../components/ui/LoadBadge"
import { SkeletonPage } from "../../components/ui/Skeleton"

const tooltipStyle = {
  background: "rgba(9,15,24,0.95)",
  border: "1px solid rgba(0,217,232,0.22)",
  borderRadius: 10,
  fontSize: 12,
  color: "#EAF2F8",
  padding: "8px 12px",
}

// ── Alert send form ───────────────────────────────────────────────────────────

function SendAlertModal({ employeeId, employeeName, onClose, onSent }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ alert_type: "custom", title: "", message: "" })
  const [sending, setSending] = useState(false)

  const quickTemplates = [
    { type: "high_load", title: "Take a Break", message: "Your cognitive load is high. Please take a 10-minute break to recharge." },
    { type: "low_load",  title: "Check In",     message: "Your activity looks low. Let me know if you need any support or tasks." },
    { type: "custom",    title: "",             message: "" },
  ]

  const applyTemplate = (t) => setForm({ alert_type: t.type, title: t.title, message: t.message })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast("error", "Title and message are required")
      return
    }
    setSending(true)
    try {
      await adminAPI.sendAlert({ employee_id: employeeId, ...form })
      toast("success", `Alert sent to ${employeeName}`)
      onSent()
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,13,0.85)", backdropFilter: "blur(8px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold" style={{ color: "#EAF2F8" }}>
            Send Alert to {employeeName}
          </h2>
          <button onClick={onClose} style={{ color: "#536477" }} onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"} onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick templates */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#8493A7" }}>Quick Templates</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {quickTemplates.map(t => (
            <button key={t.type} onClick={() => applyTemplate(t)}
              className="px-2 py-2 rounded-lg text-[11px] font-medium text-center transition-all"
              style={{
                background: form.alert_type === t.type && form.title === t.title
                  ? "rgba(0,217,232,0.12)" : "rgba(255,255,255,0.03)",
                border: form.alert_type === t.type && form.title === t.title
                  ? "1px solid rgba(0,217,232,0.25)" : "1px solid rgba(100,170,190,0.14)",
                color: "#8493A7",
              }}>
              {t.type === "high_load" ? "🔴 High Load" : t.type === "low_load" ? "🟡 Low Load" : "✏️ Custom"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Title</label>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Alert title"
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
              onFocus={e => e.target.style.borderColor = "#00D9E8"}
              onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Message</label>
            <textarea value={form.message} onChange={e => set("message", e.target.value)} placeholder="Your instruction or note…" rows={4}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
              onFocus={e => e.target.style.borderColor = "#00D9E8"}
              onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#8493A7" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={sending}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-2"
            style={{ background: "#00D9E8", color: "#05080D", opacity: sending ? 0.7 : 1 }}>
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending…" : "Send Alert"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminEmployeeDetail() {
  const { id } = useParams()
  const { toast } = useToast()
  const [employee,  setEmployee]  = useState(null)
  const [cogniload, setCogniload] = useState([])
  const [appUsage,  setAppUsage]  = useState(null)
  const [alerts,    setAlerts]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,        setTab]        = useState("cogniload")
  const [alertModal, setAlertModal] = useState(false)
  const [promoting,  setPromoting]  = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [emp, cl, au, al] = await Promise.all([
        adminAPI.getEmployee(id),
        adminAPI.employeeCogniload(id, 60),
        adminAPI.employeeAppUsage(id, 24),
        adminAPI.alertsForEmployee(id),
      ])
      setEmployee(emp)
      setCogniload(cl)
      setAppUsage(au)
      setAlerts(al)
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const deleteAlert = async (alertId) => {
    try {
      await adminAPI.deleteAlert(alertId)
      setAlerts(p => p.filter(a => a.id !== alertId))
      toast("success", "Alert deleted")
    } catch (err) {
      toast("error", getErrorMessage(err))
    }
  }

  const handlePromoteToggle = async () => {
    if (!employee) return
    const isAdmin = employee.role === "admin"
    const confirm = window.confirm(
      isAdmin
        ? `Revoke admin access from ${employee.name}? They will become a regular employee under you.`
        : `Promote ${employee.name} to admin? They will gain full admin access and be removed from your team.`
    )
    if (!confirm) return
    setPromoting(true)
    try {
      if (isAdmin) {
        await adminAPI.revokeAdmin(employee.id)
        toast("success", `${employee.name} is now a regular employee`)
      } else {
        await adminAPI.promoteToAdmin(employee.id)
        toast("success", `${employee.name} has been promoted to admin`)
      }
      await load()
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setPromoting(false)
    }
  }

  if (loading) return <SkeletonPage />
  if (!employee) return (
    <div className="p-6 text-center" style={{ color: "#536477" }}>Employee not found.</div>
  )

  // Chart data from cogniload
  const chartData = cogniload.slice().reverse().map(p => ({
    time:  new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: p.load_level === "high" ? 3 : p.load_level === "medium" ? 2 : 1,
    label: p.load_level,
    conf:  Math.round((p.confidence || 0) * 100),
  }))

  const loadColor = { high: "#FF5364", medium: "#FFB547", low: "#37D9A0" }
  const latest    = cogniload[0]

  const TABS = [
    { key: "cogniload", label: "Cognitive Load", icon: Activity },
    { key: "appusage",  label: "App Usage",      icon: Monitor  },
    { key: "alerts",    label: `Alerts (${alerts.length})`, icon: Bell },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/employees"
          className="flex items-center gap-1.5 text-[13px] transition-colors"
          style={{ color: "#536477" }}
          onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"}
          onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[20px] font-bold" style={{ color: "#EAF2F8" }}>{employee.name}</h1>
          <p className="text-[13px]" style={{ color: "#536477" }}>{employee.email}</p>
        </div>
        {latest && <LoadBadge level={latest.load_level} animate={latest.load_level === "high"} />}
        <button
          onClick={handlePromoteToggle}
          disabled={promoting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all"
          style={employee?.role === "admin"
            ? { background: "rgba(255,83,100,0.12)", border: "1px solid rgba(255,83,100,0.28)", color: "#FF5364" }
            : { background: "rgba(119,117,255,0.12)", border: "1px solid rgba(119,117,255,0.28)", color: "#7775FF" }
          }>
          {promoting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : employee?.role === "admin"
              ? <ShieldOff className="w-4 h-4" />
              : <ShieldCheck className="w-4 h-4" />}
          {employee?.role === "admin" ? "Revoke Admin" : "Make Admin"}
        </button>
        <button
          onClick={() => setAlertModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold"
          style={{ background: "#00D9E8", color: "#05080D" }}>
          <Bell className="w-4 h-4" /> Send Alert
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Sessions Today",   value: employee.sessions_today ?? "—", color: "#00D9E8" },
          { label: "Latest Load",      value: latest?.load_level || "—",     color: loadColor[latest?.load_level] || "#536477" },
          { label: "Confidence",       value: latest ? `${Math.round(latest.confidence * 100)}%` : "—", color: "#7775FF" },
          { label: "Unread Alerts",    value: alerts.filter(a => !a.is_read).length, color: "#FFB547" },
        { label: "Role",             value: employee?.role || "employee", color: employee?.role === "admin" ? "#7775FF" : "#8493A7" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.10em] mb-2" style={{ color: "#536477" }}>{label}</p>
            <p className="text-[1.5rem] font-bold capitalize nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.10)" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 flex-1 py-2 px-3 rounded-lg text-[13px] font-medium transition-all"
            style={tab === key
              ? { background: "rgba(0,217,232,0.10)", color: "#00D9E8", border: "1px solid rgba(0,217,232,0.18)" }
              : { color: "#536477", border: "1px solid transparent" }}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === "cogniload" && (
        <div className="space-y-4">
          {chartData.length > 0 ? (
            <div className="rounded-xl p-4" style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: "#536477" }}>
                Load Level (last {chartData.length} readings)
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="clGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D9E8" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#00D9E8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,170,190,0.08)" />
                  <XAxis dataKey="time" tick={{ fill: "#536477", fontSize: 10 }} />
                  <YAxis domain={[0, 4]} ticks={[1, 2, 3]}
                    tickFormatter={v => ({ 1: "Low", 2: "Med", 3: "High" })[v] || ""}
                    tick={{ fill: "#536477", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v, _, p) => [p.payload.label, "Load"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#00D9E8" strokeWidth={2}
                    fill="url(#clGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-16 text-center" style={{ color: "#536477" }}>No cognitive load data yet.</div>
          )}

          {/* Recent predictions list */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(100,170,190,0.14)" }}>
            <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#536477" }}>Recent Predictions</p>
            </div>
            {cogniload.slice(0, 15).map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 border-t"
                style={{ borderColor: "rgba(100,170,190,0.08)" }}>
                <LoadBadge level={p.load_level} />
                <span className="text-[12px] nums" style={{ color: "#8493A7" }}>
                  {Math.round(p.confidence * 100)}% confidence
                </span>
                <span className="ml-auto text-[11px]" style={{ color: "#536477" }}>
                  {new Date(p.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "appusage" && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(100,170,190,0.14)" }}>
          <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#536477" }}>
              App Usage (last 24 h) — Total: {Math.round((appUsage?.total_tracked || 0) / 60)} min
            </p>
          </div>
          {!appUsage?.apps?.length ? (
            <div className="py-16 text-center" style={{ color: "#536477" }}>No app usage data yet.</div>
          ) : appUsage.apps.map(app => (
            <div key={app.process} className="flex items-center gap-4 px-4 py-3 border-t"
              style={{ borderColor: "rgba(100,170,190,0.08)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(0,217,232,0.08)", border: "1px solid rgba(0,217,232,0.15)" }}>
                <Monitor className="w-3.5 h-3.5" style={{ color: "#00D9E8" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: "#EAF2F8" }}>{app.process}</p>
                {app.last_window_title && (
                  <p className="text-[11px] truncate" style={{ color: "#536477" }}>{app.last_window_title}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold nums" style={{ color: "#EAF2F8" }}>
                  {Math.round(app.total_seconds / 60)} min
                </p>
                <p className="text-[11px] nums" style={{ color: "#536477" }}>{app.percentage}%</p>
              </div>
              <div className="w-24 h-1.5 rounded-full shrink-0" style={{ background: "rgba(100,170,190,0.12)" }}>
                <div className="h-full rounded-full" style={{ width: `${app.percentage}%`, background: "#00D9E8" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "#536477" }}>No alerts sent yet.</div>
          ) : alerts.map(alert => (
            <motion.div key={alert.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4"
              style={{ background: "#0B1420", border: `1px solid ${alert.is_read ? "rgba(100,170,190,0.14)" : "rgba(0,217,232,0.22)"}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: alert.alert_type === "high_load" ? "rgba(255,83,100,0.10)" : alert.alert_type === "low_load" ? "rgba(255,181,71,0.10)" : "rgba(0,217,232,0.08)",
                      border: `1px solid ${alert.alert_type === "high_load" ? "rgba(255,83,100,0.25)" : alert.alert_type === "low_load" ? "rgba(255,181,71,0.25)" : "rgba(0,217,232,0.18)"}`,
                    }}>
                    {alert.alert_type === "high_load"
                      ? <AlertTriangle className="w-4 h-4" style={{ color: "#FF5364" }} />
                      : <Bell className="w-4 h-4" style={{ color: alert.alert_type === "low_load" ? "#FFB547" : "#00D9E8" }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>{alert.title}</p>
                      {alert.is_read
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#37D9A0" }} />
                        : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,217,232,0.12)", color: "#00D9E8" }}>Unread</span>}
                    </div>
                    <p className="text-[12px]" style={{ color: "#8493A7" }}>{alert.message}</p>
                    <p className="text-[11px] mt-2" style={{ color: "#536477" }}>
                      {new Date(alert.created_at).toLocaleString()}
                      {alert.read_at && ` · Read ${new Date(alert.read_at).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteAlert(alert.id)}
                  className="p-1.5 rounded-lg transition-all shrink-0"
                  style={{ color: "#536477" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#FF5364"; e.currentTarget.style.background = "rgba(255,83,100,0.08)" }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Alert modal */}
      <AnimatePresence>
        {alertModal && (
          <SendAlertModal
            employeeId={Number(id)}
            employeeName={employee.name}
            onClose={() => setAlertModal(false)}
            onSent={() => { setAlertModal(false); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}