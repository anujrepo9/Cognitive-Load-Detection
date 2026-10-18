import { useState, useEffect, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  LayoutDashboard, Activity, History, BarChart3, FileText,
  Lightbulb, Settings, User, LogOut, BrainCircuit, Menu, X,
  ChevronRight,
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

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}>
      {({ isActive }) => (
        <div
          className={`
            relative flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg
            text-[13px] font-medium transition-all duration-150 group
            ${isActive
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
          aria-current={isActive ? "page" : undefined}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-full -ml-3" />
          )}
          <Icon
            className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105
              ${isActive ? "text-indigo-500" : "text-gray-400 dark:text-gray-500"}`}
            aria-hidden="true"
          />
          <span className="flex-1">{label}</span>
          {isActive && (
            <ChevronRight className="w-3 h-3 text-indigo-400 opacity-60" />
          )}
        </div>
      )}
    </NavLink>
  )
}

function SidebarContent({ user, onLogout, onNavClick }) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center px-5 h-16 shrink-0">
        <NavLink to="/dashboard" onClick={onNavClick}
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-lg p-1 -m-1"
          aria-label="CogniLoad — Dashboard">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
            flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
            <BrainCircuit className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" aria-hidden="true" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">
              Cogni<span className="text-indigo-500">Load</span>
            </span>
            <div className="text-[10px] text-gray-400 leading-none mt-0.5">Cognitive Monitor</div>
          </div>
        </NavLink>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />

      {/* Nav */}
      <nav aria-label="Main navigation" className="flex-1 py-4 overflow-y-auto space-y-0.5">
        <p className="px-5 mb-2 text-[10px] font-semibold tracking-wider
          text-gray-400 dark:text-gray-600 uppercase">Main</p>
        {links.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} onClick={onNavClick} />
        ))}

        <div className="my-4 mx-4 h-px bg-gray-100 dark:bg-gray-800" />
        <p className="px-5 mb-2 text-[10px] font-semibold tracking-wider
          text-gray-400 dark:text-gray-600 uppercase">Account</p>
        {bottomLinks.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} onClick={onNavClick} />
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-4">
        <div className="flex items-center gap-3 p-2 rounded-xl
          hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
            flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0"
            aria-hidden="true">
            {(user?.name?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate leading-none">
              {user?.name || "User"}
            </p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{user?.email}</p>
          </div>
          <button onClick={onLogout}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10
              rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
            aria-label="Logout">
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
        <button onClick={onLogout}
          className="mt-1 flex items-center gap-2 w-full px-2 py-1.5 rounded-lg
            text-[12px] font-medium text-gray-400 hover:text-red-500
            hover:bg-red-50 dark:hover:bg-red-500/10
            transition-all duration-150"
          aria-label="Sign out">
          <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )
}

function MobileDrawer({ open, onClose, user, onLogout }) {
  const drawerRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const el = drawerRef.current
    if (!el) return
    el.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')[0]?.focus()
    const handle = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={onClose} aria-hidden="true"
          />
          <motion.div
            ref={drawerRef}
            initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            role="dialog" aria-modal="true" aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 w-64
              bg-white dark:bg-[#0d1117]
              border-r border-gray-200 dark:border-gray-800
              flex flex-col lg:hidden shadow-2xl">
            <div className="flex items-center justify-end px-4 py-3">
              <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close menu">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent user={user} onLogout={onLogout} onNavClick={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2
          bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
          text-gray-500 hover:text-gray-900 dark:hover:text-white
          rounded-lg shadow-sm transition-colors"
        aria-label="Open navigation">
        <Menu className="w-4.5 h-4.5 w-[18px] h-[18px]" />
      </button>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        onLogout={logout}
      />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 h-screen sticky top-0
        bg-white dark:bg-[#0d1117]
        border-r border-gray-200 dark:border-gray-800
        flex-col shrink-0 z-30">
        <SidebarContent user={user} onLogout={logout} />
      </aside>
    </>
  )
}
