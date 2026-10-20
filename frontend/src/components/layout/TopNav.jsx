import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  Search, Bell, Sun, Moon, X, CheckCircle2, AlertTriangle, BrainCircuit,
  Activity, BarChart3, Lightbulb, Settings, Sparkles, Info,
} from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useAuth } from "../../context/AuthContext"

const SEARCH_ITEMS = [
  { label: "Dashboard",       path: "/dashboard",       icon: BrainCircuit, desc: "Overview & current load" },
  { label: "Live Monitoring", path: "/live",            icon: Activity,     desc: "Real-time tracking"     },
  { label: "Analytics",       path: "/analytics",       icon: BarChart3,    desc: "Trends and insights"    },
  { label: "Recommendations", path: "/recommendations", icon: Lightbulb,    desc: "AI suggestions"         },
  { label: "Settings",        path: "/settings",        icon: Settings,     desc: "Configure your account" },
]

export default function TopNav() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifOpen,   setNotifOpen]   = useState(false)
  const [searchOpen,  setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIdx, setSelectedIdx] = useState(0)
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
    if (searchOpen) { setSearchQuery(""); setSelectedIdx(0); setTimeout(() => searchInputRef.current?.focus(), 40) }
  }, [searchOpen])

  const filteredItems = searchQuery.trim()
    ? SEARCH_ITEMS.filter((i) => i.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : SEARCH_ITEMS

  useEffect(() => { setSelectedIdx(0) }, [searchQuery])

  const handleSearchKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filteredItems.length - 1)) }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === "Enter" && filteredItems[selectedIdx]) {
      navigate(filteredItems[selectedIdx].path)
      setSearchOpen(false)
    }
  }

  const notifications = [
    { id: 1, icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/12",  title: "High cognitive load detected", desc: "Consider taking a short break", time: "2 min ago" },
    { id: 2, icon: CheckCircle2,  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/12", title: "Session completed",            desc: "45 min session recorded",    time: "1 hr ago"  },
    { id: 3, icon: Info,          color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/12", title: "Weekly report ready",           desc: "View your insights",         time: "3 hr ago"  },
  ]

  return (
    <header className="sticky top-0 z-20 h-14 glass
      flex items-center justify-between px-5 gap-4">

      {/* Search trigger — slim glass pill */}
      <div className="flex items-center gap-3 flex-1 max-w-xs">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Open search (Ctrl+K)"
          className="flex items-center gap-2 w-full px-3 py-1.5
            border border-[#e5e5ea] dark:border-white/10
            bg-white/60 dark:bg-white/5
            text-[#86868b] dark:text-[#a1a1a6] text-[13px] rounded-full
            hover:border-indigo-300 dark:hover:border-indigo-600/60
            hover:bg-white dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]
            transition-all duration-150 group backdrop-blur-md">
          <Search className="w-3.5 h-3.5 shrink-0 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors" />
          <span className="flex-1 text-left truncate">Search…</span>
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5
            bg-white dark:bg-white/10 border border-[#e5e5ea] dark:border-white/10
            text-[10px] font-medium text-[#86868b] dark:text-[#a1a1a6] rounded select-none">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button onClick={toggleTheme} aria-label="Toggle theme"
          className="p-2 text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]
            hover:bg-black/[0.04] dark:hover:bg-white/5 rounded-full
            transition-colors duration-150">
          {resolvedTheme === "dark"
            ? <Sun  className="w-[18px] h-[18px]" />
            : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications" aria-expanded={notifOpen}
            className="relative p-2 text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f]
              dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/5
              rounded-full transition-colors duration-150">
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full
              ring-2 ring-white/80 dark:ring-[#0e0e14]" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                role="menu"
                className="absolute right-0 mt-2 w-80 glass-strong z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e5e5ea] dark:border-white/5 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Notifications
                  </p>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300
                    bg-indigo-50 dark:bg-indigo-500/12 px-2 py-0.5 rounded-full">
                    {notifications.length} new
                  </span>
                </div>
                <div className="divide-y divide-[#f5f5f7] dark:divide-white/5 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} role="menuitem"
                      className="flex items-start gap-3 px-4 py-3
                        hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors cursor-pointer">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.bg}`}>
                        <n.icon className={`w-4 h-4 ${n.color}`} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight tracking-[-0.005em]">
                          {n.title}
                        </p>
                        <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">{n.desc}</p>
                        <p className="text-[11px] text-[#c7c7cc] dark:text-[#48484a] mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-[#e5e5ea] dark:border-white/5">
                  <button className="text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 font-medium w-full text-center">
                    View all notifications
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <Link to="/profile"
          className="w-8 h-8 rounded-full sidebar-brand-gradient
            flex items-center justify-center
            text-white text-xs font-semibold select-none ml-1
            hover:shadow-md hover:shadow-indigo-500/25
            transition-all duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          aria-label="Go to Profile">
          {(user?.name?.[0] || "U").toUpperCase()}
        </Link>
      </div>

      {/* Search modal — refined glass */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 backdrop-blur-sm
              flex items-start justify-center pt-[18vh] px-4"
            onClick={() => setSearchOpen(false)}
            role="dialog" aria-modal="true" aria-label="Search navigation">
            <motion.div
              initial={{ y: -12, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -12, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg glass-strong overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3.5
                border-b border-[#e5e5ea] dark:border-white/5">
                <Search className="w-4 h-4 text-indigo-500 dark:text-indigo-300 shrink-0" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                  className="flex-1 bg-transparent text-sm text-[#1d1d1f] dark:text-[#f5f5f7]
                    placeholder-[#86868b] dark:placeholder-[#6e6e73] outline-none tracking-[-0.005em]"
                  placeholder="Search pages…"
                  aria-label="Search"
                />
                <button onClick={() => setSearchOpen(false)}
                  className="p-1 text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]
                    hover:bg-black/[0.04] dark:hover:bg-white/5 rounded-md transition-colors"
                  aria-label="Close search">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="py-2 max-h-72 overflow-y-auto" role="listbox">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Sparkles className="w-6 h-6 text-[#c7c7cc] dark:text-[#48484a] mx-auto mb-2" />
                    <p className="text-sm text-[#86868b] dark:text-[#a1a1a6]">No results found.</p>
                  </div>
                ) : (
                  filteredItems.map(({ label, path, icon: Icon, desc }, idx) => (
                    <button key={path} role="option"
                      aria-selected={idx === selectedIdx}
                      onClick={() => { navigate(path); setSearchOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5
                        text-[13px] transition-colors text-left tracking-[-0.005em]
                        ${idx === selectedIdx
                          ? "bg-indigo-50/80 dark:bg-indigo-500/12 text-indigo-700 dark:text-indigo-200"
                          : "text-[#6e6e73] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/5"
                        }`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                        ${idx === selectedIdx ? "bg-indigo-100 dark:bg-indigo-500/20" : "bg-[#f5f5f7] dark:bg-white/5"}`}>
                        <Icon className={`w-3.5 h-3.5 ${idx === selectedIdx ? "text-indigo-500" : "text-[#86868b] dark:text-[#a1a1a6]"}`} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{label}</div>
                        <div className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate">{desc}</div>
                      </div>
                      {idx === selectedIdx && (
                        <kbd className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10
                          px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/30">
                          ↵
                        </kbd>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t border-[#e5e5ea] dark:border-white/5 flex items-center gap-4">
                <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1">
                  <kbd className="bg-[#f5f5f7] dark:bg-white/5 px-1 rounded text-[#6e6e73] dark:text-[#a1a1a6]">↑↓</kbd> navigate
                </span>
                <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1">
                  <kbd className="bg-[#f5f5f7] dark:bg-white/5 px-1 rounded text-[#6e6e73] dark:text-[#a1a1a6]">↵</kbd> select
                </span>
                <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1">
                  <kbd className="bg-[#f5f5f7] dark:bg-white/5 px-1 rounded text-[#6e6e73] dark:text-[#a1a1a6]">esc</kbd> close
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
