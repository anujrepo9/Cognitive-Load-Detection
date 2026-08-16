import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, User, Save, Loader2, AlertCircle, CheckCircle2, KeyRound, Eye, EyeOff } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authAPI, getErrorMessage } from "../services/api"

export default function Profile() {
  const { user, login } = useAuth()

  const [name,  setName]  = useState(user?.name  || "")
  const [email, setEmail] = useState(user?.email || "")
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)

  const [oldPwd,   setOldPwd]   = useState("")
  const [newPwd,   setNewPwd]   = useState("")
  const [showOld,  setShowOld]  = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [pwdMsg,   setPwdMsg]   = useState(null)
  const [pwdErr,   setPwdErr]   = useState(null)
  const [pwdBusy,  setPwdBusy]  = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError("Name cannot be empty."); return }
    setSaving(true); setError(null)
    try {
      const { data } = await authAPI.updateProfile({ name: name.trim(), email: email.trim() })
      // Update AuthContext so Sidebar/TopNav reflect the new name immediately
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

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account information</p>
      </motion.div>

      {/* Profile card */}
      <div className="card p-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent
            flex items-center justify-center text-white text-2xl font-bold shadow-glow-primary">
            {(name[0] || "U").toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{name || "User"}</h2>
            <p className="text-sm text-gray-400">{email}</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20
            border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600
            dark:text-red-400 mb-5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saved && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20
            border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-600
            dark:text-green-400 mb-5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Profile updated successfully.
          </div>
        )}

        <form onSubmit={handleSave} noValidate className="space-y-4">
          <div>
            <label htmlFor="profile-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Full name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="profile-name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                className="input pl-9" placeholder="Your name" aria-required="true" />
            </div>
          </div>

          <div>
            <label htmlFor="profile-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="profile-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-9" placeholder="you@example.com" aria-required="true" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="btn-primary" aria-disabled={saving}>
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save changes</>}
            </button>
          </div>
        </form>
      </div>

      {/* Change password card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-warning" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Change password</h3>
        </div>

        {pwdErr && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20
            border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600
            dark:text-red-400 mb-5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{pwdErr}</span>
          </div>
        )}
        {pwdMsg && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20
            border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-600
            dark:text-green-400 mb-5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {pwdMsg}
          </div>
        )}

        <form onSubmit={handleChangePassword} noValidate className="space-y-4">
          <div>
            <label htmlFor="old-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Current password
            </label>
            <div className="relative">
              <input id="old-password" type={showOld ? "text" : "password"}
                value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
                className="input pr-10" placeholder="••••••••" autoComplete="current-password"
                aria-required="true" />
              <button type="button" onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showOld ? "Hide password" : "Show password"}>
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="new-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              New password
              <span className="ml-1 text-xs text-gray-400 font-normal">(min. 6 characters)</span>
            </label>
            <div className="relative">
              <input id="new-password" type={showNew ? "text" : "password"}
                value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                className="input pr-10" placeholder="••••••••" autoComplete="new-password"
                aria-required="true" />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showNew ? "Hide password" : "Show password"}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={pwdBusy}
              className="btn-primary" aria-disabled={pwdBusy}>
              {pwdBusy
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
