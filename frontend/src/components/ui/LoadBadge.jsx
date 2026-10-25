const styles = {
  low:     { bg: "rgba(55,217,160,0.10)",  border: "rgba(55,217,160,0.25)",  color: "#37D9A0", dot: "#37D9A0" },
  medium:  { bg: "rgba(255,181,71,0.10)",  border: "rgba(255,181,71,0.25)",  color: "#FFB547", dot: "#FFB547" },
  high:    { bg: "rgba(255,83,100,0.10)",  border: "rgba(255,83,100,0.25)",  color: "#FF5364", dot: "#FF5364" },
  unknown: { bg: "rgba(132,147,167,0.08)", border: "rgba(132,147,167,0.15)", color: "#8493A7", dot: "#536477" },
}
const labels = { low: "Low Load", medium: "Medium Load", high: "High Load", unknown: "Unknown" }

export default function LoadBadge({ level = "unknown", className = "", showDot = true, animate = false }) {
  const s = styles[level] || styles.unknown
  const label = labels[level] || "Unknown"
  return (
    <span className={`badge ${className}`}
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {showDot && (
        <span className="relative flex w-1.5 h-1.5">
          {animate && level !== "unknown" && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-70"
              style={{ background: s.dot }} />
          )}
          <span className="relative rounded-full w-1.5 h-1.5" style={{ background: s.dot }} />
        </span>
      )}
      {label}
    </span>
  )
}
