/**
 * Reusable toast/notification primitive.
 *
 * Usage:
 *   import { useToast, Toaster } from "./Toast"
 *   const { toast } = useToast()
 *   toast.success("Saved!")
 *   toast.error("Something went wrong")
 *   toast.info("Session started")
 *   <Toaster />   // mount once, near the root
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"

const ToastContext = createContext(null)

let _id = 0
const nextId = () => ++_id

const ICON = {
  success: <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-hidden="true" />,
  error:   <AlertCircle  className="w-5 h-5 text-danger  shrink-0" aria-hidden="true" />,
  info:    <Info         className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />,
}

const BG = {
  success: "border-success/30 bg-green-50  dark:bg-green-900/20",
  error:   "border-danger/30  bg-red-50    dark:bg-red-900/20",
  info:    "border-primary/30 bg-blue-50   dark:bg-blue-900/20",
}

const TEXT = {
  success: "text-green-800 dark:text-green-300",
  error:   "text-red-800   dark:text-red-300",
  info:    "text-blue-800  dark:text-blue-300",
}

function ToastItem({ id, type, message, onRemove }) {
  const timer = useRef(null)

  const startTimer = useCallback(() => {
    timer.current = setTimeout(() => onRemove(id), 4000)
  }, [id, onRemove])

  const clearTimer = useCallback(() => clearTimeout(timer.current), [])

  useEffect(() => { startTimer(); return clearTimer }, [startTimer, clearTimer])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg
        max-w-sm w-full pointer-events-auto ${BG[type]}`}
    >
      {ICON[type]}
      <p className={`flex-1 text-sm font-medium ${TEXT[type]}`}>{message}</p>
      <button onClick={() => onRemove(id)} aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback((type, message) => {
    const id = nextId()
    setToasts((prev) => [...prev.slice(-4), { id, type, message }])
    return id
  }, [])

  const toast = {
    success: (msg) => add("success", msg),
    error:   (msg) => add("error",   msg),
    info:    (msg) => add("info",    msg),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portal-like fixed overlay */}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onRemove={remove} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}

/** Convenience: mount Toaster anywhere — it uses the existing context. */
export function Toaster() { return null }
