import { useState, useEffect, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  LayoutDashboard, Activity, History, BarChart3, FileText,
  Lightbulb, Settings, User, LogOut, BrainCircuit, Menu, X,
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

// ── Mobile drawer ─────────────────────────────────────────────────────────────
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
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={onClose} aria-hidden="true"
          />
          <motion.div
            ref={drawerRef}
            initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            role="dialog" aria-modal="true" aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 w-60
              bg-white dark:bg-[#0A0A0A]
              border-r border-[#E5E5E5] dark:border-[#1E1E1E]
              flex flex-col lg:hidden">
            <SidebarContent user={user} onLogout={onLogout} onNavClick={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Shared sidebar content ────────────────────────────────────────────────────
function SidebarContent({ user, onLogout, onNavClick }) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 h-14
        border-b border-[#E5E5E5] dark:border-[#1E1E1E] shrink-0">
        <NavLink to="/dashboard" onClick={onNavClick}
          className="flex items-center gap-2.5 focus-visible:outline-none
            focus-visible:ring-1 focus-visible:ring-[#0066FF]"
          aria-label="CogniLoad — Dashboard">
          <BrainCircuit className="w-5 h-5 text-[#0066FF]" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
            Cogni<span className="text-[#0066FF]">Load</span>
          </span>
        </NavLink>
      </div>

      {/* Nav */}
      <nav aria-label="Main navigation" className="flex-1 py-3 overflow-y-auto">
        <p className="px-5 mb-1 text-[10px] font-semibold tracking-widest
          text-gray-400 dark:text-gray-600 uppercase">Menu</p>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onNavClick}>
            {({ isActive }) => (
              <div className={`relative flex items-center gap-3 px-5 py-2
                text-[13px] font-medium transition-colors duration-100
                ${isActive
                  ? "text-[#0066FF] bg-[#0066FF]/5"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#141414]"
                }`}
                aria-current={isActive ? "page" : undefined}>
                {/* Left accent line */}
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0066FF]" />
                )}
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </div>
            )}
          </NavLink>
        ))}

        <div className="my-3 mx-5 border-t border-[#E5E5E5] dark:border-[#1E1E1E]" />
        <p className="px-5 mb-1 text-[10px] font-semibold tracking-widest
          text-gray-400 dark:text-gray-600 uppercase">Account</p>

        {bottomLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onNavClick}>
            {({ isActive }) => (
              <div className={`relative flex items-center gap-3 px-5 py-2
                text-[13px] font-medium transition-colors duration-100
                ${isActive
                  ? "text-[#0066FF] bg-[#0066FF]/5"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#141414]"
                }`}
                aria-current={isActive ? "page" : undefined}>
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0066FF]" />
                )}
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-[#E5E5E5] dark:border-[#1E1E1E] p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-7 h-7 bg-[#0066FF] flex items-center justify-center
              text-white text-xs font-semibold shrink-0"
            aria-hidden="true">
            {(user?.name?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate leading-none">
              {user?.name || "User"}
            </p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{user?.email}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="flex items-center gap-2 w-full px-0 py-1
            text-[13px] font-medium text-gray-400 hover:text-[#DC2626]
            transition-colors duration-100"
          aria-label="Logout">
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
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
        className="lg:hidden fixed top-3.5 left-4 z-30 p-1.5
          text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
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

      {/* Desktop sidebar — fixed width, no collapse (Swiss: clarity over density) */}
      <aside className="hidden lg:flex w-56 h-screen sticky top-0
        bg-white dark:bg-[#0A0A0A]
        border-r border-[#E5E5E5] dark:border-[#1E1E1E]
        flex-col shrink-0 z-30">
        <SidebarContent user={user} onLogout={logout} />
      </aside>
    </>
  )
}
