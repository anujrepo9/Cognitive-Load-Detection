import { motion } from "framer-motion"

const styles = {
  low:     {
    badge: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
    glow: "shadow-emerald-500/30",
  },
  medium:  {
    badge: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
    dot: "bg-amber-500",
    glow: "shadow-amber-500/30",
  },
  high:    {
    badge: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
    dot: "bg-red-500",
    glow: "shadow-red-500/30",
  },
  unknown: {
    badge: "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    dot: "bg-gray-400",
    glow: "",
  },
}

const labels = {
  low: "Low Load", medium: "Medium Load", high: "High Load", unknown: "Unknown",
}

export default function LoadBadge({ level = "unknown", className = "", showDot = true, animate = false }) {
  const s = styles[level] || styles.unknown
  const label = labels[level] || "Unknown"

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1
        text-xs font-semibold rounded-full border ${s.badge} ${s.glow ? `shadow-sm ${s.glow}` : ""} ${className}`}
    >
      {showDot && (
        <span className="relative flex w-1.5 h-1.5">
          {animate && level !== "unknown" && (
            <span className={`absolute inset-0 rounded-full ${s.dot} animate-ping opacity-70`} />
          )}
          <span className={`relative rounded-full w-1.5 h-1.5 ${s.dot}`} />
        </span>
      )}
      {label}
    </span>
  )
}
