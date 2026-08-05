import { useState } from "react"
import { NavLink } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard, Activity, History, BarChart3, FileText,
  Lightbulb, Settings, User, LogOut, BrainCircuit, ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"

const links = [
  { to: "/dashboard",       icon: LayoutDashboard,  label: "Dashboard" },
  { to: "/live",            icon: Activity,         label: "Live Monitoring" },
  { to: "/history",         icon: History,          label: "Session History" },
  { to: "/analytics",       icon: BarChart3,        label: "Analytics" },
  { to: "/reports",         icon: FileText,         label: "Reports" },
  { to: "/recommendations", icon: Lightbulb,        label: "Recommendations" },
]

const bottomLinks = [
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/profile",  icon: User,     label: "Profile" },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-screen sticky top-0 bg-white dark:bg-slate-900 border-r
        border-gray-200 dark:border-slate-800 flex flex-col shrink-0
        overflow-hidden z-30"
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b
        border-gray-100 dark:border-slate-800 shrink-0">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary
              to-accent flex items-center justify-center shadow-glow-primary">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white leading-none">
                Cogni<span className="text-primary">Load</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">AI Detection</p>
            </div>
          </motion.div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary
              to-accent flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}>
              {({ isActive }) => (
                <div className={`relative flex items-center gap-3 px-3 py-2.5
                  rounded-xl text-sm font-medium transition-colors
                  ${isActive
                    ? "text-primary bg-primary/10"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800"}`
                }>
                  {isActive && !collapsed && (
                    <motion.span layoutId="sidebar-active"
                      className="absolute left-0 inset-y-0 w-0.5 bg-primary rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.05 }}
                    >
                      {label}
                    </motion.span>
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </AnimatePresence>
      </nav>

      {/* Bottom links */}
      <div className="px-3 py-2 space-y-1 border-t border-gray-100 dark:border-slate-800">
        {bottomLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium transition-colors
                ${isActive
                  ? "text-primary bg-primary/10"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800"}`
              }>
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </div>

      {/* User + collapse */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-800">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl
            bg-gray-50 dark:bg-slate-800/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary
              to-accent flex items-center justify-center text-white text-sm font-semibold shrink-0">
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
        <button onClick={logout}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
            font-medium text-gray-500 dark:text-gray-400 hover:text-danger
            hover:bg-danger/10 transition-colors w-full ${collapsed ? "justify-center" : ""}`}>
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1
            text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
            rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
          {collapsed
            ? <ChevronsRight className="w-5 h-5" />
            : <><ChevronsLeft className="w-5 h-5" /><span className="text-xs">Collapse</span></>}
        </button>
      </div>
    </motion.aside>
  )
}
