import { useState, useEffect, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard, Activity, History, BarChart3, FileText,
  Lightbulb, Settings, User, LogOut, BrainCircuit, ChevronsLeft,
  ChevronsRight, Menu,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"

const links = [
  { to: "/dashboard",       icon: LayoutDashboard, label: "Dashboard"       },
  { to: "/live",            icon: Activity,        label: "Live Monitoring" },
  { to: "/history",         icon: History,         label: "Session History" },
  { to: "/analytics",       icon: BarChart3,       label: "Analytics"       },
  { to: "/reports",         icon: FileText,        label: "Reports"         },
  { to: "/recommendations", icon: Lightbulb,       label: "Recommendations" },
]

const bottomLinks = [
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/profile",  icon: User,     label: "Profile"  },
]

// ── Mobile drawer overlay ─────────────────────────────────────────────────────
function MobileDrawer({ open, onClose, user, onLogout }) {
  const drawerRef = useRef(null)

  // Trap focus inside drawer when open
  useEffect(() => {
    if (!open) return
    const el = drawerRef.current
    if (!el) return
    const focusable = el.querySelectorAll(
      'a, button, [tabindex]:not([tabindex="-1"])'
    )
    focusable[0]?.focus()
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            role="dialog" aria-modal="true" aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900
              border-r border-gray-200 dark:border-slate-800 flex flex-col lg:hidden">
            <SidebarContent user={user} onLogout={onLogout} onNavClick={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Shared sidebar content ────────────────────────────────────────────────────
function SidebarContent({ user, onLogout, collapsed, onNavClick }) {
  return (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b
        border-gray-100 dark:border-slate-800 shrink-0">
        {!collapsed && (
          <NavLink to="/dashboard" onClick={onNavClick}
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Go to Dashboard">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary
              to-accent flex items-center justify-center shadow-glow-primary">
              <BrainCircuit className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white leading-none">
                Cogni<span className="text-primary">Load</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">AI Detection</p>
            </div>
          </NavLink>
        )}
        {collapsed && (
          <NavLink to="/dashboard" onClick={onNavClick}
            className="w-full flex justify-center rounded-lg focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Go to Dashboard">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary
              to-accent flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
          </NavLink>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onNavClick}>
            {({ isActive }) => (
              <div className={`relative flex items-center gap-3 px-3 py-2.5
                rounded-xl text-sm font-medium transition-colors
                ${isActive
                  ? "text-primary bg-primary/10"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800"}`}
                aria-current={isActive ? "page" : undefined}>
                {isActive && !collapsed && (
                  <motion.span layoutId="sidebar-active"
                    className="absolute left-0 inset-y-0 w-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom links */}
      <div className="px-3 py-2 space-y-1 border-t border-gray-100 dark:border-slate-800">
        {bottomLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onNavClick}>
            {({ isActive }) => (
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium transition-colors
                ${isActive
                  ? "text-primary bg-primary/10"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800"}`}
                aria-current={isActive ? "page" : undefined}>
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </div>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-800">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl
            bg-gray-50 dark:bg-slate-800/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary
              to-accent flex items-center justify-center text-white text-sm font-semibold shrink-0"
              aria-hidden="true">
              {(user?.name?.[0] || "U").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        )}
        <button onClick={onLogout}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
            font-medium text-gray-500 dark:text-gray-400 hover:text-danger
            hover:bg-danger/10 transition-colors w-full
            ${collapsed ? "justify-center" : ""}`}
          aria-label="Logout">
          <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  return (
    <>
      {/* Mobile toggle button (visible only < lg) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-xl
          bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800
          shadow-md text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-label="Open navigation">
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        onLogout={logout}
      />

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 256 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden lg:flex h-screen sticky top-0 bg-white dark:bg-slate-900
          border-r border-gray-200 dark:border-slate-800 flex-col shrink-0
          overflow-hidden z-30">
        <SidebarContent user={user} onLogout={logout} collapsed={collapsed} />
        {/* Collapse toggle */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2
              text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
              rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed
              ? <ChevronsRight className="w-5 h-5" aria-hidden="true" />
              : <><ChevronsLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="text-xs">Collapse</span></>}
          </button>
        </div>
      </motion.aside>
    </>
  )
}