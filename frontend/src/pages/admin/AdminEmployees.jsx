import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, UserPlus, Pencil, Trash2, ChevronRight,
  Mail, ShieldOff, ShieldCheck, X, Eye, EyeOff,
} from "lucide-react"
import { adminAPI, getErrorMessage } from "../../services/api"
import { useToast } from "../../components/ui/Toast"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkeletonPage } from "../../components/ui/Skeleton"

// ── Modal: create or edit an employee ────────────────────────────────────────

function EmployeeModal({ employee, onClose, onSaved }) {
  const { toast } = useToast()
  const isEdit = !!employee
  const [form, setForm] = useState({
    name:      employee?.name      || "",
    email:     employee?.email     || "",
    password:  "",
    is_active: employee?.is_active ?? true,
  })
  const [showPass, setShowPass] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [errors,   setErrors]   = useState({})

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
      const body = { name: form.name, email: form.email, is_active: form.is_active }
      if (form.password) body.password = form.password
      if (isEdit) {
        await adminAPI.updateEmployee(employee.id, body)
        toast("success", "Employee updated")
      } else {
        body.password = form.password
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

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

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
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold" style={{ color: "#EAF2F8" }}>
            {isEdit ? "Edit Employee" : "Add Employee"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#536477" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EAF2F8"}
            onMouseLeave={e => e.currentTarget.style.color = "#536477"}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {[
            { key: "name",  label: "Full Name",  type: "text",     placeholder: "Jane Smith" },
            { key: "email", label: "Email",       type: "email",    placeholder: "jane@company.com" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={{ color: "#8493A7" }}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${errors[key] ? "#FF5364" : "rgba(100,170,190,0.18)"}`,
                  color: "#EAF2F8",
                }}
                onFocus={e => e.target.style.borderColor = "#00D9E8"}
                onBlur={e => e.target.style.borderColor = errors[key] ? "#FF5364" : "rgba(100,170,190,0.18)"}
              />
              {errors[key] && <p className="text-[11px] mt-1" style={{ color: "#FF5364" }}>{errors[key]}</p>}
            </div>
          ))}

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={{ color: "#8493A7" }}>
              {isEdit ? "New Password (leave blank to keep)" : "Password"}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder={isEdit ? "••••••" : "Min 6 characters"}
                className="w-full px-3 py-2.5 pr-10 rounded-lg text-[13px] outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${errors.password ? "#FF5364" : "rgba(100,170,190,0.18)"}`,
                  color: "#EAF2F8",
                }}
                onFocus={e => e.target.style.borderColor = "#00D9E8"}
                onBlur={e => e.target.style.borderColor = errors.password ? "#FF5364" : "rgba(100,170,190,0.18)"}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#536477" }}>
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] mt-1" style={{ color: "#FF5364" }}>{errors.password}</p>}
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div className="flex items-center justify-between py-2">
              <span className="text-[13px]" style={{ color: "#8493A7" }}>Account Active</span>
              <button
                type="button"
                onClick={() => set("is_active", !form.is_active)}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{ background: form.is_active ? "#00D9E8" : "rgba(100,170,190,0.18)" }}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.is_active ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#8493A7" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all"
            style={{ background: "#00D9E8", color: "#05080D", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : isEdit ? "Update" : "Create Account"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────

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
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminEmployees() {
  const { toast } = useToast()
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)   // null | "create" | { employee }
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminAPI.listEmployees()
      setEmployees(data)
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <SkeletonPage />

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          icon={Users}
          title="Employees"
          subtitle={`${employees.length} team member${employees.length !== 1 ? "s" : ""}`}
        />
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all"
          style={{ background: "#00D9E8", color: "#05080D" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <UserPlus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="w-10 h-10 mb-4" style={{ color: "#536477" }} />
          <p className="text-[15px] font-semibold mb-1" style={{ color: "#EAF2F8" }}>No team members yet</p>
          <p className="text-[13px]" style={{ color: "#536477" }}>Add your first employee to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(100,170,190,0.14)" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
                {["Name", "Email", "Status", "Created", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.10em]"
                    style={{ color: "#536477" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <motion.tr key={emp.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-t group"
                  style={{ borderColor: "rgba(100,170,190,0.08)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.015)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full sidebar-brand-gradient flex items-center justify-center text-[#05080D] text-[11px] font-bold shrink-0">
                        {emp.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: "#EAF2F8" }}>{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "#8493A7" }}>
                      <Mail className="w-3 h-3 shrink-0" />
                      {emp.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {emp.is_active ? (
                      <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#37D9A0" }}>
                        <ShieldCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#536477" }}>
                        <ShieldOff className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#536477" }}>
                    {emp.created_at ? new Date(emp.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/admin/employees/${emp.id}`}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: "#00D9E8", background: "rgba(0,217,232,0.08)" }}
                        title="View details">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => setModal({ employee: emp })}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: "#7775FF", background: "rgba(119,117,255,0.08)" }}
                        title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: "#FF5364", background: "rgba(255,83,100,0.08)" }}
                        title="Deactivate">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal === "create" && (
          <EmployeeModal
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); load() }}
          />
        )}
        {modal?.employee && (
          <EmployeeModal
            employee={modal.employee}
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
      </AnimatePresence>
    </div>
  )
}