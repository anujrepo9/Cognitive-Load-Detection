export default function ProgressRing({ value = 0, size = 80, strokeWidth = 7, color = "#6366f1", bg = "#e0e7ff", label }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={bg} strokeWidth={strokeWidth} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {label !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label}
        </div>
      )}
    </div>
  )
}
