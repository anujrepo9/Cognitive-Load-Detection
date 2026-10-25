import { motion } from "framer-motion"

const toneConfig = {
  primary: { bg: "rgba(0,217,232,0.10)",   color: "#00D9E8", border: "rgba(0,217,232,0.20)" },
  accent:  { bg: "rgba(119,117,255,0.10)", color: "#7775FF", border: "rgba(119,117,255,0.20)" },
  success: { bg: "rgba(55,217,160,0.10)",  color: "#37D9A0", border: "rgba(55,217,160,0.20)" },
  warning: { bg: "rgba(255,181,71,0.10)",  color: "#FFB547", border: "rgba(255,181,71,0.20)" },
  danger:  { bg: "rgba(255,83,100,0.10)",  color: "#FF5364", border: "rgba(255,83,100,0.20)" },
}

export default function ChartCard({ title, subtitle, icon: Icon, iconTone = "primary", action, children, className = "" }) {
  const cfg = toneConfig[iconTone] || toneConfig.primary
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-xl p-5 ${className}`}
      style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <Icon className="w-[18px] h-[18px]" style={{ color: cfg.color }} aria-hidden="true" />
            </div>
          )}
          <div>
            <h3 className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>{title}</h3>
            {subtitle && <p className="text-[11px] mt-0.5" style={{ color: "#8493A7" }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  )
}
