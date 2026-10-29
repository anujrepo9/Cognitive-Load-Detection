/**
 * AdminSettings.jsx
 *
 * Three sections:
 *  1. Alert Thresholds — high-load count trigger + confidence floor
 *  2. Alert Templates  — up to 5 reusable templates (create / edit / delete inline)
 *  3. Transfer Team    — reassign employees to another admin
 *
 * Bonus (bottom): Audit log viewer
 */

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Settings2, Bell, RefreshCw, Save, Loader2, CheckCircle2,
  AlertCircle, Plus, Trash2, Users, ArrowRightLeft, ShieldCheck,
  ClipboardList, ChevronDown, ChevronUp, X,
} from "lucide-react"
import { adminAPI, getErrorMessage } from "../../services/api"
import { useToast } from "../../components/ui/Toast"
import PageHeader from "../../components/ui/PageHeader"
import { SkeletonPage } from "../../components/ui/Skeleton"

// ── Small reusable components ─────────────────────────────────────────────────

function Section({ icon: Icon, iconColor = "#00D9E8", iconBg = "rgba(0,217,232,0.08)", iconBorder = "rgba(0,217,232,0.18)", title, children }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconBg, border: `1px solid ${iconBorder}` }}>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <h2 className="text-[14px] font-bold" style={{ color: "#EAF2F8" }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] font-medium" style={{ color: "#EAF2F8" }}>{label}</p>
        {hint && <p className="text-[12px] mt-0.5" style={{ color: "#536477" }}>{hint}</p>}
      </div>
      <button
        role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className="w-11 h-6 rounded-full relative shrink-0 focus-visible:outline-none"
        style={{ background: on ? "#00D9E8" : "rgba(100,170,190,0.15)", transition: "background 0.2s" }}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0"}`}
          style={{ background: on ? "#05080D" : "#8493A7" }} aria-hidden="true" />
      </button>
    </div>
  )
}

