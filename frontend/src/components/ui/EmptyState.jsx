import { Inbox } from "lucide-react"

export default function EmptyState({ icon: Icon = Inbox, title = "No data yet", description = "", action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(0,217,232,0.08)", border: "1px solid rgba(0,217,232,0.15)" }}>
        <Icon className="w-6 h-6" style={{ color: "#00D9E8" }} aria-hidden="true" />
      </div>
      <p className="text-base font-semibold mb-1" style={{ color: "#EAF2F8" }}>{title}</p>
      {description && (
        <p className="text-sm max-w-xs" style={{ color: "#8493A7" }}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
