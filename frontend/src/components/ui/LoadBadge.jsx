/**
 * LoadBadge — Apple-style semantic pill, dark-mode safe.
 *
 * ROOT CAUSE OF WHITE BACKGROUND IN DARK MODE:
 * Tailwind JIT only generates arbitrary-opacity utilities like
 * `dark:bg-emerald-500/12` when they appear VERBATIM in scanned files.
 * If the class string is assembled at runtime or Tailwind misses the scan,
 * the class is missing from the CSS bundle → the dark: override never fires
 * → the light `bg-emerald-50/80` (near-white) shows through in dark mode.
 *
 * FIX: Use only standard Tailwind opacity fractions (/10, /20) which are
 * always in the generated CSS, OR use inline style for the dark variant via
 * a wrapper data-attribute approach.  Here we use the safelist-safe fractions.
 */

const styles = {
  low: {
    // Light: very pale green wash. Dark: 10% green tint, no white bleed.
    badge: [
      "text-emerald-700 dark:text-emerald-300",
      "bg-emerald-50    dark:bg-emerald-900/30",
      "border-emerald-200 dark:border-emerald-500/30",
    ].join(" "),
    dot: "bg-emerald-500",
  },
  medium: {
    badge: [
      "text-amber-700 dark:text-amber-300",
      "bg-amber-50    dark:bg-amber-900/30",
      "border-amber-200 dark:border-amber-500/30",
    ].join(" "),
    dot: "bg-amber-500",
  },
  high: {
    badge: [
      "text-red-700 dark:text-red-300",
      "bg-red-50    dark:bg-red-900/30",
      "border-red-200 dark:border-red-500/30",
    ].join(" "),
    dot: "bg-red-500",
  },
  unknown: {
    badge: [
      "text-[#6e6e73] dark:text-[#a1a1a6]",
      "bg-[#f5f5f7]   dark:bg-white/[0.06]",
      "border-[#e5e5ea] dark:border-white/10",
    ].join(" "),
    dot: "bg-[#c7c7cc] dark:bg-[#48484a]",
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
    <span className={`badge border ${s.badge} ${className}`}>
      {showDot && (
        <span className="relative flex w-1.5 h-1.5">
          {animate && level !== "unknown" && (
            <span
              className={`absolute inset-0 rounded-full ${s.dot} animate-ping opacity-70`}
            />
          )}
          <span className={`relative rounded-full w-1.5 h-1.5 ${s.dot}`} />
        </span>
      )}
      {label}
    </span>
  )
}