function NumberStepper({ value, onChange, min, max, step = 1, label, hint, unit }) {
  return (
    <div>
      <p className="text-[13px] font-medium mb-0.5" style={{ color: "#EAF2F8" }}>{label}</p>
      {hint && <p className="text-[12px] mb-2" style={{ color: "#536477" }}>{hint}</p>}
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#00D9E8"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(100,170,190,0.18)"}>
          −
        </button>
        <span className="text-[20px] font-bold nums w-16 text-center" style={{ color: "#00D9E8" }}>
          {value}{unit && <span className="text-[12px] font-normal ml-0.5" style={{ color: "#536477" }}>{unit}</span>}
        </span>
        <button onClick={() => onChange(Math.min(max, value + step))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#00D9E8"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(100,170,190,0.18)"}>
          +
        </button>
      </div>
    </div>
  )
}

const INPUT = {
  className: "w-full px-3 py-2.5 rounded-lg text-[13px] outline-none",
  style: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" },
}

const TEMPLATE_TYPES = [
  { value: "high_load", label: "🔴 High Load" },
  { value: "low_load",  label: "🟡 Low Load"  },
  { value: "custom",    label: "✏️ Custom"     },
]

// ── Template editor row ───────────────────────────────────────────────────────

function TemplateRow({ tpl, index, onChange, onDelete }) {
  const [open, setOpen] = useState(false)
  const set = (k, v) => onChange(index, { ...tpl, [k]: v })

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(100,170,190,0.14)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        style={{ background: "rgba(255,255,255,0.02)" }}
        onClick={() => setOpen(o => !o)}>
        <span className="text-[12px] font-semibold flex-1" style={{ color: "#EAF2F8" }}>
          {tpl.label || tpl.title || `Template ${index + 1}`}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded" style={{
          background: "rgba(119,117,255,0.10)", color: "#7775FF",
          border: "1px solid rgba(119,117,255,0.20)",
        }}>
          {TEMPLATE_TYPES.find(t => t.value === tpl.alert_type)?.label || tpl.alert_type}
        </span>
        <button onClick={e => { e.stopPropagation(); onDelete(index) }}
          className="p-1 rounded transition-all"
          style={{ color: "#536477" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#FF5364"; e.currentTarget.style.background = "rgba(255,83,100,0.08)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {open ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "#536477" }} />
               : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#536477" }} />}
      </div>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Button Label</label>
                  <input {...INPUT} value={tpl.label} onChange={e => set("label", e.target.value)} placeholder="e.g. Break Reminder"
                    onFocus={e => e.target.style.borderColor = "#00D9E8"} onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Type</label>
                  <select {...INPUT} value={tpl.alert_type} onChange={e => set("alert_type", e.target.value)}
                    style={{ ...INPUT.style, appearance: "none" }}>
                    {TEMPLATE_TYPES.map(t => (
                      <option key={t.value} value={t.value} style={{ background: "#0B1420" }}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Alert Title</label>
                <input {...INPUT} value={tpl.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Please take a break"
                  onFocus={e => e.target.style.borderColor = "#00D9E8"} onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>Message</label>
                <textarea {...INPUT} rows={3} value={tpl.message} onChange={e => set("message", e.target.value)}
                  placeholder="Your pre-written message…"
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
                  onFocus={e => e.target.style.borderColor = "#00D9E8"} onBlur={e => e.target.style.borderColor = "rgba(100,170,190,0.18)"} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Transfer Team modal ───────────────────────────────────────────────────────

function TransferModal({ employees, onClose, onTransferred }) {
  const { toast } = useToast()
  const [admins,   setAdmins]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [targetId, setTargetId] = useState("")
  const [selected, setSelected] = useState(new Set())   // empty = all
  const [mode,     setMode]     = useState("all")       // "all" | "select"
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    adminAPI.listAdmins()
      .then(setAdmins)
      .catch(() => toast("error", "Could not load admin list"))
      .finally(() => setLoading(false))
  }, [])

  const toggleEmployee = (id) => setSelected(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const submit = async () => {
    if (!targetId) { toast("error", "Select a target admin"); return }
    setBusy(true)
    try {
      const body = {
        target_admin_id: Number(targetId),
        employee_ids: mode === "select" && selected.size > 0 ? [...selected] : undefined,
      }
      const result = await adminAPI.transferTeam(body)
      toast("success", `${result.transferred_count} employee${result.transferred_count !== 1 ? "s" : ""} transferred to ${result.target_admin_name}`)
      onTransferred()
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,13,0.88)", backdropFilter: "blur(8px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: "#0B1420", border: "1px solid rgba(119,117,255,0.28)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(119,117,255,0.10)", border: "1px solid rgba(119,117,255,0.22)" }}>
              <ArrowRightLeft className="w-4 h-4" style={{ color: "#7775FF" }} />
            </div>
            <h2 className="text-[16px] font-bold" style={{ color: "#EAF2F8" }}>Transfer Team</h2>
          </div>
          <button onClick={onClose} style={{ color: "#536477" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"}
            onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target admin */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#8493A7" }}>
            Transfer to Admin
          </label>
          {loading ? (
            <div className="py-4 text-center text-[13px]" style={{ color: "#536477" }}>Loading admins…</div>
          ) : admins.length === 0 ? (
            <div className="py-4 rounded-xl text-center text-[13px]"
              style={{ border: "1px dashed rgba(100,170,190,0.18)", color: "#536477" }}>
              No other admins exist yet. Create another admin account first.
            </div>
          ) : (
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none appearance-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}>
              <option value="" style={{ background: "#0B1420" }}>— Select admin —</option>
              {admins.map(a => (
                <option key={a.id} value={a.id} style={{ background: "#0B1420" }}>{a.name} ({a.email})</option>
              ))}
            </select>
          )}
        </div>

        {/* Who to transfer */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#8493A7" }}>
            Which Employees
          </label>
          <div className="flex gap-2 mb-3">
            {[{ k: "all", label: `All (${employees.length})` }, { k: "select", label: "Select…" }].map(({ k, label }) => (
              <button key={k} onClick={() => setMode(k)}
                className="flex-1 py-2 rounded-lg text-[12px] font-medium transition-all"
                style={mode === k
                  ? { background: "rgba(119,117,255,0.12)", border: "1px solid rgba(119,117,255,0.28)", color: "#7775FF" }
                  : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.14)", color: "#8493A7" }}>
                {label}
              </button>
            ))}
          </div>

          {mode === "select" && employees.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {employees.map(emp => (
                <label key={emp.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all"
                  style={{ background: selected.has(emp.id) ? "rgba(119,117,255,0.07)" : "rgba(255,255,255,0.02)" }}>
                  <input type="checkbox" checked={selected.has(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                    className="w-3.5 h-3.5 accent-[#7775FF]" />
                  <span className="text-[13px]" style={{ color: "#EAF2F8" }}>{emp.name}</span>
                  <span className="text-[11px] ml-auto" style={{ color: "#536477" }}>{emp.email}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-5"
          style={{ background: "rgba(255,181,71,0.07)", border: "1px solid rgba(255,181,71,0.20)" }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#FFB547" }} />
          <p className="text-[12px]" style={{ color: "#FFB547" }}>
            Transferred employees will appear in the target admin's team immediately and will no longer be visible to you.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#8493A7" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !targetId || admins.length === 0}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: "rgba(119,117,255,0.15)",
              border: "1px solid rgba(119,117,255,0.30)",
              color: "#7775FF",
              opacity: (busy || !targetId) ? 0.6 : 1,
            }}>
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Transferring…</> : <><ArrowRightLeft className="w-4 h-4" /> Transfer</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Audit log panel ───────────────────────────────────────────────────────────

const ACTION_META = {
  promote_to_admin:    { label: "Promoted to Admin",    color: "#7775FF", bg: "rgba(119,117,255,0.10)" },
  revoke_admin:        { label: "Revoked Admin",        color: "#FF5364", bg: "rgba(255,83,100,0.10)"  },
  transfer_team:       { label: "Transferred Team",     color: "#FFB547", bg: "rgba(255,181,71,0.10)"  },
  create_employee:     { label: "Created Employee",     color: "#37D9A0", bg: "rgba(55,217,160,0.10)"  },
  update_employee:     { label: "Updated Employee",     color: "#00D9E8", bg: "rgba(0,217,232,0.10)"   },
  deactivate_employee: { label: "Deactivated Employee", color: "#FF5364", bg: "rgba(255,83,100,0.10)"  },
  send_alert:          { label: "Sent Alert",           color: "#00D9E8", bg: "rgba(0,217,232,0.10)"   },
  delete_alert:        { label: "Deleted Alert",        color: "#536477", bg: "rgba(83,100,119,0.10)"  },
}

function AuditPanel() {
  const { toast } = useToast()
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.auditLog(50)
      .then(setLogs)
      .catch(() => toast("error", "Could not load audit log"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Section icon={ClipboardList} iconColor="#FFB547"
      iconBg="rgba(255,181,71,0.08)" iconBorder="rgba(255,181,71,0.18)"
      title="Audit Log">
      {loading ? (
        <div className="py-8 text-center" style={{ color: "#536477" }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center" style={{ color: "#536477" }}>No actions recorded yet.</div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {logs.map(log => {
            const meta = ACTION_META[log.action] || { label: log.action, color: "#8493A7", bg: "rgba(255,255,255,0.04)" }
            let detail = null
            try { detail = log.detail ? JSON.parse(log.detail) : null } catch { detail = null }
            return (
              <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(100,170,190,0.08)" }}>
                <span className="text-[11px] font-bold px-2 py-1 rounded-lg shrink-0 mt-0.5"
                  style={{ background: meta.bg, color: meta.color }}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  {detail?.name && (
                    <p className="text-[12px] font-medium truncate" style={{ color: "#EAF2F8" }}>{detail.name}</p>
                  )}
                  {detail?.to_admin_name && (
                    <p className="text-[12px]" style={{ color: "#8493A7" }}>→ {detail.to_admin_name} ({detail.count} employees)</p>
                  )}
                  {detail?.email && (
                    <p className="text-[11px] truncate" style={{ color: "#536477" }}>{detail.email}</p>
                  )}
                </div>
                <p className="text-[11px] shrink-0" style={{ color: "#536477" }}>
                  {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminSettings() {
  const { toast } = useToast()

  const [settings,       setSettings]       = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)

  // Local editable copies of settings
  const [thresholdCount, setThresholdCount] = useState(0)
  const [minConf,        setMinConf]        = useState(75)   // stored ×100 for display
  const [refreshSec,     setRefreshSec]     = useState(60)
  const [autoAlerts,     setAutoAlerts]     = useState(false)
  const [templates,      setTemplates]      = useState([])

  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false)
  const [employees,    setEmployees]    = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, emps] = await Promise.all([
        adminAPI.getSettings(),
        adminAPI.listEmployees(),
      ])
      setSettings(s)
      setThresholdCount(s.high_load_threshold_count)
      setMinConf(Math.round((s.min_confidence ?? 0.75) * 100))
      setRefreshSec(s.dashboard_refresh_sec ?? 60)
      setAutoAlerts((s.high_load_threshold_count ?? 0) > 0)
      setTemplates(s.alert_templates ?? [])
      setEmployees(emps)
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await adminAPI.updateSettings({
        high_load_threshold_count: autoAlerts ? thresholdCount : 0,
        min_confidence:            minConf / 100,
        dashboard_refresh_sec:     refreshSec,
        alert_templates:           templates,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const addTemplate = () => {
    if (templates.length >= 5) { toast("error", "Maximum 5 templates"); return }
    setTemplates(prev => [...prev, { label: "", alert_type: "custom", title: "", message: "" }])
  }

  const updateTemplate = (i, t) => setTemplates(prev => prev.map((x, idx) => idx === i ? t : x))
  const deleteTemplate = (i)    => setTemplates(prev => prev.filter((_, idx) => idx !== i))

  if (loading) return <SkeletonPage />

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header + Save */}
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          icon={Settings2}
          title="Admin Settings"
          subtitle="Alert thresholds, templates, and team management"
        />
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all shrink-0"
          style={{ background: "#00D9E8", color: "#05080D", opacity: saving ? 0.7 : 1 }}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
                           : <><Save className="w-4 h-4" /> Save Settings</>}
        </button>
      </div>

      {/* ── Section 1: Alert Thresholds ──────────────────────────────────── */}
      <Section icon={Bell} title="Alert Thresholds"
        iconColor="#FF5364" iconBg="rgba(255,83,100,0.08)" iconBorder="rgba(255,83,100,0.18)">

        <div className="space-y-5">
          <Toggle
            on={autoAlerts}
            onChange={(v) => { setAutoAlerts(v); if (!v) setThresholdCount(0) }}
            label="Auto-alerts (coming soon)"
            hint="Automatically fire an alert when an employee's load stays high for N consecutive readings. Backend job required."
          />

          <AnimatePresence initial={false}>
            {autoAlerts && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="pt-2 space-y-5">
                  <NumberStepper
                    value={thresholdCount} onChange={setThresholdCount}
                    min={1} max={30} step={1}
                    label="Consecutive high-load readings"
                    hint="How many back-to-back 'high' predictions before an auto-alert fires."
                    unit=" readings"
                  />
                  <NumberStepper
                    value={minConf} onChange={setMinConf}
                    min={50} max={99} step={5}
                    label="Minimum confidence"
                    hint="Predictions below this confidence are ignored when counting toward the threshold."
                    unit="%"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-px" style={{ background: "rgba(100,170,190,0.10)" }} />

          <NumberStepper
            value={refreshSec} onChange={setRefreshSec}
            min={0} max={300} step={15}
            label="Dashboard auto-refresh"
            hint="How often the team overview refreshes automatically. Set to 0 to disable."
            unit="s"
          />
        </div>
      </Section>

      {/* ── Section 2: Alert Templates ──────────────────────────────────── */}
      <Section icon={Bell} title="Custom Alert Templates"
        iconColor="#7775FF" iconBg="rgba(119,117,255,0.08)" iconBorder="rgba(119,117,255,0.18)">

        <p className="text-[12px] mb-4" style={{ color: "#536477" }}>
          Save up to 5 reusable templates. They appear in the quick-pick buttons when composing alerts.
        </p>

        <div className="space-y-2 mb-3">
          <AnimatePresence initial={false}>
            {templates.map((tpl, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}>
                <TemplateRow
                  tpl={tpl} index={i}
                  onChange={updateTemplate}
                  onDelete={deleteTemplate}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <button onClick={addTemplate} disabled={templates.length >= 5}
          className="flex items-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-medium transition-all"
          style={{
            background: "rgba(119,117,255,0.06)",
            border: "1px dashed rgba(119,117,255,0.28)",
            color: templates.length >= 5 ? "#536477" : "#7775FF",
          }}>
          <Plus className="w-4 h-4 mx-auto" />
          {templates.length >= 5 ? "Maximum 5 templates reached" : "Add Template"}
        </button>
      </Section>

      {/* ── Section 3: Transfer Team ─────────────────────────────────────── */}
      <Section icon={ArrowRightLeft} title="Transfer Team"
        iconColor="#7775FF" iconBg="rgba(119,117,255,0.08)" iconBorder="rgba(119,117,255,0.18)">

        <p className="text-[13px] mb-4" style={{ color: "#8493A7" }}>
          Move all or selected employees to another admin. Use this before leaving the organisation
          or when restructuring teams.
        </p>

        <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(100,170,190,0.12)" }}>
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4" style={{ color: "#8493A7" }} />
            <span className="text-[13px]" style={{ color: "#EAF2F8" }}>
              Current team size
            </span>
          </div>
          <span className="text-[20px] font-bold nums" style={{ color: "#00D9E8" }}>
            {employees.length}
          </span>
        </div>

        <button
          onClick={() => setShowTransfer(true)}
          disabled={employees.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all"
          style={{
            background: employees.length === 0 ? "rgba(255,255,255,0.03)" : "rgba(119,117,255,0.12)",
            border: `1px solid ${employees.length === 0 ? "rgba(100,170,190,0.14)" : "rgba(119,117,255,0.28)"}`,
            color: employees.length === 0 ? "#536477" : "#7775FF",
          }}>
          <ArrowRightLeft className="w-4 h-4" />
          Transfer Employees…
        </button>
      </Section>

      {/* ── Audit Log ────────────────────────────────────────────────────── */}
      <AuditPanel />

      {/* Transfer modal */}
      <AnimatePresence>
        {showTransfer && (
          <TransferModal
            employees={employees}
            onClose={() => setShowTransfer(false)}
            onTransferred={() => { setShowTransfer(false); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}