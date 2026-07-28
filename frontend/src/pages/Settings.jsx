import { useState } from "react"

export default function Settings() {
  const [tracking, setTracking] = useState(true)
  const [interval, setInterval_] = useState(5)
  const [saved, setSaved] = useState(false)

  const save = () => {
    localStorage.setItem("settings", JSON.stringify({ tracking, interval }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-lg space-y-6">
      <h2 className="text-xl font-semibold text-gray-100">Settings</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
        {/* Tracking toggle */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">Behavior tracking</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Keyboard and mouse event collection
            </p>
          </div>
          <button
            onClick={() => setTracking(!tracking)}
            className={`w-11 h-6 rounded-full transition-colors relative
              ${tracking ? "bg-brand" : "bg-gray-700"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
              transition-transform ${tracking ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* Prediction interval */}
        <div className="px-5 py-4">
          <p className="text-sm font-medium text-gray-200 mb-3">
            Prediction interval
          </p>
          <div className="flex gap-2">
            {[5, 10, 15, 30].map((s) => (
              <button
                key={s}
                onClick={() => setInterval_(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                  ${interval === s
                    ? "bg-brand text-white"
                    : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={save}
        className="bg-brand hover:bg-brand-dark text-white text-sm font-medium
          px-5 py-2 rounded-lg transition-colors"
      >
        {saved ? "Saved ✓" : "Save settings"}
      </button>
    </div>
  )
}
