import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BrainCircuit, Activity, Zap, ShieldCheck, BarChart3, ArrowRight,
  Gauge, Target, Sparkles, MousePointerClick, Keyboard, TrendingUp,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"

const features = [
  {
    icon: Activity,
    title: "Real-time monitoring",
    desc: "Detects cognitive load continuously using keyboard timing and mouse movement patterns, with no content access.",
    color: "from-indigo-500 to-violet-500",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    iconColor: "text-indigo-500",
  },
  {
    icon: Zap,
    title: "Instant predictions",
    desc: "Live load-level predictions with confidence scores delivered over WebSocket — under 5 seconds latency.",
    color: "from-violet-500 to-purple-500",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    icon: BarChart3,
    title: "Deep analytics",
    desc: "Trends, load distributions, and per-feature statistics across all your sessions and time periods.",
    color: "from-blue-500 to-indigo-500",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    desc: "Only aggregate timing metrics are collected — typed text and key content are never stored or transmitted.",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
]

const metrics = [
  { icon: Gauge,           value: "~99%", label: "Model accuracy", color: "text-indigo-500" },
  { icon: Target,          value: "5s",   label: "Prediction interval", color: "text-violet-500" },
  { icon: MousePointerClick, value: "0%", label: "Content recorded", color: "text-emerald-500" },
  { icon: TrendingUp,      value: "Live", label: "WebSocket updates", color: "text-blue-500" },
]

export default function Landing() {
  const { isAuth } = useAuth()

  return (
    <div className="min-h-screen bg-white dark:bg-[#080b14] text-gray-900 dark:text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-[#080b14]/80 backdrop-blur-xl
        border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
              flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <BrainCircuit className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold">
              Cogni<span className="text-indigo-500">Load</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAuth ? (
              <Link to="/dashboard" className="btn-primary">
                Open dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                    hover:text-gray-900 dark:hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary">
                  Get started <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 lg:pt-28 lg:pb-32">
        {/* Mesh bg */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px]
            bg-gradient-radial from-indigo-500/15 via-transparent to-transparent blur-3xl" />
          <div className="absolute top-32 right-0 w-96 h-96 rounded-full
            bg-violet-500/8 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full
            bg-indigo-500/6 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center max-w-3xl mx-auto">

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
              bg-indigo-50 dark:bg-indigo-500/10
              border border-indigo-100 dark:border-indigo-500/20
              text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              ML-powered cognitive load detection
            </span>

            <h1 className="text-5xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight text-gray-900 dark:text-white mb-6">
              Understand your{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                mental workload
              </span>
              {" "}in real time
            </h1>

            <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed max-w-xl mx-auto mb-10">
              CogniLoad analyses keyboard and mouse interaction patterns to estimate how cognitively demanding
              your current task is — without ever reading what you type.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to={isAuth ? "/dashboard" : "/register"}
                className="btn-primary px-7 py-3.5 text-base shadow-lg shadow-indigo-500/25">
                {isAuth ? "Open dashboard" : "Start for free"}{" "}
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
              {!isAuth && (
                <Link to="/login" className="btn-secondary px-7 py-3.5 text-base">
                  Sign in
                </Link>
              )}
            </div>
          </motion.div>

          {/* Metrics row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {metrics.map(({ icon: Icon, value, label, color }) => (
              <div key={label}
                className="card p-5 text-center hover:border-indigo-200 dark:hover:border-indigo-700
                  hover:shadow-md transition-all duration-200">
                <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50 dark:bg-[#0d1117]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need to work smarter
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
              Built for knowledge workers who want insight without surveillance.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, desc, bg, iconColor }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="card p-6 hover:border-indigo-200 dark:hover:border-indigo-700
                  hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 group">
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4
                  group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="relative inline-block w-full max-w-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl blur-xl opacity-20" />
            <div className="relative card p-10 border-indigo-100 dark:border-indigo-500/20">
              <BrainCircuit className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Ready to understand your mind?
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-7 max-w-sm mx-auto text-sm">
                Free to start. No credit card required. Your data is always private.
              </p>
              <Link to={isAuth ? "/dashboard" : "/register"}
                className="btn-primary px-8 py-3 text-base shadow-lg shadow-indigo-500/25 inline-flex">
                {isAuth ? "Go to dashboard" : "Get started free"}{" "}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600
              flex items-center justify-center">
              <BrainCircuit className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Cogni<span className="text-indigo-500">Load</span>
            </span>
          </div>
          <p className="text-xs text-gray-400">Privacy-first cognitive monitoring.</p>
        </div>
      </footer>
    </div>
  )
}
