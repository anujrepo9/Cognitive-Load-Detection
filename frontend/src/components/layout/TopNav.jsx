import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  Search, Bell, Sun, Moon, X, CheckCircle2, AlertTriangle, BrainCircuit,
  Activity, BarChart3, Lightbulb, Settings,
} from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useAuth } from "../../context/AuthContext"

const SEARCH_ITEMS = [
  { label: "Dashboard",       path: "/dashboard",       icon: BrainCircuit },
  { label: "Live Monitoring", path: "/live",            icon: Activity     },
  { label: "Analytics",       path: "/analytics",       icon: BarChart3    },
  { label: "Recommendations", path: "/recommendations", icon: Lightbulb    },
  { label: "Settings",        path: "/settings",        icon: Settings     },
]

export default function TopNav() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const notifRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen((o) => !o) }
      if (e.key === "Escape") setSearchOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    if (searchOpen) { setSearchQuery(""); setTimeout(() => searchInputRef.current?.focus(), 40) }
  }, [searchOpen])

  const filteredItems = searchQuery.trim()
    ? SEARCH_ITEMS.filter((i) => i.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : SEARCH_ITEMS

  const notifications = [
    { id: 1, icon: AlertTriangle, color: "text-warning", title: "High cognitive load detected", time: "2 min ago" },
    { id: 2, icon: CheckCircle2,  color: "text-success",  title: "Session completed",            time: "1 hr ago"  },
  ]

  return (
    <header className="sticky top-0 z-20 h-14
      bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-sm
      border-b border-[#E5E5E5] dark:border-[#1E1E1E]
      flex items-center justify-between px-6 gap-4">

      {/* Search trigger */}
      <div className="flex items-center gap-3 flex-1 max-w-xs">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Open search"
          className="flex items-center gap-2 w-full px-3 py-1.5
            border border-[#E5E5E5] dark:border-[#2A2A2A]
            bg-gray-50 dark:bg-[#141414]
            text-gray-400 text-[13px]
            hover:border-gray-300 dark:hover:border-[#333] transition-colors">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left truncate">Search…</span>
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5
            bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A]
            text-[10px] font-medium text-gray-400 select-none">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button onClick={toggleTheme} aria-label="Toggle theme"
          className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white
            transition-colors duration-100">
          {resolvedTheme === "dark"
            ? <Sun  className="w-4 h-4" />
            : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications" aria-expanded={notifOpen}
            className="relative p-2 text-gray-400 hover:text-gray-900
              dark:hover:text-white transition-colors duration-100">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#DC2626]"
              aria-hidden="true" />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}
                role="menu"
                className="absolute right-0 mt-1 w-72
                  bg-white dark:bg-[#111111]
                  border border-[#E5E5E5] dark:border-[#222222]
                  shadow-lg z-50">
                <div className="px-4 py-2.5 border-b border-[#E5E5E5] dark:border-[#222222]">
                  <p className="text-[11px] font-semibold tracking-widest uppercase
                    text-gray-400">Notifications</p>
                </div>
                <div className="divide-y divide-[#F0F0F0] dark:divide-[#1E1E1E]">
                  {notifications.map((n) => (
                    <div key={n.id} role="menuitem"
                      className="flex items-start gap-3 px-4 py-3
                        hover:bg-gray-50 dark:hover:bg-[#141414] transition-colors">
                      <n.icon className={`w-4 h-4 mt-0.5 shrink-0 ${n.color}`} aria-hidden="true" />
                      <div>
                        <p className="text-[13px] text-gray-800 dark:text-gray-200">{n.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <Link to="/profile"
          className="w-7 h-7 bg-[#0066FF] flex items-center justify-center
            text-white text-xs font-semibold select-none
            hover:bg-[#0052CC] transition-colors duration-100
            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0066FF]
            ml-1"
          aria-label="Go to Profile">
          {(user?.name?.[0] || "U").toUpperCase()}
        </Link>
      </div>

      {/* Search modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 bg-black/20 dark:bg-black/50
              flex items-start justify-center pt-[20vh] px-4"
            onClick={() => setSearchOpen(false)}
            role="dialog" aria-modal="true" aria-label="Search navigation">
            <motion.div
              initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.15 }}
              className="w-full max-w-md
                bg-white dark:bg-[#111111]
                border border-[#E5E5E5] dark:border-[#2A2A2A]
                shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3
                border-b border-[#E5E5E5] dark:border-[#222222]">
                <Search className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white
                    placeholder-gray-400 outline-none"
                  placeholder="Search pages…"
                  aria-label="Search"
                />
                <button onClick={() => setSearchOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close search">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="py-1" role="listbox">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No results.</p>
                ) : (
                  filteredItems.map(({ label, path, icon: Icon }) => (
                    <button key={path} role="option"
                      onClick={() => { navigate(path); setSearchOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5
                        text-[13px] text-gray-600 dark:text-gray-300
                        hover:bg-gray-50 dark:hover:bg-[#141414]
                        hover:text-gray-900 dark:hover:text-white
                        transition-colors text-left">
                      <Icon className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                      {label}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
