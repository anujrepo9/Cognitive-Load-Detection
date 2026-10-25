import { useState, useEffect, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  LayoutDashboard, Activity, History, BarChart3, FileText,
  Lightbulb, Settings, User, LogOut, BrainCircuit, Menu, X,
  ChevronRight, Zap,
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
            relative flex items-center gap-3 mx-2 px-3 py-2 rounded-lg
            text-[13px] font-medium transition-all duration-150 group cursor-pointer
            ${isActive
              ? "bg-[rgba(0,217,232,0.10)] text-[#00D9E8] border border-[rgba(0,217,232,0.18)]"
              : "text-[#536477] hover:text-[#EAF2F8] hover:bg-[rgba(255,255,255,0.04)] border border-transparent"
            }`}
          aria-current={isActive ? "page" : undefined}
        >
          {/* Active cyan left bar */}
          {isActive && (
            <span aria-hidden="true"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-[#00D9E8]"
              style={{ boxShadow: "0 0 8px rgba(0,217,232,0.8)" }}
            />
          )}
          <Icon
            className={`w-4 h-4 shrink-0 transition-all duration-150
              ${isActive
                ? "text-[#00D9E8]"
                : "text-[#536477] group-hover:text-[#8493A7]"
              }`}
            aria-hidden="true"
          />
          <span className="flex-1 tracking-[-0.005em]">{label}</span>
          {isActive && (
            <ChevronRight className="w-3 h-3 text-[#00D9E8] opacity-60" />
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
          className="flex items-center gap-3 focus-visible:outline-none rounded-lg p-1 -m-1"
          aria-label="CogniLoad — Dashboard">
          <div className="w-8 h-8 rounded-[10px] sidebar-brand-gradient
            flex items-center justify-center shrink-0"
            style={{ boxShadow: "0 0 16px rgba(0,217,232,0.35)" }}>
            <BrainCircuit className="w-[18px] h-[18px] text-[#05080D]" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[14px] font-bold tracking-[-0.018em] text-[#EAF2F8]">
              Cogni<span className="text-[#00D9E8]">Load</span>
            </span>
            <div className="text-[10px] tracking-[0.08em] uppercase font-semibold mt-0.5"
              style={{ color: "#536477" }}>
              AI Command Center
            </div>
          </div>
        </NavLink>
      </div>

      {/* Divider */}
      <div className="h-px mx-4" style={{ background: "rgba(100,170,190,0.10)" }} />

      {/* Nav */}
      <nav aria-label="Main navigation" className="flex-1 py-4 overflow-y-auto space-y-0.5">
        <p className="px-5 mb-2 text-[10px] font-semibold tracking-[0.10em] uppercase"
          style={{ color: "#536477" }}>Navigation</p>
        {links.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} onClick={onNavClick} />
        ))}

        <div className="my-4 mx-4 h-px" style={{ background: "rgba(100,170,190,0.10)" }} />
        <p className="px-5 mb-2 text-[10px] font-semibold tracking-[0.10em] uppercase"
          style={{ color: "#536477" }}>Account</p>
        {bottomLinks.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} onClick={onNavClick} />
        ))}
      </nav>

      {/* System status */}
      <div className="mx-3 mb-3 p-3 rounded-lg"
        style={{ background: "rgba(0,217,232,0.05)", border: "1px solid rgba(0,217,232,0.12)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-[#37D9A0]" />
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#37D9A0]">
            System Online
          </span>
        </div>
        <div className="text-[10px] text-[#536477]">All services nominal</div>
      </div>

      {/* User + logout */}
      <div className="border-t mx-0 px-3 pb-3 pt-3"
        style={{ borderColor: "rgba(100,170,190,0.10)" }}>
        <div className="flex items-center gap-3 p-2 rounded-lg
          transition-colors group cursor-pointer"
          style={{ background: "transparent" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div className="w-8 h-8 rounded-full sidebar-brand-gradient
            flex items-center justify-center text-[#05080D] text-[11px] font-bold shrink-0"
            aria-hidden="true"
            style={{ boxShadow: "0 0 10px rgba(0,217,232,0.25)" }}>
            {(user?.name?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#EAF2F8] truncate leading-none">
              {user?.name || "User"}
            </p>
            <p className="text-[11px] truncate mt-1" style={{ color: "#536477" }}>{user?.email}</p>
          </div>
          <button onClick={onLogout}
            className="p-1.5 rounded-md transition-all duration-150"
            style={{ color: "#536477" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#FF5364"; e.currentTarget.style.background = "rgba(255,83,100,0.10)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}
            aria-label="Logout">
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
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
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(5,8,13,0.80)", backdropFilter: "blur(4px)" }}
            onClick={onClose} aria-hidden="true"
          />
          <motion.div
            ref={drawerRef}
            initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            role="dialog" aria-modal="true" aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden glass-strong">
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
        className="lg:hidden fixed top-3 left-3 z-30 p-2 glass"
        style={{ color: "#EAF2F8" }}
        aria-label="Open navigation">
        <Menu className="w-[18px] h-[18px]" />
      </button>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        onLogout={logout}
      />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 h-screen sticky top-0 flex-col shrink-0 z-30"
        style={{
          background: "#050B10",
          borderRight: "1px solid rgba(100,170,190,0.10)",
        }}>
        <SidebarContent user={user} onLogout={logout} />
      </aside>
    </>
  )
}
