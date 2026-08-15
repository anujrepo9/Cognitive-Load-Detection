import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BrainCircuit, Activity, Zap, ShieldCheck, BarChart3, ArrowRight,
  Gauge, Target,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"

const features = [
  { icon: Activity,   title: "Real-time monitoring",
    desc: "Detects cognitive load continuously using keyboard timing and mouse movement patterns." },
  { icon: Zap,        title: "Instant predictions",
    desc: "Live load-level predictions with confidence scores, delivered over WebSocket." },
  { icon: BarChart3,  title: "Deep analytics",
    desc: "Trends, load distributions, and per-feature statistics across your sessions." },
  { icon: ShieldCheck, title: "Private by design",
    desc: "Only aggregate timing metrics are collected — typed text and key content are never stored." },
]

const stats = [
  { icon: Gauge,  value: "~99%",  label: "Model accuracy on training data" },
  { icon: Target, value: "5 s",   label: "Default prediction interval"     },
]

export default function Landing() {
  const { isAuth } = useAuth()

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl
        border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent
              flex items-center justify-center shadow-glow-primary">
              <BrainCircuit className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold">Cogni<span className="text-primary">Load</span></span>
          </div>
          <div className="flex items-center gap-3">
            {isAuth ? (
              <Link to="/dashboard"
                className="btn-primary">
                Go to dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                    hover:text-gray-900 dark:hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link to="/register"
                  className="btn-primary">
                  Get started <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[500px] h-[500px] rounded-full
          bg-primary/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-40 -right-32 w-[500px] h-[500px] rounded-full
          bg-accent/10 blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="max-w-7xl mx-auto px-4 py-24 lg:py-32 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
              bg-primary/10 text-primary text-xs font-semibold mb-5">
              <Zap className="w-3.5 h-3.5" aria-hidden="true" /> ML-powered cognitive load detection
            </span>
            <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight text-gray-900 dark:text-white">
              Understand your{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                mental workload
              </span>{" "}
              in real time
            </h1>
            <p className="mt-6 text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
              CogniLoad analyses keyboard and mouse interaction patterns to estimate
              how cognitively demanding your current task is — without reading any content you type.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to={isAuth ? "/dashboard" : "/register"}
                className="btn-primary px-6 py-3 text-base">
                {isAuth ? "Open dashboard" : "Get started free"}{" "}
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
              {!isAuth && (
                <Link to="/login"
                  className="btn-secondary px-6 py-3 text-base">
                  Sign in
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-wrap justify-center gap-12">
          {stats.map(({ icon: Icon, value, label }) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">How it works</h2>
            <p className="mt-3 text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              A lightweight background tracker sends aggregate timing metrics to the backend,
              where a trained Random Forest model predicts your current cognitive load level.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}
                className="card p-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center
                  justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary to-accent">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to monitor your focus?</h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">
            Create a free account and start your first monitoring session in under a minute.
          </p>
          <Link to={isAuth ? "/dashboard" : "/register"}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl
              bg-white text-primary font-semibold hover:bg-gray-50 transition-colors shadow-lg">
            {isAuth ? "Open dashboard" : "Get started"}{" "}
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100 dark:border-slate-800 text-center
        text-xs text-gray-400">
        CogniLoad — cognitive load detection platform. All behavioral data stays on your device until you
        explicitly start a session.
      </footer>
    </div>
  )
}
