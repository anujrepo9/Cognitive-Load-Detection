export function PageHeader({ title, description, action, actions, badge }) {
  const slot = actions ?? action   // support both spellings
  return (
    <div className="page-header flex items-start justify-between gap-4">
      <div>
        {badge && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.10em] uppercase mb-2"
            style={{ color: "#536477" }}>
            <span className="live-dot w-1.5 h-1.5 rounded-full" style={{ background: "#00D9E8" }} />
            {badge}
          </span>
        )}
        <h1 style={{ color: "#EAF2F8" }}>{title}</h1>
        {description && (
          <p className="mt-1 text-sm" style={{ color: "#8493A7" }}>{description}</p>
        )}
      </div>
      {slot && <div className="shrink-0">{slot}</div>}
    </div>
  )
}