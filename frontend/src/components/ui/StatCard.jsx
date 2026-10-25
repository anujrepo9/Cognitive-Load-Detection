import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"

const accentConfig = {
  primary: { iconBg: "rgba(0,217,232,0.10)", iconColor: "#00D9E8", iconBorder: "rgba(0,217,232,0.20)", glowColor: "rgba(0,217,232,0.08)" },
  accent:  { iconBg: "rgba(119,117,255,0.10)", iconColor: "#7775FF", iconBorder: "rgba(119,117,255,0.20)", glowColor: "rgba(119,117,255,0.08)" },
  success: { iconBg: "rgba(55,217,160,0.10)", iconColor: "#37D9A0", iconBorder: "rgba(55,217,160,0.20)", glowColor: "rgba(55,217,160,0.08)" },
  warning: { iconBg: "rgba(255,181,71,0.10)", iconColor: "#FFB547", iconBorder: "rgba(255,181,71,0.20)", glowColor: "rgba(255,181,71,0.08)" },
  danger:  { iconBg: "rgba(255,83,100,0.10)", iconColor: "#FF5364", iconBorder: "rgba(255,83,100,0.20)", glowColor: "rgba(255,83,100,0.08)" },
}

export default function StatCard({
  label, value, unit = "", sub, icon: Icon, accent = "primary",
  trend, delta, chart, delay = 0, className = "",
}) {
  const cfg = accentConfig[accent] || accentConfig.primary

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden group rounded-xl p-5 ${className}`}
      style={{
        background: "#0B1420",
        border: "1px solid rgba(100,170,190,0.14)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(0,217,232,0.22)"
        e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.4), 0 0 16px ${cfg.glowColor}`
        e.currentTarget.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(100,170,190,0.14)"
        e.currentTarget.style.boxShadow = ""
        e.currentTarget.style.transform = ""
      }}>

      {/* Left accent bar */}
      <span aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: cfg.iconColor, boxShadow: `0 0 8px ${cfg.iconColor}` }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.10em] uppercase mb-3"
            style={{ color: "#536477" }}>
            {label}
          </p>
          <p className="text-[1.75rem] font-bold tracking-[-0.022em] leading-none nums"
            style={{ color: "#EAF2F8" }}>
            {value}
            {unit && (
              <span className="ml-1 text-[0.875rem] font-medium" style={{ color: "#8493A7" }}>{unit}</span>
            )}
          </p>
        </div>
        {Icon && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.06]"
            style={{ background: cfg.iconBg, border: `1px solid ${cfg.iconBorder}` }}>
            <Icon className="w-[18px] h-[18px]" style={{ color: cfg.iconColor }} aria-hidden="true" />
          </div>
        )}
      </div>

      {(sub || trend != null) && (
        <div className="flex items-center gap-2 mt-3">
          {trend != null && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
              style={trend >= 0
                ? { background: "rgba(55,217,160,0.12)", color: "#37D9A0", border: "1px solid rgba(55,217,160,0.20)" }
                : { background: "rgba(255,83,100,0.12)", color: "#FF5364", border: "1px solid rgba(255,83,100,0.20)" }}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub && (
            <span className="text-[11px] truncate" style={{ color: "#8493A7" }}>{sub}</span>
          )}
        </div>
      )}

      {delta != null && (
        <p className="text-[11px] mt-1 nums" style={{ color: "#8493A7" }}>
          {delta >= 0 ? "+" : ""}{delta} vs last period
        </p>
      )}

      {chart}
    </motion.div>
  )
}
