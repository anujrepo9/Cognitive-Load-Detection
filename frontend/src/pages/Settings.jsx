import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Save, Bell, Shield, Cpu, Loader2 } from "lucide-react"
import { settingsAPI } from "../services/api"
import { useTheme } from "../context/ThemeContext"

export default function Settings() {
  const { setTheme: setAppTheme } = useTheme()
  const [tracking,      setTracking]      = useState(true)
  const [interval,      setInterval_]     = useState(5)
  const [notifications, setNotifications] = useState(true)
  const [theme,         setTheme]         = useState("system")
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [error,         setError]         = useState(null)

  // Load settings from backend on mount
  useEffect(() => {
    settingsAPI.get()
      .then(({ data }) => {
        setTracking(data.tracking_enabled)
        setInterval_(data.flush_interval_sec)
        setNotifications(data.notifications_enabled)
        setTheme(data.theme)
        setAppTheme(data.theme)
      })
      .catch(() => setError("Could not load settings"))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await settingsAPI.update({
        tracking_enabled:      tracking,
        flush_interval_sec:    interval,
        notifications_enabled: notifications,
        theme,
      })
      setAppTheme(theme)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const Toggle = ({ on, onChange }) => (
    <button onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full transition-colors relative
        ${on ? "bg-primary" : "bg-gray-300 dark:bg-slate-700"}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
        transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  )

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your app preferences
          </p>
        </div>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-primary text-white text-sm font-semibold hover:bg-primary-dark
            shadow-lg shadow-primary/20 transition-colors disabled:opacity-60">
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Save className="w-4 h-4" />}
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
        </button>
      </motion.div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200
          dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tracking card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Tracking</h3>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Behavior tracking
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Collect keyboard and mouse events
                </p>
              </div>
              <Toggle on={tracking} onChange={setTracking} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Flush interval
              </p>
              <div className="flex gap-2">
                {[5, 10, 15, 30].map((s) => (
                  <button key={s} onClick={() => setInterval_(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                      ${interval === s
                        ? "bg-primary text-white shadow-glow-primary"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"}`}>
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Notifications card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Load alerts
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Notify when cognitive load is high
                </p>
              </div>
              <Toggle on={notifications} onChange={setNotifications} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Theme
              </p>
              <div className="flex gap-2">
                {["light", "dark", "system"].map((t) => (
                  <button key={t} onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all
                      ${theme === t
                        ? "bg-primary text-white shadow-glow-primary"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Privacy */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-warning" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Privacy</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your behavioral data is processed locally and never shared with third parties.
          Settings are persisted server-side and synced across sessions.
        </p>
      </motion.div>
    </div>
  )
}
