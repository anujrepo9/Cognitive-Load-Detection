/**
 * Cognitive Load Gauge — the focal point of the dashboard.
 *
 * Design: a single, large, refined arc gauge with:
 *   • A subtle radial glow behind it that shifts colour with the load level.
 *   • A hairline background track (almost invisible).
 *   • A bold confidence arc with a soft gradient stroke + drop-shadow glow.
 *   • 36 tick marks around the perimeter (every 10°) — gives a "watch face"
 *     feel without being decorative noise. Active ticks are filled, inactive
 *     are hairlines.
 *   • Centered display: large percent number + tiny label.
 *
 * The gauge reads as the main hero element of the dashboard rather than a
 * generic ring stuck in a card.
 *
 * Accessibility: the same value is also surfaced as an `aria-label` on the
 * root element so screen readers announce "Confidence 78 percent, Medium load".
 */
export default function ProgressRing({
  value = 0,                       // 0-100 confidence
  size = 240,
  strokeWidth = 14,
  color = "#6366f1",
  trackColor = "rgba(120, 120, 128, 0.16)",
  label, sublabel,
  loadLevel = "unknown",          // "low" | "medium" | "high" | "unknown"
  showTicks = true,
  glowColor,                       // optional override; defaults to `color`
}) {
  // Clamp 0-100
  const clamped = Math.max(0, Math.min(100, value || 0))
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  // Start at top (12 o'clock) — rotate -90°
  const offset = circ - (clamped / 100) * circ
  const glow = glowColor || color

  // Generate 36 tick marks (every 10°). Tick #0 is at the top, going clockwise.
  // Active ticks (those below the current value) are emphasized.
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const angle = (i * 10 - 90) * (Math.PI / 180)  // start at top
    const outer = size / 2
    const inner = outer - 6
    const tickInner = i % 9 === 0 ? inner - 6 : inner   // longer every 90°
    return {
      x1: outer + tickInner * Math.cos(angle),
      y1: outer + tickInner * Math.sin(angle),
      x2: outer + outer * Math.cos(angle),
      y2: outer + outer * Math.sin(angle),
      active: (i / 36) * 100 <= clamped,
      major:  i % 9 === 0,
    }
  })

  // Unique gradient ID per instance so multiple gauges don't collide
  const gradId = `gauge-grad-${Math.round(size)}-${color.replace("#", "")}`

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence ${clamped} percent${
        loadLevel && loadLevel !== "unknown" ? `, ${loadLevel} load` : ""
      }`}
      style={{ width: size, height: size }}
    >
      {/* Radial glow behind the gauge — shifts with the active load colour */}
      <div
        aria-hidden="true"
        className="gauge-glow"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          left:  "50%",
          top:   "50%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle at 50% 50%, ${glow} 0%, transparent 70%)`,
          opacity: clamped > 0 ? 0.5 : 0.15,
        }}
      />

      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", position: "relative", zIndex: 1 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={glow}   stopOpacity={0.85} />
          </linearGradient>
          <filter id={`soft-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track — hairline, almost invisible */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />

        {/* Confidence arc — gradient stroke with soft glow */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter={`url(#soft-${gradId})`}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />

        {/* Tick marks — perimeter "watch face" */}
        {showTicks && ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.active ? color : "rgba(120, 120, 128, 0.22)"}
            strokeWidth={t.major ? 1.4 : 1}
            strokeLinecap="round"
            style={{
              transition: "stroke 0.4s ease",
              opacity: t.active ? (t.major ? 0.85 : 0.55) : 0.5,
            }}
          />
        ))}
      </svg>

      {/* Centered label */}
      {label !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {label}
        </div>
      )}
      {sublabel !== undefined && sublabel}
    </div>
  )
}
