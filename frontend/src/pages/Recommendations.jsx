import { useState, useEffect } from "react"
import { dashboardAPI } from "../services/api"

const icons = {
  break:       "☕",
  water:       "💧",
  focus:       "🎯",
  font:        "🔤",
  notify:      "🔕",
  simplify:    "✂️",
  difficulty:  "📉",
}

export default function Recommendations() {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardAPI.recommendation()
      .then(({ data }) => setRecs(data.recommendations || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Recommendations</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Personalized suggestions based on your cognitive load
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : recs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">
            No recommendations yet — keep using the app so the model can learn your patterns.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {recs.map((rec, i) => (
            <div key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex gap-4">
              <span className="text-2xl">{icons[rec.type] || "💡"}</span>
              <div>
                <p className="text-sm font-medium text-gray-200">{rec.title}</p>
                <p className="text-xs text-gray-500 mt-1">{rec.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
