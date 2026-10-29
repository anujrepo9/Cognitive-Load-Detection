/**
 * PageHeader — shared page title block.
 *
 * Props (all optional except title):
 *   title       {string}          — main heading
 *   description {string}          — sub-text (original prop, kept for back-compat)
 *   subtitle    {string}          — alias for description
 *   icon        {LucideComponent} — icon shown left of title
 *   badge       {string}          — small live-dot label above title
 *   action      {ReactNode}       — right-side slot (single)
 *   actions     {ReactNode}       — right-side slot (alias)
 */
export function PageHeader({ title, description, subtitle, icon: Icon, action, actions, badge }) {
  const slot = actions ?? action
  const sub  = subtitle ?? description

  return (
    <div className="page-header flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(0,217,232,0.08)",
              border:     "1px solid rgba(0,217,232,0.18)",
            }}
          >
            <Icon className="w-4 h-4" style={{ color: "#00D9E8" }} aria-hidden="true" />
          </div>
        )}

        <div>
          {badge && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.10em] uppercase mb-1"
              style={{ color: "#536477" }}
            >
              <span
                className="live-dot w-1.5 h-1.5 rounded-full"
                style={{ background: "#00D9E8" }}
              />
              {badge}
            </span>
          )}
          <h1 style={{ color: "#EAF2F8" }}>{title}</h1>
          {sub && (
            <p className="mt-0.5 text-sm" style={{ color: "#8493A7" }}>
              {sub}
            </p>
          )}
        </div>
      </div>

      {slot && <div className="shrink-0">{slot}</div>}
    </div>
  )
}

export default PageHeader