import { Loader2, Pause, Play, Square } from "lucide-react"
import { useTracking } from "../../context/TrackingContext"

/**
 * Session controls — refined pill-shaped buttons.
 * - Removed the chunky squared corners; uses the new pill aesthetic.
 * - Primary action: filled indigo gradient pill (Apple-style).
 * - Secondary actions: subtle glass pill with hairline border.
 * - Active/end states use restrained semantic colours.
 */
export default function TrackingControls() {
  const { trackingState, startTracking, pauseTracking, resumeTracking, endTracking } = useTracking()
  const busy = ["starting", "ending"].includes(trackingState)

  if (trackingState === "tracking") return (
    <div className="flex gap-2">
      <button onClick={pauseTracking}
        className="inline-flex items-center gap-1.5 rounded-full border
          border-amber-200 dark:border-amber-500/30
          bg-amber-50/80 dark:bg-amber-500/12
          px-3 py-1.5 text-[13px] font-semibold text-amber-700 dark:text-amber-300
          hover:bg-amber-100 dark:hover:bg-amber-500/20
          transition-colors duration-150">
        <Pause className="w-3.5 h-3.5" /> Pause
      </button>
      <button onClick={endTracking}
        className="inline-flex items-center gap-1.5 rounded-full border
          border-red-200 dark:border-red-500/30
          bg-red-50/80 dark:bg-red-500/12
          px-3 py-1.5 text-[13px] font-semibold text-red-700 dark:text-red-300
          hover:bg-red-100 dark:hover:bg-red-500/20
          transition-colors duration-150">
        <Square className="w-3.5 h-3.5" /> End
      </button>
    </div>
  )

  if (trackingState === "paused") return (
    <div className="flex gap-2">
      <button onClick={resumeTracking}
        className="btn-primary text-[13px] py-1.5">
        <Play className="w-3.5 h-3.5" /> Resume
      </button>
      <button onClick={endTracking}
        className="inline-flex items-center gap-1.5 rounded-full border
          border-red-200 dark:border-red-500/30
          bg-red-50/80 dark:bg-red-500/12
          px-3 py-1.5 text-[13px] font-semibold text-red-700 dark:text-red-300
          hover:bg-red-100 dark:hover:bg-red-500/20
          transition-colors duration-150">
        <Square className="w-3.5 h-3.5" /> End
      </button>
    </div>
  )

  if (trackingState === "ending") return (
    <button disabled
      className="btn-primary text-[13px] py-1.5 opacity-60 cursor-not-allowed">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ending…
    </button>
  )

  return (
    <button
      disabled={busy}
      onClick={startTracking}
      className="btn-primary text-[13px] py-1.5">
      {busy
        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</>
        : <><Play className="w-3.5 h-3.5" /> Start tracking</>}
    </button>
  )
}
