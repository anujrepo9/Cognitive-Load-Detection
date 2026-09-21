const styles = {
  low:     { badge: "text-[#16A34A] bg-[#16A34A]/8 border-[#16A34A]/20", dot: "bg-[#16A34A]" },
  medium:  { badge: "text-[#CA8A04] bg-[#CA8A04]/8 border-[#CA8A04]/20", dot: "bg-[#CA8A04]" },
  high:    { badge: "text-[#DC2626] bg-[#DC2626]/8 border-[#DC2626]/20", dot: "bg-[#DC2626]" },
  unknown: { badge: "text-gray-400 bg-gray-100 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A]", dot: "bg-gray-300" },
}

export default function LoadBadge({ level = "unknown", className = "", showDot = true }) {
  const s = styles[level] || styles.unknown
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1
        text-[11px] font-semibold tracking-wide uppercase border ${s.badge} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 ${s.dot}`} />}
      {level.charAt(0).toUpperCase() + level.slice(1)} load
    </span>
  )
}
