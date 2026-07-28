const styles = {
  low:     "bg-green-500/15 text-green-400 border-green-500/30",
  medium:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high:    "bg-red-500/15 text-red-400 border-red-500/30",
  unknown: "bg-gray-700/50 text-gray-400 border-gray-600",
}

export default function LoadBadge({ level = "unknown", className = "" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
      text-xs font-medium border ${styles[level]} ${className}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} load
    </span>
  )
}
