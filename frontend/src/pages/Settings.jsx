import { useState } from "react"
import { motion } from "framer-motion"
import { Save, Bell, Shield, Cpu } from "lucide-react"

export default function Settings() {
  const [tracking, setTracking] = useState(true)
  const [interval, setInterval_] = useState(5)
  const [notifications, setNotifications] = useState(true)
  const [saved, setSaved] = useState(false)

  const save = () => {
    localStorage.setItem("settings", JSON.stringify({ tracking, interval, notifications }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Toggle = ({ on, onChange }) => (
    <button onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full transition-colors relative
        ${on ? "bg-primary" : "bg-gray-300 dark:bg-slate-700"}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
        transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
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
        <button onClick={save}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-primary text-white text-sm font-semibold hover:bg-primary-dark
            shadow-lg shadow-primary/20 transition-colors">
          <Save className="w-4 h-4" /> {saved ? "Saved ✓" : "Save settings"}
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                Prediction interval
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
                  Notify when load is high
                </p>
              </div>
              <Toggle on={notifications} onChange={setNotifications} />
            </div>
          </div>
        </motion.div>
      </div>

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
          You can clear all collected data at any time.
        </p>
      </motion.div>
    </div>
  )
}
