import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, Bell, Sun, Moon, Command, X, CheckCircle2, AlertTriangle,
} from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useAuth } from "../../context/AuthContext"

const notifications = [
  { id: 1, icon: AlertTriangle, color: "text-warning",
    title: "High cognitive load detected", time: "2 min ago" },
  { id: 2, icon: CheckCircle2, color: "text-success",
    title: "Recommendation generated", time: "1 hr ago" },
  { id: 3, icon: CheckCircle2, color: "text-success",
    title: "Session completed", time: "3 hrs ago" },
]

export default function TopNav() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [time, setTime] = useState(new Date())
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/80 dark:bg-slate-900/80
      backdrop-blur-xl border-b border-gray-200 dark:border-slate-800
      flex items-center justify-between px-4 lg:px-6 gap-4">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl
            bg-gray-100 dark:bg-slate-800 border border-transparent
            dark:border-slate-700 text-gray-400 text-sm
            hover:border-primary/30 transition-colors">
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left truncate">Search anything…</span>
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5
            rounded-md bg-gray-200 dark:bg-slate-700 text-[10px] font-medium">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Current time */}
        <div className="hidden md:block text-right mr-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-[10px] text-gray-400">
            {time.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>

        {/* Theme switch */}
        <button onClick={toggleTheme}
          className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900
            dark:text-gray-400 dark:hover:text-white
            bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700
            transition-colors" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2.5 rounded-xl text-gray-500 hover:text-gray-900
              dark:text-gray-400 dark:hover:text-white
              bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700
              transition-colors" aria-label="Notifications">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900
                  border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl
                  overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800
                  flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Notifications
                  </p>
                  <span className="text-xs text-primary">View all</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3
                      hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                      <n.icon className={`w-5 h-5 mt-0.5 ${n.color}`} />
                      <div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{n.title}</p>
                        <p className="text-xs text-gray-400">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent
          flex items-center justify-center text-white text-sm font-semibold
          shadow-glow-primary cursor-pointer">
          {(user?.name?.[0] || "U").toUpperCase()}
        </div>
      </div>

      {/* Search modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40
            backdrop-blur-sm flex items-start justify-center pt-24 px-4"
            onClick={() => setSearchOpen(false)}>
            <motion.div initial={{ scale: 0.95, y: -10 }} animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -10 }} transition={{ duration: 0.15 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl
                shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3 border-b
                border-gray-100 dark:border-slate-800">
                <Search className="w-5 h-5 text-gray-400" />
                <input autoFocus
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white
                    placeholder-gray-400" placeholder="Search pages, metrics, features…" />
                <button onClick={() => setSearchOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="p-2">
                {["Dashboard", "Live Monitoring", "Analytics", "Recommendations"].map((s) => (
                  <button key={s} className="w-full flex items-center gap-3 px-3 py-2.5
                    rounded-lg text-sm text-gray-600 dark:text-gray-300
                    hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left">
                    <Search className="w-4 h-4 text-gray-400" />
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
