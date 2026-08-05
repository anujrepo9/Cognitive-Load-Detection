import { motion } from "framer-motion"

const styles = {
  low: {
    badge: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  medium: {
    badge: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  },
  high: {
    badge: "bg-danger/10 text-danger border-danger/30",
    dot: "bg-danger",
  },
  unknown: {
    badge: "bg-gray-500/10 text-gray-500 border-gray-500/30",
    dot: "bg-gray-400",
  },
}

export default function LoadBadge({ level = "unknown", className = "", showDot = true }) {
  const s = styles[level] || styles.unknown
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-xs font-semibold border ${s.badge} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
      {level.charAt(0).toUpperCase() + level.slice(1)} load
    </motion.span>
  )
}
