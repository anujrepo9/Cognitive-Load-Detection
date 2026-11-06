import { useState, useEffect, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Activity, Monitor, Bell, TrendingUp,
  Send, Trash2, X, AlertTriangle, CheckCircle2,
  ShieldCheck, ShieldOff, Loader2, Calendar, Sun,
  Users, UserPlus, Pencil, ChevronRight, Mail, 
  Eye, EyeOff, Download, Filter, CheckSquare, 
  Square, Building2, Search
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts"
import { adminAPI, getErrorMessage } from "../../services/api"
import { useToast } from "../../components/ui/Toast"
import LoadBadge from "../../components/ui/LoadBadge"
import { SkeletonPage } from "../../components/ui/Skeleton"

// ── Shared styles ─────────────────────────────────────────────────────────────

const tooltipStyle = {
  background: "rgba(9,15,24,0.95)",
  border: "1px solid rgba(0,217,232,0.22)",
  borderRadius: 10,
  fontSize: 12,
  color: "#EAF2F8",
  padding: "8px 12px",
}

const LOAD_COLORS = { high: "#FF5364", medium: "#FFB547", low: "#37D9A0" }
const SCORE_LABEL = { 1: "Low", 2: "Med", 3: "High" }

function scoreToColor(score) {
  if (!score) return "#536477"
  if (score >= 2.5) return "#FF5364"
  if (score >= 1.75) return "#FFB547"
  return "#37D9A0"
}

// ── Alert send modal (unchanged from original) ────────────────────────────────

function SendAlertModal({ employeeId, employeeName, onClose, onSent }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ alert_type: "custom", title: "", message: "" })
  const [sending, setSending] = useState(false)

  const quickTemplates = [
    { type: "high_load", title: "Take a Break",   message: "Your cognitive load is high. Please take a 10-minute break to recharge." },
    { type: "low_load",  title: "Check In",        message: "Your activity looks low. Let me know if you need any support or tasks." },
    { type: "custom",    title: "",                message: "" },
  ]

  const applyTemplate = (t) => setForm({ alert_type: t.type, title: t.title, message: t.message })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast("error", "Title and message are required"); return
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
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.18)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold" style={{ color: "#EAF2F8" }}>
            Send Alert to {employeeName}
          </h2>
          <button onClick={onClose} style={{ color: "#536477" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"}
            onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#8493A7" }}>Quick Templates</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {quickTemplates.map(t => (
            <button key={t.type} onClick={() => applyTemplate(t)}
              className="px-2 py-2 rounded-lg text-[11px] font-medium text-center transition-all"
              style={{
                background: form.alert_type === t.type && form.title === t.title ? "rgba(0,217,232,0.12)" : "rgba(255,255,255,0.03)",
                border: form.alert_type === t.type && form.title === t.title ? "1px solid rgba(0,217,232,0.25)" : "1px solid rgba(100,170,190,0.14)",
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
              onFocus={e => e.target.style.borderColor = "#00D9E8"} onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Message</label>
            <textarea value={form.message} onChange={e => set("message", e.target.value)} placeholder="Your instruction or note…" rows={4}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
              onFocus={e => e.target.style.borderColor = "#00D9E8"} onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"} />
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

// ── Trends tab ────────────────────────────────────────────────────────────────

function TrendsTab({ employeeId, employeeName }) {
  const { toast } = useToast()
  const [period,  setPeriod]  = useState("daily")
  const [days,    setDays]    = useState(30)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const d = await adminAPI.employeeLoadTrends(employeeId, period, days)
      setData(d)
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [employeeId, period, days])

  useEffect(() => { fetch() }, [fetch])

  // ── Insight sentence ───────────────────────────────────────────────────────
  const insight = (() => {
    if (!data?.summary?.total_predictions) return null
    const { worst_dow_label, worst_day_label, pct_high } = data.summary
    const parts = []
    if (worst_dow_label && pct_high > 20)
      parts.push(`${employeeName.split(" ")[0]} tends to peak on ${worst_dow_label}s`)
    if (pct_high > 50)
      parts.push(`high load dominates ${pct_high}% of readings`)
    else if (pct_high < 15)
      parts.push(`load stays manageable overall (only ${pct_high}% high)`)
    return parts.length ? parts.join(" · ") : null
  })()

  // ── Chart: daily series ────────────────────────────────────────────────────
  const seriesData = (data?.daily_series || []).map(d => ({
    ...d,
    dateLabel: period === "weekly"
      ? d.date.replace("W", "W")
      : new Date(d.date + "T12:00:00Z").toLocaleDateString([], { month: "short", day: "numeric" }),
  }))

  // ── Chart: DOW heatmap ─────────────────────────────────────────────────────
  const dowData = (data?.dow_heatmap || []).filter(d => d.count > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "rgba(0,217,232,0.3)", borderTopColor: "#00D9E8" }} />
      </div>
    )
  }

  if (!data?.summary?.total_predictions) {
    return (
      <div className="flex flex-col items-center justify-center py-24"
        style={{ border: "1px dashed rgba(100,170,190,0.14)", borderRadius: 16 }}>
        <TrendingUp className="w-8 h-8 mb-3" style={{ color: "#536477" }} />
        <p className="text-[14px]" style={{ color: "#536477" }}>No data in the selected window.</p>
        <p className="text-[12px] mt-1" style={{ color: "#2D3A4A" }}>Try extending the range or waiting for more sessions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.10)" }}>
          {["daily", "weekly"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-all"
              style={period === p
                ? { background: "rgba(0,217,232,0.10)", color: "#00D9E8", border: "1px solid rgba(0,217,232,0.18)" }
                : { color: "#536477", border: "1px solid transparent" }}>
              {p}
            </button>
          ))}
        </div>

        {/* Days window */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.10)" }}>
          {[7, 14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
              style={days === d
                ? { background: "rgba(119,117,255,0.12)", color: "#7775FF", border: "1px solid rgba(119,117,255,0.22)" }
                : { color: "#536477", border: "1px solid transparent" }}>
              {d}d
            </button>
          ))}
        </div>

        <div className="ml-auto text-[12px]" style={{ color: "#536477" }}>
          {data.summary.total_predictions} predictions
        </div>
      </div>

      {/* Insight banner */}
      {insight && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(119,117,255,0.07)", border: "1px solid rgba(119,117,255,0.18)" }}>
          <Sun className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#7775FF" }} />
          <p className="text-[13px] capitalize" style={{ color: "#7775FF" }}>💡 {insight}</p>
        </motion.div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "High",   pct: data.summary.pct_high,   color: "#FF5364", bg: "rgba(255,83,100,0.08)",  border: "rgba(255,83,100,0.18)"  },
          { label: "Medium", pct: data.summary.pct_medium, color: "#FFB547", bg: "rgba(255,181,71,0.08)",  border: "rgba(255,181,71,0.18)"  },
          { label: "Low",    pct: data.summary.pct_low,    color: "#37D9A0", bg: "rgba(55,217,160,0.08)",  border: "rgba(55,217,160,0.18)"  },
        ].map(({ label, pct, color, bg, border }) => (
          <div key={label} className="rounded-xl p-4 text-center"
            style={{ background: bg, border: `1px solid ${border}` }}>
            <p className="text-[22px] font-bold nums" style={{ color }}>{pct}%</p>
            <p className="text-[11px] font-semibold mt-0.5" style={{ color }}>{label} Load</p>
          </div>
        ))}
      </div>

      {/* Chart 1: Average load score over time */}
      <div className="rounded-xl p-5" style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4" style={{ color: "#00D9E8" }} />
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#536477" }}>
            Average Load Score — {period === "daily" ? "per day" : "per week"}
          </p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={seriesData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,170,190,0.08)" />
            <XAxis dataKey="dateLabel"
              tick={{ fill: "#536477", fontSize: 10 }}
              interval={Math.max(0, Math.floor(seriesData.length / 8) - 1)}
            />
            <YAxis domain={[1, 3]} ticks={[1, 2, 3]}
              tickFormatter={v => SCORE_LABEL[v] || ""}
              tick={{ fill: "#536477", fontSize: 10 }} />
            <ReferenceLine y={2.5} stroke="rgba(255,83,100,0.3)" strokeDasharray="4 2" />
            <ReferenceLine y={1.75} stroke="rgba(255,181,71,0.25)" strokeDasharray="4 2" />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(v, _) => [v.toFixed(2), "Avg Score"]}
              labelFormatter={l => `Date: ${l}`} />
            <Line
              type="monotone" dataKey="avg_score" strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props
                const c = scoreToColor(payload.avg_score)
                return <circle key={props.key} cx={cx} cy={cy} r={3} fill={c} stroke={c} strokeWidth={1} />
              }}
              activeDot={{ r: 5 }}
              stroke="#00D9E8"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 justify-end">
          {[
            { label: "High threshold",   color: "rgba(255,83,100,0.5)" },
            { label: "Medium threshold", color: "rgba(255,181,71,0.4)" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-4 h-px border-t-2 border-dashed" style={{ borderColor: color }} />
              <span className="text-[10px]" style={{ color: "#536477" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart 2: Stacked % by period */}
      <div className="rounded-xl p-5" style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4" style={{ color: "#7775FF" }} />
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#536477" }}>
            Load Distribution — {period === "daily" ? "daily breakdown" : "weekly breakdown"}
          </p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={seriesData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,170,190,0.08)" />
            <XAxis dataKey="dateLabel"
              tick={{ fill: "#536477", fontSize: 10 }}
              interval={Math.max(0, Math.floor(seriesData.length / 8) - 1)} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`}
              tick={{ fill: "#536477", fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(v, name) => [`${v}%`, name.charAt(0).toUpperCase() + name.slice(1)]}
              labelFormatter={l => `Date: ${l}`} />
            <Bar dataKey="pct_high"   stackId="a" fill="#FF5364" name="high"   radius={[0, 0, 0, 0]} />
            <Bar dataKey="pct_medium" stackId="a" fill="#FFB547" name="medium" radius={[0, 0, 0, 0]} />
            <Bar dataKey="pct_low"    stackId="a" fill="#37D9A0" name="low"    radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Day-of-week heatmap */}
      <div className="rounded-xl p-5" style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4" style={{ color: "#FFB547" }} />
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#536477" }}>
            Day-of-Week Pattern
          </p>
          {data.summary.worst_dow_label && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-lg font-semibold"
              style={{ background: "rgba(255,83,100,0.10)", color: "#FF5364", border: "1px solid rgba(255,83,100,0.20)" }}>
              Worst: {data.summary.worst_dow_label}
            </span>
          )}
        </div>
        <p className="text-[11px] mb-4" style={{ color: "#2D3A4A" }}>
          Average load score per weekday across all {days} days — reveals recurring stress patterns
        </p>

        {/* Visual bar heatmap */}
        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => {
            const dow = i + 1
            const entry = data.dow_heatmap.find(d => d.dow === dow)
            const score = entry?.avg_score
            const color = scoreToColor(score)
            const pctH  = entry?.pct_high ?? 0
            const count = entry?.count ?? 0
            const barH  = score ? Math.round(((score - 1) / 2) * 100) : 0

            const isWorst = data.summary.worst_dow_label === label

            return (
              <div key={label} className="flex flex-col items-center gap-2">
                {/* Bar */}
                <div className="w-full relative rounded-lg overflow-hidden"
                  style={{ height: 80, background: "rgba(255,255,255,0.03)", border: `1px solid ${isWorst ? color : "rgba(100,170,190,0.10)"}` }}>
                  <div className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-500"
                    style={{ height: `${barH}%`, background: color, opacity: count > 0 ? 0.75 : 0.15 }} />
                  {score && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-bold nums" style={{ color }}>
                        {score.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className="text-center">
                  <p className="text-[11px] font-semibold" style={{ color: isWorst ? color : "#8493A7" }}>{label}</p>
                  {count > 0 && (
                    <p className="text-[9px]" style={{ color: "#2D3A4A" }}>{count} pred</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* % high per DOW */}
        {dowData.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: "#536477" }}>
              % High load per weekday
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data.dow_heatmap.filter(d => d.count > 0)}
                margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,170,190,0.08)" />
                <XAxis dataKey="label" tick={{ fill: "#536477", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`}
                  tick={{ fill: "#536477", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v, _) => [`${v}%`, "High load"]} />
                <Bar dataKey="pct_high" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {data.dow_heatmap.filter(d => d.count > 0).map((entry, i) => (
                    <Cell key={i}
                      fill={entry.pct_high > 50 ? "#FF5364" : entry.pct_high > 25 ? "#FFB547" : "#37D9A0"}
                      fillOpacity={0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminEmployeeDetail() {
  const { id } = useParams()
  const { toast } = useToast()
  const [employee,   setEmployee]   = useState(null)
  const [cogniload,  setCogniload]  = useState([])
  const [appUsage,   setAppUsage]   = useState(null)
  const [alerts,     setAlerts]     = useState([])
  const [loading,    setLoading]    = useState(true)
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
    const isAdminRole = employee.role === "admin"
    const confirm = window.confirm(
      isAdminRole
        ? `Revoke admin access from ${employee.name}? They will become a regular employee under you.`
        : `Promote ${employee.name} to admin? They will gain full admin access and be removed from your team.`
    )
    if (!confirm) return
    setPromoting(true)
    try {
      if (isAdminRole) {
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

  // Live chart data (last-N-readings tab)
  const chartData = cogniload.slice().reverse().map(p => ({
    time:  new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: p.load_level === "high" ? 3 : p.load_level === "medium" ? 2 : 1,
    label: p.load_level,
    conf:  Math.round((p.confidence || 0) * 100),
  }))

  const latest = cogniload[0]

  const TABS = [
    { key: "cogniload", label: "Cognitive Load", icon: Activity     },
    { key: "trends",    label: "Trends",          icon: TrendingUp  },
    { key: "appusage",  label: "App Usage",        icon: Monitor     },
    { key: "alerts",    label: `Alerts (${alerts.length})`, icon: Bell },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back + header */}
      <div className="flex items-center gap-4 flex-wrap">
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
          onClick={handlePromoteToggle} disabled={promoting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all"
          style={employee?.role === "admin"
            ? { background: "rgba(255,83,100,0.12)", border: "1px solid rgba(255,83,100,0.28)", color: "#FF5364" }
            : { background: "rgba(119,117,255,0.12)", border: "1px solid rgba(119,117,255,0.28)", color: "#7775FF" }}>
          {promoting ? <Loader2 className="w-4 h-4 animate-spin" />
            : employee?.role === "admin" ? <ShieldOff className="w-4 h-4" />
            : <ShieldCheck className="w-4 h-4" />}
          {employee?.role === "admin" ? "Revoke Admin" : "Make Admin"}
        </button>
        <button onClick={() => setAlertModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold"
          style={{ background: "#00D9E8", color: "#05080D" }}>
          <Bell className="w-4 h-4" /> Send Alert
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Sessions Today",  value: employee.sessions_today ?? "—",             color: "#00D9E8" },
          { label: "Latest Load",     value: latest?.load_level || "—",                  color: LOAD_COLORS[latest?.load_level] || "#536477" },
          { label: "Confidence",      value: latest ? `${Math.round(latest.confidence * 100)}%` : "—", color: "#7775FF" },
          { label: "Unread Alerts",   value: alerts.filter(a => !a.is_read).length,       color: "#FFB547" },
          { label: "Role",            value: employee?.role || "employee",                color: employee?.role === "admin" ? "#7775FF" : "#8493A7" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.10em] mb-2" style={{ color: "#536477" }}>{label}</p>
            <p className="text-[1.5rem] font-bold capitalize nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl flex-wrap"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.10)" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 flex-1 py-2 px-3 rounded-lg text-[13px] font-medium transition-all min-w-[100px]"
            style={tab === key
              ? { background: "rgba(0,217,232,0.10)", color: "#00D9E8", border: "1px solid rgba(0,217,232,0.18)" }
              : { color: "#536477", border: "1px solid transparent" }}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Cognitive Load (live readings) ─────────────────────────── */}
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
                    formatter={(v, _, p) => [p.payload.label, "Load"]} />
                  <Area type="monotone" dataKey="value" stroke="#00D9E8" strokeWidth={2}
                    fill="url(#clGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-16 text-center" style={{ color: "#536477" }}>No cognitive load data yet.</div>
          )}

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

      {/* ── Tab: Trends ──────────────────────────────────────────────────── */}
      {tab === "trends" && (
        <TrendsTab employeeId={Number(id)} employeeName={employee.name} />
      )}

      {/* ── Tab: App Usage ───────────────────────────────────────────────── */}
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
                <p className="text-[13px] font-semibold nums" style={{ color: "#EAF2F8" }}>{Math.round(app.total_seconds / 60)} min</p>
                <p className="text-[11px] nums" style={{ color: "#536477" }}>{app.percentage}%</p>
              </div>
              <div className="w-24 h-1.5 rounded-full shrink-0" style={{ background: "rgba(100,170,190,0.12)" }}>
                <div className="h-full rounded-full" style={{ width: `${app.percentage}%`, background: "#00D9E8" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Alerts ──────────────────────────────────────────────────── */}
      {tab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "#536477" }}>No alerts sent yet.</div>
          ) : alerts.map(alert => (
            <motion.div key={alert.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
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
                        : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(0,217,232,0.12)", color: "#00D9E8" }}>Unread</span>}
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