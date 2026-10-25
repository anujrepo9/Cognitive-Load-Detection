import { useState } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import { Save, Bell, Shield, Cpu, Loader2, CheckCircle2, AlertCircle, Power } from "lucide-react"
import { settingsAPI, getErrorMessage } from "../services/api"
import { PageHeader } from "../components/ui/PageHeader"

function Toggle({ id, on, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium" style={{ color: "#EAF2F8" }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: "#8493A7" }}>{hint}</p>}
      </div>
      <button
        role="switch" id={id} aria-checked={on} aria-label={label}
        onClick={() => onChange(!on)}
        className="w-11 h-6 rounded-full relative flex-shrink-0 focus-visible:outline-none"
        style={{ background: on ? "#00D9E8" : "rgba(100,170,190,0.15)", transition: "background 0.2s" }}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0"}`}
          style={{ background: on ? "#05080D" : "#8493A7" }}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}

const SECTION_STYLE = {
  background: "#0B1420",
  border: "1px solid rgba(100,170,190,0.14)",
  borderRadius: 14,
  padding: "1.5rem",
}

const INTERVAL_BTN = (active) => ({
  padding: "0.375rem 1rem",
  borderRadius: 10,
  fontSize: "0.875rem",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s ease",
  background: active ? "#00D9E8" : "rgba(100,170,190,0.08)",
  color:      active ? "#05080D" : "#8493A7",
  border:     active ? "1px solid rgba(0,217,232,0.40)" : "1px solid rgba(100,170,190,0.14)",
  boxShadow:  active ? "0 0 12px rgba(0,217,232,0.25)" : "none",
})

export default function Settings() {
  const [tracking,        setTracking]        = useState(true)
  const [interval,        setInterval_]       = useState(5)
  const [notifications,   setNotifications]   = useState(true)
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [error,           setError]           = useState(null)
  const [autostart,       setAutostart]       = useState(false)
  const [autostartSaving, setAutostartSaving] = useState(false)
  const [autostartError,  setAutostartError]  = useState(null)

  useAuthFetch(() => {
    Promise.all([
      settingsAPI.get(),
      settingsAPI.getAutostart().catch(() => ({ enabled: false })),
    ]).then(([data, autostartData]) => {
      setTracking(data.tracking_enabled ?? true)
      setInterval_(data.flush_interval_sec ?? 5)
      setNotifications(data.notifications_enabled ?? true)
      setAutostart(autostartData.enabled ?? false)
    })
      .catch((err) => setError(getErrorMessage(err, "Could not load settings.")))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setError(null)
    try {
      await settingsAPI.update({
        tracking_enabled:      tracking,
        flush_interval_sec:    interval,
        notifications_enabled: notifications,
        theme:                 "dark",
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save settings."))
    } finally {
      setSaving(false)
    }
  }

  const toggleAutostart = async (next) => {
    setAutostartSaving(true)
    setAutostartError(null)
    try {
      if (next) { await settingsAPI.enableAutostart() }
      else      { await settingsAPI.disableAutostart() }
      setAutostart(next)
    } catch (err) {
      setAutostartError(getErrorMessage(err, "Failed to update startup setting."))
    } finally {
      setAutostartSaving(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-48" aria-live="polite">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#00D9E8" }} />
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <PageHeader
        title="Settings"
        description="Manage your tracking preferences and application options"
        action={
          <button onClick={save} disabled={saving} className="btn-primary" aria-disabled={saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : saved
                ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
                : <><Save className="w-4 h-4" /> Save settings</>}
          </button>
        }
      />

      {/* Error banner */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(255,83,100,0.10)", border: "1px solid rgba(255,83,100,0.25)", color: "#FF5364" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Saved banner */}
      {saved && (
        <div role="status" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(55,217,160,0.10)", border: "1px solid rgba(55,217,160,0.25)", color: "#37D9A0" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tracking */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          aria-labelledby="tracking-heading" style={SECTION_STYLE}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.20)" }}>
              <Cpu className="w-5 h-5" style={{ color: "#00D9E8" }} aria-hidden="true" />
            </div>
            <h2 id="tracking-heading" className="text-[14px] font-semibold" style={{ color: "#EAF2F8" }}>
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
              <p className="text-sm font-medium mb-1" style={{ color: "#EAF2F8" }}>Flush interval</p>
              <p className="text-xs mb-3" style={{ color: "#536477" }}>
                How often behavioral metrics are sent to the prediction model
              </p>
              <div role="group" aria-label="Flush interval options" className="flex gap-2 flex-wrap">
                {[5, 10, 15, 30].map((s) => (
                  <button key={s}
                    onClick={() => setInterval_(s)}
                    aria-pressed={interval === s}
                    style={INTERVAL_BTN(interval === s)}>
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Notifications */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} aria-labelledby="notif-heading" style={SECTION_STYLE}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(119,117,255,0.10)", border: "1px solid rgba(119,117,255,0.20)" }}>
              <Bell className="w-5 h-5" style={{ color: "#7775FF" }} aria-hidden="true" />
            </div>
            <h2 id="notif-heading" className="text-[14px] font-semibold" style={{ color: "#EAF2F8" }}>
              Notifications
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

            {/* Theme info — no selector, dark-only */}
            <div className="rounded-xl p-3.5"
              style={{ background: "rgba(0,217,232,0.05)", border: "1px solid rgba(0,217,232,0.12)" }}>
              <p className="text-xs font-semibold tracking-[0.08em] uppercase mb-1" style={{ color: "#00D9E8" }}>
                Display mode
              </p>
              <p className="text-xs" style={{ color: "#8493A7" }}>
                CogniLoad uses a fixed dark theme optimised for the cyberpunk AI interface.
                Light mode is not available.
              </p>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Windows Startup */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }} aria-labelledby="startup-heading" style={SECTION_STYLE}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(55,217,160,0.10)", border: "1px solid rgba(55,217,160,0.20)" }}>
            <Power className="w-5 h-5" style={{ color: "#37D9A0" }} aria-hidden="true" />
          </div>
          <h2 id="startup-heading" className="text-[14px] font-semibold" style={{ color: "#EAF2F8" }}>
            Windows Startup
          </h2>
        </div>

        {autostartError && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(255,83,100,0.10)", border: "1px solid rgba(255,83,100,0.25)", color: "#FF5364" }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            {autostartError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "#EAF2F8" }}>Launch at login</p>
            <p className="text-xs mt-0.5" style={{ color: "#536477" }}>
              Start CogniLoad automatically when you sign in to Windows
            </p>
          </div>
          {autostartSaving ? (
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: "#00D9E8" }} />
          ) : (
            <button
              role="switch"
              aria-checked={autostart}
              aria-label="Launch at Windows login"
              onClick={() => toggleAutostart(!autostart)}
              className="w-11 h-6 rounded-full relative flex-shrink-0 focus-visible:outline-none"
              style={{ background: autostart ? "#00D9E8" : "rgba(100,170,190,0.15)", transition: "background 0.2s" }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${autostart ? "translate-x-[18px]" : "translate-x-0"}`}
                style={{ background: autostart ? "#05080D" : "#8493A7" }}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </motion.section>

      {/* Privacy */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} aria-labelledby="privacy-heading" style={SECTION_STYLE}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,181,71,0.10)", border: "1px solid rgba(255,181,71,0.20)" }}>
            <Shield className="w-5 h-5" style={{ color: "#FFB547" }} aria-hidden="true" />
          </div>
          <h2 id="privacy-heading" className="text-[14px] font-semibold" style={{ color: "#EAF2F8" }}>
            Privacy
          </h2>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "#8493A7" }}>
          CogniLoad collects only <strong style={{ color: "#EAF2F8" }}>aggregate timing and count metrics</strong> —
          keystroke hold durations, inter-key gaps, mouse speed, click counts, scroll rate,
          and idle time percentage. The content you type, individual key values, and passwords
          are never transmitted or stored. All data is tied to your account and is never shared
          with third parties.
        </p>
      </motion.section>

    </div>
  )
}