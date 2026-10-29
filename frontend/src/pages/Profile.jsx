import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mail, User, Save, Loader2, AlertCircle, CheckCircle2,
  KeyRound, Eye, EyeOff, Bell, AlertTriangle, ShieldCheck,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authAPI, adminAPI, getErrorMessage } from "../services/api"

export default function Profile() {
  const { user, login, isAdmin } = useAuth()

  // ── Profile fields ──────────────────────────────────────────────────────────
  const [name,  setName]  = useState(user?.name  || "")
  const [email, setEmail] = useState(user?.email || "")
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)

  // ── Password change ─────────────────────────────────────────────────────────
  const [oldPwd,  setOldPwd]  = useState("")
  const [newPwd,  setNewPwd]  = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwdMsg,  setPwdMsg]  = useState(null)
  const [pwdErr,  setPwdErr]  = useState(null)
  const [pwdBusy, setPwdBusy] = useState(false)

  // ── My Alerts (employees only) ──────────────────────────────────────────────
  const [alerts,       setAlerts]       = useState([])
  const [alertsLoading,setAlertsLoading]= useState(false)

  useEffect(() => {
    if (isAdmin) return
    setAlertsLoading(true)
    adminAPI.myAlerts()
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setAlertsLoading(false))
  }, [isAdmin])

  const markRead = async (alertId) => {
    try {
      await adminAPI.markAlertRead(alertId)
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a))
    } catch (_) {}
  }

  const markAllRead = async () => {
    const unread = alerts.filter(a => !a.is_read)
    await Promise.allSettled(unread.map(a => adminAPI.markAlertRead(a.id)))
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError("Name cannot be empty."); return }
    setSaving(true); setError(null)
    try {
      const data = await authAPI.updateProfile({ name: name.trim(), email: email.trim() })
      const token        = localStorage.getItem("token")
      const refreshToken = localStorage.getItem("refreshToken")
      login(data, token, refreshToken)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save changes."))
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!oldPwd || !newPwd) { setPwdErr("Both fields are required."); return }
    if (newPwd.length < 6)  { setPwdErr("New password must be at least 6 characters."); return }
    setPwdBusy(true); setPwdErr(null); setPwdMsg(null)
    try {
      await authAPI.changePassword({ current_password: oldPwd, new_password: newPwd })
      setPwdMsg("Password changed successfully.")
      setOldPwd(""); setNewPwd("")
    } catch (err) {
      setPwdErr(getErrorMessage(err, "Failed to change password."))
    } finally {
      setPwdBusy(false)
    }
  }

  const unreadCount = alerts.filter(a => !a.is_read).length

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[#EAF2F8]">Profile</h1>
        <p className="text-sm text-[#8493A7] mt-0.5">Manage your account information</p>
      </motion.div>

      {/* ── Profile card ── */}
      <div className="card p-6">
        {/* Avatar + role badge */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent
            flex items-center justify-center text-white text-2xl font-bold shadow-glow-primary">
            {(name[0] || "U").toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#EAF2F8]">{name || "User"}</h2>
            <p className="text-sm text-[#536477]">{email}</p>
            {isAdmin && (
              <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(119,117,255,0.12)", border: "1px solid rgba(119,117,255,0.25)", color: "#7775FF" }}>
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(119,117,255,0.12)", border: "1px solid rgba(119,117,255,0.25)", color: "#7775FF" }}>
                <ShieldCheck className="w-3 h-3" /> Employee
              </span>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/30
            border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700
            dark:text-red-300 mb-5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saved && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30
            border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-sm text-emerald-700
            dark:text-emerald-300 mb-5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Profile updated successfully.
          </div>
        )}

        <form onSubmit={handleSave} noValidate className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-[#EAF2F8] mb-1.5">
              Full name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#536477]" />
              <input id="profile-name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                className="input pl-9" placeholder="Your name" aria-required="true" />
            </div>
          </div>

          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-[#EAF2F8] mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#536477]" />
              <input id="profile-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-9" placeholder="you@example.com" aria-required="true" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary" aria-disabled={saving}>
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save changes</>}
            </button>
          </div>
        </form>
      </div>

      {/* ── Change password card ── */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-warning" />
          </div>
          <h3 className="font-semibold text-[#EAF2F8]">Change password</h3>
        </div>

        {pwdErr && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/30
            border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700
            dark:text-red-300 mb-5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{pwdErr}</span>
          </div>
        )}
        {pwdMsg && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30
            border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-sm text-emerald-700
            dark:text-emerald-300 mb-5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {pwdMsg}
          </div>
        )}

        <form onSubmit={handleChangePassword} noValidate className="space-y-4">
          <div>
            <label htmlFor="old-password" className="block text-sm font-medium text-[#EAF2F8] mb-1.5">
              Current password
            </label>
            <div className="relative">
              <input id="old-password" type={showOld ? "text" : "password"}
                value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
                className="input pr-10" placeholder="••••••••" autoComplete="current-password"
                aria-required="true" />
              <button type="button" onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#536477] hover:text-gray-600"
                aria-label={showOld ? "Hide password" : "Show password"}>
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-[#EAF2F8] mb-1.5">
              New password
              <span className="ml-1 text-xs text-[#536477] font-normal">(min. 6 characters)</span>
            </label>
            <div className="relative">
              <input id="new-password" type={showNew ? "text" : "password"}
                value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                className="input pr-10" placeholder="••••••••" autoComplete="new-password"
                aria-required="true" />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#536477] hover:text-gray-600"
                aria-label={showNew ? "Hide password" : "Show password"}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={pwdBusy} className="btn-primary" aria-disabled={pwdBusy}>
              {pwdBusy
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                : "Update password"}
            </button>
          </div>
        </form>
      </div>

      {/* ── My Alerts — employees only ── */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(0,217,232,0.08)", border: "1px solid rgba(0,217,232,0.18)" }}>
                <Bell className="w-5 h-5" style={{ color: "#00D9E8" }} />
              </div>
              <div>
                <h3 className="font-semibold text-[#EAF2F8]">Alerts from Manager</h3>
                {unreadCount > 0 && (
                  <p className="text-[12px] mt-0.5" style={{ color: "#FFB547" }}>
                    {unreadCount} unread
                  </p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: "rgba(0,217,232,0.07)",
                  border: "1px solid rgba(0,217,232,0.18)",
                  color: "#00D9E8",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {alertsLoading ? (
            <div className="py-10 text-center text-[13px]" style={{ color: "#536477" }}>
              Loading alerts…
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="w-8 h-8 mx-auto mb-3" style={{ color: "#536477" }} />
              <p className="text-[14px] font-medium" style={{ color: "#EAF2F8" }}>No alerts yet</p>
              <p className="text-[13px] mt-1" style={{ color: "#536477" }}>
                Your manager hasn't sent any alerts.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-3">
                {alerts.map(alert => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 rounded-xl p-4"
                    style={{
                      background: alert.is_read
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(0,217,232,0.04)",
                      border: `1px solid ${alert.is_read
                        ? "rgba(100,170,190,0.12)"
                        : "rgba(0,217,232,0.20)"}`,
                    }}
                  >
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: alert.alert_type === "high_load"
                          ? "rgba(255,83,100,0.10)"
                          : alert.alert_type === "low_load"
                            ? "rgba(255,181,71,0.10)"
                            : "rgba(0,217,232,0.08)",
                        border: `1px solid ${alert.alert_type === "high_load"
                          ? "rgba(255,83,100,0.22)"
                          : alert.alert_type === "low_load"
                            ? "rgba(255,181,71,0.22)"
                            : "rgba(0,217,232,0.15)"}`,
                      }}>
                      {alert.alert_type === "high_load"
                        ? <AlertTriangle className="w-4 h-4" style={{ color: "#FF5364" }} />
                        : <Bell className="w-4 h-4" style={{
                            color: alert.alert_type === "low_load" ? "#FFB547" : "#00D9E8",
                          }} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>
                          {alert.title}
                        </p>
                        {!alert.is_read && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(0,217,232,0.12)", color: "#00D9E8" }}>
                            NEW
                          </span>
                        )}
                        {alert.is_read && (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#37D9A0" }} />
                        )}
                      </div>
                      <p className="text-[12px]" style={{ color: "#8493A7" }}>{alert.message}</p>
                      <p className="text-[11px] mt-1.5" style={{ color: "#536477" }}>
                        {new Date(alert.created_at).toLocaleString()}
                        {alert.read_at && ` · Read ${new Date(alert.read_at).toLocaleString()}`}
                      </p>
                    </div>

                    {/* Mark read button */}
                    {!alert.is_read && (
                      <button
                        onClick={() => markRead(alert.id)}
                        className="shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{
                          background: "rgba(55,217,160,0.08)",
                          border: "1px solid rgba(55,217,160,0.20)",
                          color: "#37D9A0",
                        }}
                      >
                        Mark read
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </motion.div>
      )}
    </div>
  )
}