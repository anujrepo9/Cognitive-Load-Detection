import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  Search, Bell, X, CheckCircle2, AlertTriangle,
  BrainCircuit, Activity, BarChart3, Lightbulb, Settings,
  Sparkles, Info, Trash2, BellOff, Clock,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"

// ── Search items ─────────────────────────────────────────────────────────────
const SEARCH_ITEMS = [
  { label: "Dashboard",       path: "/dashboard",       icon: BrainCircuit, desc: "Overview & current load" },
  { label: "Live Monitoring", path: "/live",            icon: Activity,     desc: "Real-time tracking"      },
  { label: "Analytics",       path: "/analytics",       icon: BarChart3,    desc: "Trends and insights"     },
  { label: "Recommendations", path: "/recommendations", icon: Lightbulb,    desc: "AI suggestions"          },
  { label: "Settings",        path: "/settings",        icon: Settings,     desc: "Configure your account"  },
]

// ── Default notifications seed (shown until first dismiss/clear) ─────────────
const SEED_NOTIFICATIONS = [
  {
    id: 1,
    icon: "AlertTriangle",
    color: "#FFB547",
    bg:    "rgba(255,181,71,0.10)",
    border:"rgba(255,181,71,0.20)",
    title: "High cognitive load detected",
    desc:  "Consider taking a short break",
    time:  "2 min ago",
    ts:    Date.now() - 2 * 60 * 1000,
  },
  {
    id: 2,
    icon: "CheckCircle2",
    color: "#37D9A0",
    bg:    "rgba(55,217,160,0.10)",
    border:"rgba(55,217,160,0.20)",
    title: "Session completed",
    desc:  "45 min session recorded",
    time:  "1 hr ago",
    ts:    Date.now() - 60 * 60 * 1000,
  },
  {
    id: 3,
    icon: "Info",
    color: "#00D9E8",
    bg:    "rgba(0,217,232,0.10)",
    border:"rgba(0,217,232,0.20)",
    title: "Weekly report ready",
    desc:  "View your insights in the Reports page",
    time:  "3 hr ago",
    ts:    Date.now() - 3 * 60 * 60 * 1000,
  },
]

const ICON_MAP = { AlertTriangle, CheckCircle2, Info, BrainCircuit, Activity }

function resolveIcon(name) {
  return ICON_MAP[name] || Info
}

// Format a stored timestamp into a human-readable relative string
function relativeTime(ts) {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)   return "just now"
  if (mins  < 60)  return `${mins} min ago`
  if (hours < 24)  return `${hours} hr ago`
  return `${days} day${days !== 1 ? "s" : ""} ago`
}

