import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, User, Shield, Save, Camera, Loader2, AlertCircle, KeyRound } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authAPI } from "../services/api"

export default function Profile() {
  const { user, login } = useAuth()

  const [name,  setName]  = useState(user?.name  || "")
  const [email, setEmail] = useState(user?.email || "")
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)

  // Change-password sub-form
  const [oldPwd,  setOldPwd]  = useState("")
  const [newPwd,  setNewPwd]  = useState("")
  const [pwdMsg,  setPwdMsg]  = useState(null)
  const [pwdErr,  setPwdErr]  = useState(null)
  const [pwdBusy, setPwdBusy] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { data } = await authAPI.updateProfile({ name, email })
      // Refresh the stored user without changing the token
      const token        = localStorage.getItem("token")
      const refreshToken = localStorage.getItem("refreshToken")
      login(data, token, refreshToken)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!oldPwd || !newPwd) return
    setPwdBusy(true)
    setPwdErr(null)
    setPwdMsg(null)
    try {
      await authAPI.changePassword({ old_password: oldPwd, new_password: newPwd })
      setPwdMsg("Password changed successfully.")
      setOldPwd("")
      setNewPwd("")
    } catch (err) {
      setPwdErr(err?.response?.data?.detail || "Failed to change password")
    } finally {
      setPwdBusy(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage your personal information
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="card p-6 text-center">
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent
              flex items-center justify-center text-white text-3xl font-bold shadow-glow-primary">
              {(name[0] || "U").toUpperCase()}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full
              bg-primary text-white flex items-center justify-center border-2
              border-white dark:border-slate-900 hover:bg-primary-dark transition-colors">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{name || "User"}</h2>
          <p className="text-sm text-gray-400">{email}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full
            bg-success/10 text-success text-xs font-medium">
            <Shield className="w-3.5 h-3.5" /> Pro member
          </div>
        </motion.div>

        {/* Edit form */}
        <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} onSubmit={handleSave} className="lg:col-span-2 card p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5">
            Personal information
          </h3>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20
              border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="input pl-9" placeholder="Your name" required />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9" placeholder="you@example.com" required />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-5 border-t border-gray-100 dark:border-slate-800">
            <p className="text-xs text-gray-400">
              Member since {new Date().toLocaleDateString()}
            </p>
            <div className="flex items-center gap-3">
              {saved && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm text-success">✓ Saved</motion.span>
              )}
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                  bg-primary text-white text-sm font-semibold hover:bg-primary-dark
                  shadow-lg shadow-primary/20 transition-colors disabled:opacity-60">
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </motion.form>
      </div>

      {/* Change password */}
      <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} onSubmit={handleChangePassword} className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-warning" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Change password</h3>
        </div>

        {pwdErr && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20
            border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" /> {pwdErr}
          </div>
        )}
        {pwdMsg && (
          <div className="mb-4 rounded-xl bg-success/10 border border-success/30 px-4 py-3
            text-sm text-success">{pwdMsg}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">
              Current password
            </label>
            <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
              className="input" placeholder="••••••••" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">
              New password
            </label>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              className="input" placeholder="••••••••" minLength={8} required />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
          <button type="submit" disabled={pwdBusy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
              bg-warning text-white text-sm font-semibold hover:bg-yellow-600
              shadow-lg shadow-warning/20 transition-colors disabled:opacity-60">
            {pwdBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {pwdBusy ? "Updating…" : "Update password"}
          </button>
        </div>
      </motion.form>
    </div>
  )
}
