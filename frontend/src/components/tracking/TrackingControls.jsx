import { Pause, Play, Square } from "lucide-react"
import { useTracking } from "../../context/TrackingContext"

export default function TrackingControls() {
  const { trackingState, startTracking, pauseTracking, resumeTracking, endTracking } = useTracking()
  const busy = ["starting", "ending"].includes(trackingState)
  if (trackingState === "tracking") return <div className="flex gap-2"><button onClick={pauseTracking} className="inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning"><Pause className="w-4 h-4" /> Pause</button><button onClick={endTracking} className="inline-flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"><Square className="w-4 h-4" /> End</button></div>
  if (trackingState === "paused") return <div className="flex gap-2"><button onClick={resumeTracking} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white"><Play className="w-4 h-4" /> Resume</button><button onClick={endTracking} className="inline-flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"><Square className="w-4 h-4" /> End</button></div>
  return <button disabled={busy} onClick={startTracking} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Play className="w-4 h-4" /> {busy ? "Starting…" : "Start tracking"}</button>
}