// ── Notification History Modal ────────────────────────────────────────────────
function HistoryModal({ notifications, onClose, onDismiss, onClearAll }) {
  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(5,8,13,0.80)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notification history">

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background:           "rgba(9,15,24,0.97)",
          backdropFilter:       "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border:               "1px solid rgba(0,217,232,0.18)",
          boxShadow:            "0 24px 64px rgba(0,0,0,0.7), 0 0 24px rgba(0,217,232,0.06)",
          maxHeight:            "80vh",
        }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.20)" }}>
              <Bell className="w-4 h-4" style={{ color: "#00D9E8" }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "#EAF2F8" }}>
                Notification History
              </p>
              <p className="text-[11px]" style={{ color: "#536477" }}>
                {notifications.length} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                style={{ background: "rgba(255,83,100,0.08)", border: "1px solid rgba(255,83,100,0.20)", color: "#FF5364" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,83,100,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,83,100,0.08)"}
                aria-label="Clear all notifications">
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "#536477" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#EAF2F8"; e.currentTarget.style.background = "rgba(255,255,255,0.06)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}
              aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(0,217,232,0.06)", border: "1px solid rgba(0,217,232,0.12)" }}>
                <BellOff className="w-6 h-6" style={{ color: "#536477" }} />
              </div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: "#EAF2F8" }}>
                All caught up
              </p>
              <p className="text-[13px]" style={{ color: "#8493A7" }}>
                No notifications to show
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {notifications.map((n, i) => {
                const Icon = resolveIcon(n.icon)
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-start gap-3 px-5 py-3.5 group relative"
                    style={{ borderBottom: "1px solid rgba(100,170,190,0.07)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                    {/* Icon well */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: n.bg, border: `1px solid ${n.border}` }}>
                      <Icon className="w-4 h-4" style={{ color: n.color }} aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium leading-snug" style={{ color: "#EAF2F8" }}>
                        {n.title}
                      </p>
                      <p className="text-[12px] mt-0.5" style={{ color: "#8493A7" }}>
                        {n.desc}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" style={{ color: "#536477" }} />
                        <p className="text-[11px]" style={{ color: "#536477" }}>
                          {relativeTime(n.ts)}
                        </p>
                      </div>
                    </div>

                    {/* Dismiss button — visible on hover */}
                    <button
                      onClick={() => onDismiss(n.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg shrink-0 transition-all mt-0.5"
                      style={{ color: "#536477" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#FF5364"; e.currentTarget.style.background = "rgba(255,83,100,0.10)" }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}
                      aria-label={`Dismiss: ${n.title}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(100,170,190,0.10)" }}>
          <p className="text-[11px]" style={{ color: "#536477" }}>
            Notifications are local to this session
          </p>
          <button
            onClick={onClose}
            className="text-[12px] font-medium transition-colors"
            style={{ color: "#00D9E8" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main TopNav ───────────────────────────────────────────────────────────────
export default function TopNav() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Notifications state — lives here so it persists across dropdown open/close
  const [notifications, setNotifications] = useState(SEED_NOTIFICATIONS)
  const [notifOpen,     setNotifOpen]     = useState(false)
  const [historyOpen,   setHistoryOpen]   = useState(false)
  const [searchOpen,    setSearchOpen]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState("")
  const [selectedIdx,   setSelectedIdx]   = useState(0)

  const notifRef       = useRef(null)
  const searchInputRef = useRef(null)

  const unreadCount = notifications.length

  // Dismiss single notification
  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Open history modal — close the dropdown first
  const openHistory = useCallback(() => {
    setNotifOpen(false)
    setHistoryOpen(true)
  }, [])

  // Click-outside closes dropdown (but not history modal — that has its own backdrop)
  useEffect(() => {
    const h = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // ⌘K / Ctrl+K opens search
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen((o) => !o) }
      if (e.key === "Escape") { setSearchOpen(false); setNotifOpen(false) }
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [])

  useEffect(() => {
    if (searchOpen) {
      setSearchQuery("")
      setSelectedIdx(0)
      setTimeout(() => searchInputRef.current?.focus(), 40)
    }
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

  return (
    <>
      <header
        className="sticky top-0 z-20 h-14 flex items-center justify-between px-5 gap-4"
        style={{
          background:           "rgba(5,8,13,0.90)",
          backdropFilter:       "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom:         "1px solid rgba(100,170,190,0.10)",
        }}>

        {/* ── Search trigger ── */}
        <div className="flex items-center gap-3 flex-1 max-w-xs">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Open search (Ctrl+K)"
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-full text-[13px] transition-all duration-150"
            style={{ background: "rgba(11,20,32,0.8)", border: "1px solid rgba(100,170,190,0.14)", color: "#536477" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,217,232,0.25)"; e.currentTarget.style.color = "#8493A7" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,170,190,0.14)"; e.currentTarget.style.color = "#536477" }}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">Search…</span>
            <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium select-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(100,170,190,0.14)", color: "#536477" }}>
              ⌘K
            </kbd>
          </button>
        </div>

        {/* ── Right cluster ── */}
        <div className="flex items-center gap-1">

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notifOpen}
              aria-haspopup="true"
              className="relative p-2 rounded-full transition-all duration-150"
              style={{ color: "#536477" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#00D9E8"; e.currentTarget.style.background = "rgba(0,217,232,0.08)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}>
              <Bell className="w-[17px] h-[17px]" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[14px] h-[14px] px-[3px] rounded-full
                    flex items-center justify-center text-[9px] font-bold select-none"
                  style={{ background: "#FF5364", color: "#fff", boxShadow: "0 0 6px rgba(255,83,100,0.6)" }}
                  aria-hidden="true">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  role="menu"
                  aria-label="Notifications"
                  className="absolute right-0 mt-2 w-[340px] z-50 overflow-hidden rounded-xl"
                  style={{
                    background:           "rgba(9,15,24,0.97)",
                    backdropFilter:       "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border:               "1px solid rgba(0,217,232,0.18)",
                    boxShadow:            "0 16px 48px rgba(0,0,0,0.6), 0 0 20px rgba(0,217,232,0.06)",
                  }}>

                  {/* Dropdown header */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>
                        Notifications
                      </p>
                      {unreadCount > 0 && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(0,217,232,0.12)", border: "1px solid rgba(0,217,232,0.22)", color: "#00D9E8" }}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {/* Clear all button in header */}
                    {unreadCount > 0 && (
                      <button
                        onClick={clearAll}
                        className="flex items-center gap-1 text-[11px] font-medium transition-colors px-2 py-1 rounded-md"
                        style={{ color: "#536477" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#FF5364"; e.currentTarget.style.background = "rgba(255,83,100,0.08)" }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}
                        aria-label="Clear all notifications">
                        <Trash2 className="w-3 h-3" />
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div className="overflow-y-auto" style={{ maxHeight: "288px" }}>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <BellOff className="w-8 h-8 mb-3" style={{ color: "#536477" }} />
                        <p className="text-[13px] font-medium" style={{ color: "#EAF2F8" }}>
                          All clear
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "#536477" }}>
                          No notifications right now
                        </p>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {notifications.map((n) => {
                          const Icon = resolveIcon(n.icon)
                          return (
                            <motion.div
                              key={n.id}
                              initial={{ opacity: 0, height: "auto" }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              role="menuitem"
                              className="flex items-start gap-3 px-4 py-3 group relative"
                              style={{ borderBottom: "1px solid rgba(100,170,190,0.06)" }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                              {/* Icon */}
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: n.bg, border: `1px solid ${n.border}` }}>
                                <Icon className="w-4 h-4" style={{ color: n.color }} aria-hidden="true" />
                              </div>

                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium leading-snug" style={{ color: "#EAF2F8" }}>
                                  {n.title}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: "#8493A7" }}>
                                  {n.desc}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: "#536477" }}>
                                  {relativeTime(n.ts)}
                                </p>
                              </div>

                              {/* Per-item dismiss — appears on hover */}
                              <button
                                onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md shrink-0 transition-all mt-0.5"
                                style={{ color: "#536477" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#FF5364"; e.currentTarget.style.background = "rgba(255,83,100,0.10)" }}
                                onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}
                                aria-label={`Dismiss: ${n.title}`}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    )}
                  </div>

                  {/* Footer — "View all notifications" opens history modal */}
                  <div className="px-4 py-2.5 flex items-center justify-center"
                    style={{ borderTop: "1px solid rgba(100,170,190,0.10)" }}>
                    <button
                      onClick={openHistory}
                      className="text-[12px] font-semibold w-full text-center py-1.5 rounded-lg transition-all"
                      style={{ color: "#00D9E8" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,217,232,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      View all notifications
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar */}
          <Link
            to="/profile"
            className="w-8 h-8 rounded-full sidebar-brand-gradient flex items-center justify-center
              text-[#05080D] text-xs font-bold select-none ml-1 transition-all duration-150 focus-visible:outline-none"
            style={{ boxShadow: "0 0 12px rgba(0,217,232,0.30)" }}
            aria-label="Go to Profile">
            {(user?.name?.[0] || "U").toUpperCase()}
          </Link>
        </div>

        {/* ── Search modal ── */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4"
              style={{ background: "rgba(5,8,13,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
              onClick={() => setSearchOpen(false)}
              role="dialog" aria-modal="true" aria-label="Search navigation">
              <motion.div
                initial={{ y: -12, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -12, opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg overflow-hidden rounded-xl"
                style={{
                  background:           "rgba(9,15,24,0.96)",
                  backdropFilter:       "blur(40px)",
                  WebkitBackdropFilter: "blur(40px)",
                  border:               "1px solid rgba(0,217,232,0.20)",
                  boxShadow:            "0 24px 64px rgba(0,0,0,0.7), 0 0 30px rgba(0,217,232,0.08)",
                }}
                onClick={(e) => e.stopPropagation()}>

                <div className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
                  <Search className="w-4 h-4 shrink-0" style={{ color: "#00D9E8" }} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKey}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: "#EAF2F8", fontFamily: "'Space Grotesk', 'Inter', system-ui" }}
                    placeholder="Search pages…"
                    aria-label="Search"
                  />
                  <button onClick={() => setSearchOpen(false)}
                    className="p-1 rounded-md transition-colors"
                    style={{ color: "#536477" }}
                    aria-label="Close search">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-2 max-h-72 overflow-y-auto" role="listbox">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: "#536477" }} />
                      <p className="text-sm" style={{ color: "#8493A7" }}>No results found.</p>
                    </div>
                  ) : (
                    filteredItems.map(({ label, path, icon: Icon, desc }, idx) => (
                      <button key={path} role="option"
                        aria-selected={idx === selectedIdx}
                        onClick={() => { navigate(path); setSearchOpen(false) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors text-left"
                        style={{
                          background: idx === selectedIdx ? "rgba(0,217,232,0.08)" : "transparent",
                          color:      idx === selectedIdx ? "#00D9E8" : "#8493A7",
                        }}
                        onMouseEnter={e => { if (idx !== selectedIdx) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                        onMouseLeave={e => { if (idx !== selectedIdx) e.currentTarget.style.background = "transparent" }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: idx === selectedIdx ? "rgba(0,217,232,0.15)" : "rgba(255,255,255,0.04)",
                            border: idx === selectedIdx ? "1px solid rgba(0,217,232,0.25)" : "1px solid rgba(100,170,190,0.10)",
                          }}>
                          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{label}</div>
                          <div className="text-[11px] truncate" style={{ color: "#536477" }}>{desc}</div>
                        </div>
                        {idx === selectedIdx && (
                          <kbd className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ color: "#00D9E8", background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.25)" }}>
                            ↵
                          </kbd>
                        )}
                      </button>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 flex items-center gap-4"
                  style={{ borderTop: "1px solid rgba(100,170,190,0.10)" }}>
                  {[["↑↓", "navigate"], ["↵", "select"], ["esc", "close"]].map(([key, label]) => (
                    <span key={label} className="text-[11px] flex items-center gap-1" style={{ color: "#536477" }}>
                      <kbd className="px-1 rounded text-[10px]"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#8493A7", border: "1px solid rgba(100,170,190,0.12)" }}>
                        {key}
                      </kbd> {label}
                    </span>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Notification History Modal — rendered outside header so it can be full-screen ── */}
      <AnimatePresence>
        {historyOpen && (
          <HistoryModal
            notifications={notifications}
            onClose={() => setHistoryOpen(false)}
            onDismiss={dismiss}
            onClearAll={clearAll}
          />
        )}
      </AnimatePresence>
    </>
  )
}