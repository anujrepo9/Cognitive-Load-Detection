/**
 * Load badge — Apple-style pill, refined.
 * - Removed the heavy shadow-glow (was over-the-top).
 * - Slimmer pill, tigher dot, monochrome + accent treatment.
 */
const styles = {
  low: {
    badge: "text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-500/12 border-emerald-200/80 dark:border-emerald-500/25",
    dot:   "bg-emerald-500",
  },
  medium: {
    badge: "text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-500/12 border-amber-200/80 dark:border-amber-500/25",
    dot:   "bg-amber-500",
  },
  high: {
    badge: "text-red-700 dark:text-red-300 bg-red-50/80 dark:bg-red-500/12 border-red-200/80 dark:border-red-500/25",
    dot:   "bg-red-500",
  },
  unknown: {
    badge: "text-[#6e6e73] dark:text-[#a1a1a6] bg-[#f5f5f7]/80 dark:bg-white/5 border-[#e5e5ea]/80 dark:border-white/10",
    dot:   "bg-[#c7c7cc] dark:bg-[#48484a]",
  },
}

const labels = {
  low: "Low Load", medium: "Medium Load", high: "High Load", unknown: "Unknown",
}

export default function LoadBadge({
  level = "unknown",
  className = "",
  showDot = true,
  animate = false,
}) {
  const s = styles[level] || styles.unknown
  const label = labels[level] || "Unknown"

  return (
    <span
      className={`badge border ${s.badge} ${className}`}
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
