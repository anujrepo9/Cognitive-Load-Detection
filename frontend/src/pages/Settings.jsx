import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Save, Bell, Shield, Cpu, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { settingsAPI, getErrorMessage } from "../services/api"
import { useTheme } from "../context/ThemeContext"
import { PageHeader } from "../components/ui/PageHeader"

function Toggle({ id, on, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button
        role="switch"
        id={id}
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`w-11 h-6 rounded-full transition-colors relative
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
          ${on ? "bg-primary" : "bg-gray-300 dark:bg-slate-700"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
          transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
          aria-hidden="true" />
      </button>
    </div>
  )
}

export default function Settings() {
  const { setTheme: setAppTheme } = useTheme()
  const [tracking,      setTracking]   = useState(true)
  const [interval,      setInterval_]  = useState(5)
  const [notifications, setNotifications] = useState(true)
  const [theme,         setTheme]      = useState("system")
  const [loading,       setLoading]    = useState(true)
  const [saving,        setSaving]     = useState(false)
  const [saved,         setSaved]      = useState(false)
  const [error,         setError]      = useState(null)

  useEffect(() => {
    settingsAPI.get()
      .then(({ data }) => {
        setTracking(data.tracking_enabled ?? true)
        setInterval_(data.flush_interval_sec ?? 5)
        setNotifications(data.notifications_enabled ?? true)
        setTheme(data.theme ?? "system")
        setAppTheme(data.theme ?? "system")
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load settings.")))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  const save = async () => {
    setSaving(true); setError(null)
    try {
      await settingsAPI.update({
        tracking_enabled:      tracking,
        flush_interval_sec:    interval,
        notifications_enabled: notifications,
        theme,
      })
      setAppTheme(theme)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save settings."))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-48" aria-live="polite" aria-label="Loading settings">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHeader title="Settings" subtitle="Manage your tracking preferences and display options">
        <button onClick={save} disabled={saving} className="btn-primary" aria-disabled={saving}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : saved
              ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
              : <><Save className="w-4 h-4" /> Save settings</>}
        </button>
      </PageHeader>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20
          border border-red-200 dark:border-red-800 px-4 py-3 text-sm
          text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {saved && (
        <div role="status" className="rounded-xl bg-green-50 dark:bg-green-900/20
          border border-green-200 dark:border-green-800 px-4 py-3 text-sm
          text-green-700 dark:text-green-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tracking */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          aria-labelledby="tracking-heading" className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <h2 id="tracking-heading" className="font-semibold text-gray-900 dark:text-white">
              Tracking
            </h2>
          </div>

          <div className="space-y-5">
            <Toggle
              id="tracking-toggle"
              on={tracking}
              onChange={setTracking}
              label="Behavior tracking"
              hint="Collect anonymous keyboard timing and mouse movement metrics"
            />

            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Flush interval
              </p>
              <p className="text-xs text-gray-400 mb-3">
                How often behavioral metrics are sent to the prediction model
              </p>
              <div role="group" aria-label="Flush interval options" className="flex gap-2">
                {[5, 10, 15, 30].map((s) => (
                  <button key={s}
                    onClick={() => setInterval_(s)}
                    aria-pressed={interval === s}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                      ${interval === s
                        ? "bg-primary text-white shadow-glow-primary"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"}`}>
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Notifications & theme */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} aria-labelledby="notif-heading" className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-accent" aria-hidden="true" />
            </div>
            <h2 id="notif-heading" className="font-semibold text-gray-900 dark:text-white">
              Notifications &amp; Display
            </h2>
          </div>

          <div className="space-y-5">
            <Toggle
              id="notif-toggle"
              on={notifications}
              onChange={setNotifications}
              label="Load alerts"
              hint="Get notified when cognitive load reaches the high level"
            />

            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Theme</p>
              <div role="group" aria-label="Theme options" className="flex gap-2">
                {["light", "dark", "system"].map((t) => (
                  <button key={t}
                    onClick={() => setTheme(t)}
                    aria-pressed={theme === t}
                    className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                      ${theme === t
                        ? "bg-primary text-white shadow-glow-primary"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Privacy */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} aria-labelledby="privacy-heading" className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-warning" aria-hidden="true" />
          </div>
          <h2 id="privacy-heading" className="font-semibold text-gray-900 dark:text-white">Privacy</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          CogniLoad collects only <strong>aggregate timing and count metrics</strong> —
          keystroke hold durations, inter-key gaps, mouse speed, click counts, scroll rate,
          and idle time percentage. The content you type, individual key values, and passwords
          are never transmitted or stored. All data is tied to your account and is never shared
          with third parties.
        </p>
      </motion.section>
    </div>
  )
}
