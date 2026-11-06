import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, UserPlus, Pencil, Trash2, ChevronRight,
  Mail, ShieldOff, ShieldCheck, X, Eye, EyeOff,
  Bell, Download, Filter, CheckSquare, Square,
  Building2, Send, Loader2, Search,
} from "lucide-react"
import { adminAPI, getErrorMessage } from "../../services/api"
import { useToast } from "../../components/ui/Toast"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkeletonPage } from "../../components/ui/Skeleton"

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition-all"
const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(100,170,190,0.18)",
  color: "#EAF2F8",
}
const focusBorder  = "#00D9E8"
const normalBorder = "rgba(100,170,190,0.18)"
const errorBorder  = "#FF5364"

// ── Create / Edit employee modal ──────────────────────────────────────────────

function EmployeeModal({ employee, departments, onClose, onSaved }) {
  const { toast } = useToast()
  const isEdit = !!employee

  const [form, setForm] = useState({
    name:       employee?.name       || "",
    email:      employee?.email      || "",
    password:   "",
    is_active:  employee?.is_active  ?? true,
    department: employee?.department || "",
  })
  const [newDept,  setNewDept]  = useState("")
  const [showPass, setShowPass] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [errors,   setErrors]   = useState({})

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name = "Name is required"
    if (!form.email.trim()) e.email = "Email is required"
    if (!isEdit && form.password.length < 6) e.password = "Min 6 characters"
    if (isEdit && form.password && form.password.length < 6) e.password = "Min 6 characters"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      // Resolve department: pick existing or use typed-in new one
      const dept = newDept.trim() || form.department || ""
      const body = {
        name:       form.name.trim(),
        email:      form.email.trim(),
        is_active:  form.is_active,
        department: dept || null,
      }
      if (form.password) body.password = form.password
      if (!isEdit) body.password = form.password

      if (isEdit) {
        await adminAPI.updateEmployee(employee.id, body)
        toast("success", "Employee updated")
      } else {
        await adminAPI.createEmployee(body)
        toast("success", "Employee account created")
      }
      onSaved()
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,13,0.85)", backdropFilter: "blur(8px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.18)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold" style={{ color: "#EAF2F8" }}>
            {isEdit ? "Edit Employee" : "Add Employee"}
          </h2>
          <button onClick={onClose} style={{ color: "#536477" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"}
            onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          {[
            { key: "name",  label: "Full Name",  type: "text",  placeholder: "Jane Smith"         },
            { key: "email", label: "Email",       type: "email", placeholder: "jane@company.com"   },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={{ color: "#8493A7" }}>{label}</label>
              <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
                placeholder={placeholder} className={inputCls}
                style={{ ...inputStyle, border: `1px solid ${errors[key] ? errorBorder : normalBorder}` }}
                onFocus={e => e.target.style.borderColor = focusBorder}
                onBlur={e => e.target.style.borderColor = errors[key] ? errorBorder : normalBorder} />
              {errors[key] && <p className="text-[11px] mt-1" style={{ color: errorBorder }}>{errors[key]}</p>}
            </div>
          ))}

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={{ color: "#8493A7" }}>
              {isEdit ? "New Password (leave blank to keep)" : "Password"}
            </label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder={isEdit ? "••••••" : "Min 6 characters"}
                className={inputCls + " pr-10"}
                style={{ ...inputStyle, border: `1px solid ${errors.password ? errorBorder : normalBorder}` }}
                onFocus={e => e.target.style.borderColor = focusBorder}
                onBlur={e => e.target.style.borderColor = errors.password ? errorBorder : normalBorder} />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#536477" }}>
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] mt-1" style={{ color: errorBorder }}>{errors.password}</p>}
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={{ color: "#8493A7" }}>Department</label>
            {departments.length > 0 ? (
              <select value={form.department} onChange={e => { set("department", e.target.value); setNewDept("") }}
                className={inputCls} style={{ ...inputStyle, appearance: "none" }}>
                <option value="" style={{ background: "#0B1420" }}>— None —</option>
                {departments.map(d => (
                  <option key={d} value={d} style={{ background: "#0B1420" }}>{d}</option>
                ))}
                <option value="__new__" style={{ background: "#0B1420" }}>+ Create new…</option>
              </select>
            ) : null}
            {(form.department === "__new__" || departments.length === 0) && (
              <input type="text" value={newDept} onChange={e => setNewDept(e.target.value)}
                placeholder="New department name e.g. Engineering"
                className={inputCls + (departments.length > 0 ? " mt-2" : "")}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = focusBorder}
                onBlur={e => e.target.style.borderColor = normalBorder} />
            )}
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div className="flex items-center justify-between py-2">
              <span className="text-[13px]" style={{ color: "#8493A7" }}>Account Active</span>
              <button type="button" onClick={() => set("is_active", !form.is_active)}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{ background: form.is_active ? "#00D9E8" : "rgba(100,170,190,0.18)" }}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.is_active ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#8493A7" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-bold"
            style={{ background: "#00D9E8", color: "#05080D", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : isEdit ? "Update" : "Create Account"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Confirm deactivate modal ──────────────────────────────────────────────────

function ConfirmDeleteModal({ employee, onClose, onDeleted }) {
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)

  const doDelete = async () => {
    setDeleting(true)
    try {
      await adminAPI.deleteEmployee(employee.id, false)
      toast("success", `${employee.name}'s account deactivated`)
      onDeleted()
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,13,0.85)", backdropFilter: "blur(8px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "#0B1420", border: "1px solid rgba(255,83,100,0.30)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,83,100,0.12)", border: "1px solid rgba(255,83,100,0.25)" }}>
            <Trash2 className="w-4 h-4" style={{ color: "#FF5364" }} />
          </div>
          <h2 className="text-[15px] font-bold" style={{ color: "#EAF2F8" }}>Deactivate Account?</h2>
        </div>
        <p className="text-[13px] mb-6" style={{ color: "#8493A7" }}>
          <span className="font-semibold" style={{ color: "#EAF2F8" }}>{employee.name}</span>
          {" "}will no longer be able to log in. Their data is preserved. You can reactivate later.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#8493A7" }}>
            Cancel
          </button>
          <button onClick={doDelete} disabled={deleting}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-bold"
            style={{ background: "rgba(255,83,100,0.15)", border: "1px solid rgba(255,83,100,0.30)", color: "#FF5364", opacity: deleting ? 0.7 : 1 }}>
            {deleting ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Bulk alert modal ──────────────────────────────────────────────────────────

function BulkAlertModal({ selectedIds, allEmployees, onClose, onSent }) {
  const { toast }   = useToast()
  const [form, setForm] = useState({ alert_type: "custom", title: "", message: "" })
  const [sending, setSending] = useState(false)

  const targets = selectedIds.length === 0
    ? allEmployees.filter(e => e.is_active)
    : allEmployees.filter(e => selectedIds.includes(e.id))

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const TEMPLATES = [
    { type: "high_load", label: "🔴 High Load", title: "Please Take a Break",
      message: "Your cognitive load readings indicate high stress. Please take a 10-minute break." },
    { type: "low_load",  label: "🟡 Check In",  title: "Team Check-In",
      message: "Activity looks quiet across the team. Let me know if you need support or reassignment." },
    { type: "custom",    label: "✏️ Custom",    title: "", message: "" },
  ]

  const submit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast("error", "Title and message required"); return
    }
    setSending(true)
    try {
      const res = await adminAPI.bulkAlert({
        employee_ids: selectedIds,   // empty = all active
        alert_type:  form.alert_type,
        title:       form.title,
        message:     form.message,
      })
      toast("success", `Alert sent to ${res.sent_count} employee${res.sent_count !== 1 ? "s" : ""}`)
      onSent()
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,13,0.88)", backdropFilter: "blur(8px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: "#0B1420", border: "1px solid rgba(0,217,232,0.22)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,217,232,0.08)", border: "1px solid rgba(0,217,232,0.18)" }}>
              <Bell className="w-4 h-4" style={{ color: "#00D9E8" }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: "#EAF2F8" }}>Bulk Alert</h2>
              <p className="text-[11px]" style={{ color: "#536477" }}>
                Sending to{" "}
                <span style={{ color: "#00D9E8" }}>
                  {targets.length} employee{targets.length !== 1 ? "s" : ""}
                </span>
                {selectedIds.length === 0 ? " (all active)" : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "#536477" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"}
            onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target preview chips */}
        <div className="flex flex-wrap gap-1.5 mb-4 max-h-24 overflow-y-auto">
          {targets.map(e => (
            <span key={e.id}
              className="text-[11px] px-2 py-0.5 rounded-lg font-medium"
              style={{ background: "rgba(119,117,255,0.10)", color: "#7775FF", border: "1px solid rgba(119,117,255,0.20)" }}>
              {e.name}
            </span>
          ))}
        </div>

        {/* Templates */}
        <div className="flex gap-2 mb-4">
          {TEMPLATES.map(t => (
            <button key={t.type}
              onClick={() => setForm({ alert_type: t.type, title: t.title, message: t.message })}
              className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all"
              style={form.alert_type === t.type
                ? { background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.22)", color: "#00D9E8" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.14)", color: "#8493A7" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={{ color: "#8493A7" }}>Title</label>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Alert title" className={inputCls} style={inputStyle}
              onFocus={e => e.target.style.borderColor = focusBorder}
              onBlur={e => e.target.style.borderColor = normalBorder} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={{ color: "#8493A7" }}>Message</label>
            <textarea value={form.message} onChange={e => set("message", e.target.value)}
              placeholder="Your message…" rows={4}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = focusBorder}
              onBlur={e => e.target.style.borderColor = normalBorder} />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#8493A7" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={sending || targets.length === 0}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-2"
            style={{ background: "#00D9E8", color: "#05080D", opacity: (sending || targets.length === 0) ? 0.7 : 1 }}>
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                     : <><Send className="w-4 h-4" /> Send to {targets.length}</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Export modal ──────────────────────────────────────────────────────────────

function ExportModal({ departments, onClose }) {
  const { toast } = useToast()
  const [dateFrom,   setDateFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo,     setDateTo]     = useState(() => new Date().toISOString().slice(0, 10))
  const [dept,       setDept]       = useState("")
  const [exporting,  setExporting]  = useState(false)

  const doExport = async () => {
    setExporting(true)
    try {
      await adminAPI.teamExport({ date_from: dateFrom, date_to: dateTo, department: dept || undefined })
      toast("success", "CSV downloaded")
      onClose()
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,13,0.88)", backdropFilter: "blur(8px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.18)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(55,217,160,0.08)", border: "1px solid rgba(55,217,160,0.18)" }}>
            <Download className="w-4 h-4" style={{ color: "#37D9A0" }} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold" style={{ color: "#EAF2F8" }}>Export Team Data</h2>
            <p className="text-[11px]" style={{ color: "#536477" }}>CSV with avg load, sessions, top app</p>
          </div>
          <button onClick={onClose} className="ml-auto" style={{ color: "#536477" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"}
            onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={{ color: "#8493A7" }}>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className={inputCls} style={{ ...inputStyle, colorScheme: "dark" }}
                onFocus={e => e.target.style.borderColor = focusBorder}
                onBlur={e => e.target.style.borderColor = normalBorder} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={{ color: "#8493A7" }}>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className={inputCls} style={{ ...inputStyle, colorScheme: "dark" }}
                onFocus={e => e.target.style.borderColor = focusBorder}
                onBlur={e => e.target.style.borderColor = normalBorder} />
            </div>
          </div>
          {departments.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={{ color: "#8493A7" }}>Department (optional)</label>
              <select value={dept} onChange={e => setDept(e.target.value)}
                className={inputCls} style={{ ...inputStyle, appearance: "none" }}>
                <option value="" style={{ background: "#0B1420" }}>All departments</option>
                {departments.map(d => (
                  <option key={d} value={d} style={{ background: "#0B1420" }}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#8493A7" }}>
            Cancel
          </button>
          <button onClick={doExport} disabled={exporting}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-2"
            style={{ background: "rgba(55,217,160,0.12)", border: "1px solid rgba(55,217,160,0.28)", color: "#37D9A0", opacity: exporting ? 0.7 : 1 }}>
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
                       : <><Download className="w-4 h-4" /> Download CSV</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminEmployees() {
  const { toast } = useToast()
  const [employees,    setEmployees]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(null)   // null | "create" | { employee }
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showBulk,     setShowBulk]     = useState(false)
  const [showExport,   setShowExport]   = useState(false)

  // Filter state
  const [search,     setSearch]     = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")   // "all" | "active" | "inactive"

  // Selection state
  const [selected, setSelected] = useState(new Set())

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminAPI.listEmployees()
      setEmployees(data)
      setSelected(new Set())
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Derive department list from loaded employees
  const departments = useMemo(() => {
    const depts = [...new Set(employees.map(e => e.department).filter(Boolean))].sort()
    return depts
  }, [employees])

  // Filtered list
  const filtered = useMemo(() => {
    let list = employees
    if (deptFilter !== "all")  list = list.filter(e => (e.department || "None") === deptFilter)
    if (statusFilter === "active")   list = list.filter(e => e.is_active)
    if (statusFilter === "inactive") list = list.filter(e => !e.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
    }
    return list
  }, [employees, deptFilter, statusFilter, search])

  // Group filtered list by department for display
  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(e => {
      const dept = e.department || "No Department"
      if (!groups[dept]) groups[dept] = []
      groups[dept].push(e)
    })
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "No Department") return 1
      if (b === "No Department") return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  // Selection helpers
  const toggleOne = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(e => e.id)))
  }
  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0 && !allSelected

  // Department filter options
  const deptOptions = ["all", ...departments, "None"]

  if (loading) return <SkeletonPage />

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={Users}
          title="Employees"
          subtitle={`${employees.length} team member${employees.length !== 1 ? "s" : ""}${departments.length > 0 ? ` · ${departments.length} dept${departments.length !== 1 ? "s" : ""}` : ""}`}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
            style={{ background: "rgba(55,217,160,0.08)", border: "1px solid rgba(55,217,160,0.20)", color: "#37D9A0" }}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => setModal("create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold"
            style={{ background: "#00D9E8", color: "#05080D" }}>
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#536477" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[12px] outline-none"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = focusBorder}
            onBlur={e => e.target.style.borderColor = normalBorder} />
        </div>

        {/* Department filter */}
        {departments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Building2 className="w-3.5 h-3.5" style={{ color: "#536477" }} />
            {deptOptions.map(d => (
              <button key={d} onClick={() => setDeptFilter(d)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all capitalize"
                style={deptFilter === d
                  ? { background: "rgba(119,117,255,0.12)", border: "1px solid rgba(119,117,255,0.25)", color: "#7775FF" }
                  : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.12)", color: "#536477" }}>
                {d === "all" ? "All" : d}
              </button>
            ))}
          </div>
        )}

        {/* Status filter */}
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.10)" }}>
          {["all", "active", "inactive"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-medium capitalize transition-all"
              style={statusFilter === s
                ? { background: "rgba(0,217,232,0.10)", color: "#00D9E8" }
                : { color: "#536477" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Selection toolbar ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(0,217,232,0.06)", border: "1px solid rgba(0,217,232,0.18)" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#00D9E8" }}>
              {selected.size} selected
            </span>
            <button onClick={() => setShowBulk(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.22)", color: "#00D9E8" }}>
              <Bell className="w-3.5 h-3.5" /> Send Bulk Alert
            </button>
            <button onClick={() => setSelected(new Set())}
              className="ml-auto text-[12px]" style={{ color: "#536477" }}>
              Clear selection
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="w-10 h-10 mb-4" style={{ color: "#536477" }} />
          <p className="text-[15px] font-semibold mb-1" style={{ color: "#EAF2F8" }}>No team members yet</p>
          <p className="text-[13px]" style={{ color: "#536477" }}>Add your first employee to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ border: "1px dashed rgba(100,170,190,0.14)" }}>
          <Filter className="w-7 h-7 mb-3" style={{ color: "#536477" }} />
          <p className="text-[13px]" style={{ color: "#536477" }}>No employees match the current filters.</p>
          <button onClick={() => { setSearch(""); setDeptFilter("all"); setStatusFilter("all") }}
            className="mt-3 text-[12px] px-3 py-1.5 rounded-lg"
            style={{ color: "#00D9E8", border: "1px solid rgba(0,217,232,0.20)", background: "rgba(0,217,232,0.06)" }}>
            Clear filters
          </button>
        </div>
      ) : (
        /* ── Table ──────────────────────────────────────────────────── */
        <div className="space-y-6">
          {grouped.map(([dept, emps]) => (
            <div key={dept}>
              {/* Department header */}
              {grouped.length > 1 && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Building2 className="w-3.5 h-3.5" style={{ color: "#7775FF" }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.10em]" style={{ color: "#7775FF" }}>
                    {dept}
                  </span>
                  <span className="text-[11px]" style={{ color: "#536477" }}>({emps.length})</span>
                  <div className="flex-1 h-px ml-2" style={{ background: "rgba(119,117,255,0.14)" }} />
                </div>
              )}

              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(100,170,190,0.14)" }}>
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
                      {/* Select-all checkbox */}
                      <th className="pl-4 pr-2 py-3 w-8">
                        <button onClick={toggleAll} style={{ color: allSelected ? "#00D9E8" : "#536477" }}>
                          {allSelected
                            ? <CheckSquare className="w-4 h-4" />
                            : someSelected
                              ? <CheckSquare className="w-4 h-4 opacity-50" />
                              : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      {["Name", "Email", "Department", "Status", "Created", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.10em]"
                          style={{ color: "#536477" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emps.map((emp, i) => {
                      const isChecked = selected.has(emp.id)
                      return (
                        <motion.tr key={emp.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.025 }}
                          className="border-t group"
                          style={{
                            borderColor: "rgba(100,170,190,0.08)",
                            background: isChecked ? "rgba(0,217,232,0.04)" : "transparent",
                          }}
                          onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = "rgba(255,255,255,0.015)" }}
                          onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = "transparent" }}>

                          {/* Checkbox */}
                          <td className="pl-4 pr-2 py-3 w-8">
                            <button onClick={() => toggleOne(emp.id)}
                              style={{ color: isChecked ? "#00D9E8" : "#536477" }}>
                              {isChecked
                                ? <CheckSquare className="w-4 h-4" />
                                : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </button>
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full sidebar-brand-gradient flex items-center justify-center text-[#05080D] text-[11px] font-bold shrink-0">
                                {emp.name?.[0]?.toUpperCase() || "?"}
                              </div>
                              <span className="text-[13px] font-medium" style={{ color: "#EAF2F8" }}>{emp.name}</span>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "#8493A7" }}>
                              <Mail className="w-3 h-3 shrink-0" />{emp.email}
                            </span>
                          </td>

                          {/* Department */}
                          <td className="px-4 py-3">
                            {emp.department ? (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg"
                                style={{ background: "rgba(119,117,255,0.09)", color: "#7775FF", border: "1px solid rgba(119,117,255,0.18)" }}>
                                {emp.department}
                              </span>
                            ) : (
                              <span className="text-[12px]" style={{ color: "#2D3A4A" }}>—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {emp.is_active
                              ? <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#37D9A0" }}>
                                  <ShieldCheck className="w-3.5 h-3.5" /> Active
                                </span>
                              : <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#536477" }}>
                                  <ShieldOff className="w-3.5 h-3.5" /> Inactive
                                </span>}
                          </td>

                          {/* Created */}
                          <td className="px-4 py-3 text-[12px]" style={{ color: "#536477" }}>
                            {emp.created_at ? new Date(emp.created_at).toLocaleDateString() : "—"}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link to={`/admin/employees/${emp.id}`}
                                className="p-1.5 rounded-lg" title="View details"
                                style={{ color: "#00D9E8", background: "rgba(0,217,232,0.08)" }}>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                              <button onClick={() => setModal({ employee: emp })}
                                className="p-1.5 rounded-lg" title="Edit"
                                style={{ color: "#7775FF", background: "rgba(119,117,255,0.08)" }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteTarget(emp)}
                                className="p-1.5 rounded-lg" title="Deactivate"
                                style={{ color: "#FF5364", background: "rgba(255,83,100,0.08)" }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bulk alert CTA when nothing selected but employees exist ─── */}
      {employees.length > 0 && selected.size === 0 && (
        <div className="flex justify-center pt-2">
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.12)", color: "#536477" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,217,232,0.22)"; e.currentTarget.style.color = "#00D9E8" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,170,190,0.12)"; e.currentTarget.style.color = "#536477" }}>
            <Bell className="w-3.5 h-3.5" /> Send Alert to All Active Employees
          </button>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === "create" && (
          <EmployeeModal
            departments={departments}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); load() }}
          />
        )}
        {modal?.employee && (
          <EmployeeModal
            employee={modal.employee}
            departments={departments}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); load() }}
          />
        )}
        {deleteTarget && (
          <ConfirmDeleteModal
            employee={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => { setDeleteTarget(null); load() }}
          />
        )}
        {showBulk && (
          <BulkAlertModal
            selectedIds={[...selected]}
            allEmployees={employees}
            onClose={() => setShowBulk(false)}
            onSent={() => { setShowBulk(false); setSelected(new Set()) }}
          />
        )}
        {showExport && (
          <ExportModal
            departments={departments}
            onClose={() => setShowExport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}