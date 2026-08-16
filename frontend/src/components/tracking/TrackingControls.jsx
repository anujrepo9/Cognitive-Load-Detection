import { Loader2, Pause, Play, Square } from "lucide-react"
import { useTracking } from "../../context/TrackingContext"

export default function TrackingControls() {
  const { trackingState, startTracking, pauseTracking, resumeTracking, endTracking } = useTracking()
  const busy = ["starting", "ending"].includes(trackingState)

  if (trackingState === "tracking") return (
    <div className="flex gap-2">
      <button
        onClick={pauseTracking}
        className="inline-flex items-center gap-2 rounded-xl border border-warning/30
          bg-warning/10 px-3 py-2 text-sm font-semibold text-warning
          hover:bg-warning/20 transition-colors">
        <Pause className="w-4 h-4" /> Pause
      </button>
      <button
        onClick={endTracking}
        className="inline-flex items-center gap-2 rounded-xl border border-danger/30
          bg-danger/10 px-3 py-2 text-sm font-semibold text-danger
          hover:bg-danger/20 transition-colors">
        <Square className="w-4 h-4" /> End
      </button>
    </div>
  )

  if (trackingState === "paused") return (
    <div className="flex gap-2">
      <button
        onClick={resumeTracking}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2
          text-sm font-semibold text-white hover:bg-primary-light transition-colors">
        <Play className="w-4 h-4" /> Resume
      </button>
      <button
        onClick={endTracking}
        className="inline-flex items-center gap-2 rounded-xl border border-danger/30
          bg-danger/10 px-3 py-2 text-sm font-semibold text-danger
          hover:bg-danger/20 transition-colors">
        <Square className="w-4 h-4" /> End
      </button>
    </div>
  )

  if (trackingState === "ending") return (
    <button disabled className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5
      text-sm font-semibold text-white opacity-60 cursor-not-allowed">
      <Loader2 className="w-4 h-4 animate-spin" /> Ending…
    </button>
  )

  return (
    <button
      disabled={busy}
      onClick={startTracking}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5
        text-sm font-semibold text-white hover:bg-primary-light transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed">
      {busy
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
        : <><Play className="w-4 h-4" /> Start tracking</>}
    </button>
  )
}
