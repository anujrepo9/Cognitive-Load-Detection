/**
 * Reusable table primitive.
 *
 * Usage:
 *   <Table columns={columns} rows={rows} keyField="id" loading={loading} />
 *
 * columns: [{ key, label, render?, tip?, className? }]
 * rows: array of objects
 */
import { Loader2 } from "lucide-react"
import EmptyState from "./EmptyState"

export function Table({ columns = [], rows = [], keyField = "id", loading = false, emptyIcon, emptyTitle, emptyDesc }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
            {columns.map(({ key, label, tip, className = "" }) => (
              <th key={key} scope="col"
                className={`text-left px-5 py-3 text-xs font-medium uppercase
                  tracking-wider text-gray-500 ${className}`}
                title={tip}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" aria-label="Loading" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {emptyTitle
                  ? <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} />
                  : <p className="text-center text-sm text-gray-400 py-12">No data.</p>}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row[keyField] ?? i}
                className="border-b border-gray-50 dark:border-slate-800/50
                  hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                {columns.map(({ key, render, className = "" }) => (
                  <td key={key} className={`px-5 py-3 ${className}`}>
                    {render ? render(row[key], row) : row[key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default Table
