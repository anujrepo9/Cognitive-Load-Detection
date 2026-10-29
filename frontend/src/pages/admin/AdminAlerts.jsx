import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Bell, Send, Trash2, AlertTriangle, CheckCircle2, Users,
} from "lucide-react"
import { adminAPI, getErrorMessage } from "../../services/api"
import { useToast } from "../../components/ui/Toast"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkeletonPage } from "../../components/ui/Skeleton"

const TEMPLATES = [
  {
    type: "high_load",
    label: "🔴 High Load",
    title: "Please Take a Break",
    message: "Your cognitive load readings are high. Step away from the screen for 10 minutes and hydrate.",
  },
  {
    type: "low_load",
    label: "🟡 Low Activity",
    title: "Activity Check-In",
    message: "Your activity looks low. Let me know if you need tasks reassigned or need any support.",
  },
  {
    type: "custom",
    label: "✏️ Custom",
    title: "",
    message: "",
  },
]

export default function AdminAlerts() {
  const { toast } = useToast()
  const [employees,  setEmployees]  = useState([])
  const [sentAlerts, setSentAlerts] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [sending,    setSending]    = useState(false)

  const [form, setForm] = useState({
    employee_id: "",
    alert_type:  "custom",
    title:       "",
    message:     "",
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const applyTemplate = (t) =>
    setForm(p => ({ ...p, alert_type: t.type, title: t.title, message: t.message }))

  const load = async () => {
    setLoading(true)
    try {
      const [emps, als] = await Promise.all([
        adminAPI.listEmployees(),
        adminAPI.listAlerts(),
      ])
      setEmployees(emps)
      setSentAlerts(als)
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sendAlert = async () => {
    if (!form.employee_id) { toast("error", "Select an employee"); return }
    if (!form.title.trim() || !form.message.trim()) { toast("error", "Title and message are required"); return }
    setSending(true)
    try {
      await adminAPI.sendAlert({
        employee_id: Number(form.employee_id),
        alert_type:  form.alert_type,
        title:       form.title,
        message:     form.message,
      })
      toast("success", "Alert sent")
      setForm(p => ({ ...p, title: "", message: "" }))
      // Refresh alert list
      const als = await adminAPI.listAlerts()
      setSentAlerts(als)
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const deleteAlert = async (alertId) => {
    try {
      await adminAPI.deleteAlert(alertId)
      setSentAlerts(p => p.filter(a => a.id !== alertId))
      toast("success", "Alert deleted")
    } catch (err) {
      toast("error", getErrorMessage(err))
    }
  }

  const employeeName = (id) => employees.find(e => e.id === id)?.name || `#${id}`

  if (loading) return <SkeletonPage />

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <PageHeader icon={Bell} title="Send Alerts" subtitle="Send instructions or notifications to your team" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Compose panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl p-5"
            style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
            <p className="text-[13px] font-bold mb-4" style={{ color: "#EAF2F8" }}>Compose Alert</p>

            {/* Template selector */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#8493A7" }}>Template</p>
            <div className="flex gap-2 mb-4">
              {TEMPLATES.map(t => (
                <button key={t.type} onClick={() => applyTemplate(t)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all"
                  style={form.alert_type === t.type && (t.type !== "custom" || !form.title)
                    ? { background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.22)", color: "#00D9E8" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.14)", color: "#8493A7" }
                  }>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Employee select */}
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>To Employee</label>
            <select
              value={form.employee_id}
              onChange={e => set("employee_id", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none mb-3 appearance-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
            >
              <option value="" style={{ background: "#0B1420" }}>— Select employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id} style={{ background: "#0B1420" }}>
                  {e.name} {!e.is_active ? "(inactive)" : ""}
                </option>
              ))}
            </select>

            {/* Title */}
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Title</label>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Alert title"
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none mb-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
              onFocus={e => e.target.style.borderColor = "#00D9E8"}
              onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"}
            />

            {/* Message */}
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Message</label>
            <textarea value={form.message} onChange={e => set("message", e.target.value)}
              placeholder="Your instruction or note…" rows={5}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none mb-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
              onFocus={e => e.target.style.borderColor = "#00D9E8"}
              onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"}
            />

            <button onClick={sendAlert} disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-bold transition-all"
              style={{ background: "#00D9E8", color: "#05080D", opacity: sending ? 0.7 : 1 }}>
              <Send className="w-4 h-4" />
              {sending ? "Sending…" : "Send Alert"}
            </button>
          </div>
        </div>

        {/* Sent alerts list */}
        <div className="lg:col-span-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: "#536477" }}>
            Sent Alerts ({sentAlerts.length})
          </p>
          {sentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl"
              style={{ border: "1px dashed rgba(100,170,190,0.14)" }}>
              <Bell className="w-8 h-8 mb-3" style={{ color: "#536477" }} />
              <p className="text-[14px]" style={{ color: "#536477" }}>No alerts sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentAlerts.map((alert, i) => (
                <motion.div key={alert.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl p-4"
                  style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: alert.alert_type === "high_load" ? "rgba(255,83,100,0.10)" : alert.alert_type === "low_load" ? "rgba(255,181,71,0.10)" : "rgba(0,217,232,0.08)",
                        border: `1px solid ${alert.alert_type === "high_load" ? "rgba(255,83,100,0.22)" : alert.alert_type === "low_load" ? "rgba(255,181,71,0.22)" : "rgba(0,217,232,0.15)"}`,
                      }}>
                      {alert.alert_type === "high_load"
                        ? <AlertTriangle className="w-4 h-4" style={{ color: "#FF5364" }} />
                        : <Bell className="w-4 h-4" style={{ color: alert.alert_type === "low_load" ? "#FFB547" : "#00D9E8" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>{alert.title}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(119,117,255,0.10)", color: "#7775FF" }}>
                          → {employeeName(alert.employee_id)}
                        </span>
                        {alert.is_read
                          ? <span className="flex items-center gap-1 text-[11px]" style={{ color: "#37D9A0" }}><CheckCircle2 className="w-3 h-3" /> Read</span>
                          : <span className="text-[11px]" style={{ color: "#FFB547" }}>Unread</span>}
                      </div>
                      <p className="text-[12px] mb-1" style={{ color: "#8493A7" }}>{alert.message}</p>
                      <p className="text-[11px]" style={{ color: "#536477" }}>{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => deleteAlert(alert.id)}
                      className="p-1.5 rounded-lg shrink-0 transition-all"
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
        </div>
      </div>
    </div>
  )
}