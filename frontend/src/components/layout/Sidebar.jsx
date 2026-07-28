import { NavLink } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

const links = [
  { to: "/dashboard",       icon: "⬡", label: "Dashboard" },
  { to: "/analytics",       icon: "📈", label: "Analytics" },
  { to: "/recommendations", icon: "💡", label: "Tips" },
  { to: "/history",         icon: "🕐", label: "History" },
  { to: "/settings",        icon: "⚙", label: "Settings" },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-brand font-bold text-lg tracking-tight">CogniLoad</span>
        <p className="text-gray-500 text-xs mt-0.5">Cognitive Load Detector</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
               ${isActive
                 ? "bg-brand/20 text-brand font-medium"
                 : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"}`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        <button
          onClick={logout}
          className="text-xs text-gray-500 hover:text-red-400 mt-1 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
