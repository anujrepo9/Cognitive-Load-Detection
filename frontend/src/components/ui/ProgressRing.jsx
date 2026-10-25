/**
 * Cognitive Load Gauge — Cyberpunk HUD style
 * Large arc gauge with neon glow, tick marks, and ambient lighting
 */
export default function ProgressRing({
  value = 0,
  size = 240,
  strokeWidth = 12,
  color = "#00D9E8",
  trackColor = "rgba(100, 170, 190, 0.10)",
  label, sublabel,
  loadLevel = "unknown",
  showTicks = true,
  glowColor,
}) {
  const clamped = Math.max(0, Math.min(100, value || 0))
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (clamped / 100) * circ
  const glow = glowColor || color

  // 36 tick marks (every 10°), starting at 12 o'clock
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const angle = (i * 10 - 90) * (Math.PI / 180)
    const outer = size / 2
    const tickLen = i % 9 === 0 ? 8 : 4
    const inner = outer - strokeWidth - 4 - tickLen
    return {
      x1: outer + inner * Math.cos(angle),
      y1: outer + inner * Math.sin(angle),
      x2: outer + (outer - strokeWidth - 4) * Math.cos(angle),
      y2: outer + (outer - strokeWidth - 4) * Math.sin(angle),
      active: (i / 36) * 100 <= clamped,
      major:  i % 9 === 0,
    }
  })

  const gradId = `gauge-grad-${Math.round(size)}-${color.replace("#", "")}`
  const shadowId = `gauge-shadow-${Math.round(size)}`

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Confidence ${clamped} percent, ${loadLevel} load`}>

      {/* Ambient glow */}
      <div aria-hidden="true" className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${glow}22 0%, transparent 70%)`,
          filter: "blur(20px)",
          animation: "gauge-pulse 2.4s ease-in-out infinite",
        }} />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={glow} stopOpacity="0.7" />
          </linearGradient>
          <filter id={shadowId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0`} result="shadow" />
            <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
          filter={`url(#${shadowId})`}
        />

        {/* Tick marks */}
        {showTicks && ticks.map((t, i) => (
          <line key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.active ? color : "rgba(100,170,190,0.15)"}
            strokeWidth={t.major ? 2 : 1}
            strokeLinecap="round"
            opacity={t.active ? (t.major ? 1 : 0.7) : 0.4}
          />
        ))}

        {/* Glowing dot at arc tip */}
        {clamped > 2 && (() => {
          const angle = ((clamped / 100) * 360 - 90) * (Math.PI / 180)
          const cx = size / 2 + r * Math.cos(angle)
          const cy = size / 2 + r * Math.sin(angle)
          return (
            <circle cx={cx} cy={cy} r={strokeWidth / 2 + 1} fill={color}
              style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          )
        })()}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        {label && (
          <p className="text-[2rem] font-bold leading-none nums"
            style={{
              color: "#EAF2F8",
              textShadow: `0 0 20px ${glow}66`,
              fontFamily: "'Space Grotesk', 'Inter', system-ui",
            }}>
            {label}
          </p>
        )}
        {sublabel && (
          <p className="text-[11px] font-semibold tracking-[0.10em] uppercase mt-1"
            style={{ color: glow }}>
            {sublabel}
          </p>
        )}
      </div>
    </div>
  )
}
