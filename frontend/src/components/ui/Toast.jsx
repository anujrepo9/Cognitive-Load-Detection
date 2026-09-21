import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"

const ToastContext = createContext(null)
let _id = 0
const nextId = () => ++_id

// Swiss: color only through text and left border, no colored backgrounds
const STYLES = {
  success: { icon: CheckCircle2, color: "text-[#16A34A]", border: "border-l-[#16A34A]" },
  error:   { icon: AlertCircle,  color: "text-[#DC2626]", border: "border-l-[#DC2626]"  },
  info:    { icon: Info,         color: "text-[#0066FF]", border: "border-l-[#0066FF]"  },
}

function ToastItem({ id, type, message, onRemove }) {
  const timer = useRef(null)
  const s = STYLES[type]

  const startTimer = useCallback(() => {
    timer.current = setTimeout(() => onRemove(id), 4000)
  }, [id, onRemove])

  const clearTimer = useCallback(() => clearTimeout(timer.current), [])

  useEffect(() => { startTimer(); return clearTimer }, [startTimer, clearTimer])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.15 }}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      role="status" aria-live="polite"
      className={`flex items-start gap-3
        bg-white dark:bg-[#111111]
        border border-[#E5E5E5] dark:border-[#222222]
        border-l-2 ${s.border}
        px-4 py-3 shadow-lg max-w-xs w-full pointer-events-auto`}
    >
      <s.icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.color}`} aria-hidden="true" />
      <p className="flex-1 text-[13px] text-gray-800 dark:text-gray-200">{message}</p>
      <button onClick={() => onRemove(id)} aria-label="Dismiss"
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const remove = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), [])
  const add = useCallback((type, message) => {
    const id = nextId()
    setToasts((p) => [...p.slice(-4), { id, type, message }])
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
      <div aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => <ToastItem key={t.id} {...t} onRemove={remove} />)}
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

export function Toaster() { return null }
