import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BrainCircuit, Activity, Zap, ShieldCheck, BarChart3, ArrowRight,
  Sparkles, Gauge, Target, Users,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"

const features = [
  { icon: Activity, title: "Real-time monitoring",
    desc: "Detects your cognitive load continuously from typing and mouse activity." },
  { icon: Zap, title: "Instant feedback",
    desc: "Live predictions with confidence scores so you always know your state." },
  { icon: BarChart3, title: "Deep analytics",
    desc: "Trends, distributions and feature importance to understand your patterns." },
  { icon: ShieldCheck, title: "Private by design",
    desc: "Your behavioral data stays yours. No third-party sharing, ever." },
]

const stats = [
  { icon: Gauge, value: "98%", label: "Model accuracy" },
  { icon: Target, value: "6s", label: "Refresh interval" },
  { icon: Users, value: "1.2k", label: "Active users" },
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
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">Cogni<span className="text-primary">Load</span></span>
          </div>
          <div className="flex items-center gap-3">
            {isAuth ? (
              <Link to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                  bg-primary text-white text-sm font-semibold hover:bg-primary-dark
                  shadow-lg shadow-primary/20 transition-colors">
                Go to dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                    hover:text-gray-900 dark:hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link to="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                    bg-primary text-white text-sm font-semibold hover:bg-primary-dark
                    shadow-lg shadow-primary/20 transition-colors">
                  Get started <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[500px] h-[500px] rounded-full
          bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-32 w-[500px] h-[500px] rounded-full
          bg-accent/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
              bg-primary/10 text-primary text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5" /> AI-powered cognitive load detection
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-5">
              Understand your{" "}
              <span className="text-gradient">cognitive load</span> in real time
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-lg">
              CogniLoad monitors your typing and mouse behavior to give you instant,
              privacy-preserving insights into your mental workload.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={isAuth ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                  bg-primary text-white font-semibold hover:bg-primary-dark
                  shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5">
                Start monitoring <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#features"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                  bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200
                  font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                Learn more
              </a>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t
              border-gray-100 dark:border-slate-800">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label}>
                  <Icon className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Hero visual */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:flex items-center justify-center">
            <div className="card w-full max-w-md p-8 animate-float">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-semibold">Live cognitive load</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                  bg-success/10 text-success text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
                </span>
              </div>
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-36 h-36">
                  <div className="absolute inset-0 rounded-full"
                    style={{ background: "conic-gradient(#2563EB 0 68%, rgba(148,163,184,0.15) 68% 100%)" }} />
                  <div className="absolute inset-3 rounded-full bg-white dark:bg-slate-900
                    flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">68%</span>
                    <span className="text-xs text-gray-400">Medium</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Confidence", value: 92 },
                  { label: "Typing WPM", value: 48 },
                  { label: "Focus level", value: 74 },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-20 border-t border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold mb-3">
              Everything you need to{" "}
              <span className="text-gradient">stay balanced</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Powerful, intuitive tools to monitor, understand and optimize your focus.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card p-6 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20
                  flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to understand your focus?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-lg mx-auto">
            Join CogniLoad today and start optimizing your cognitive performance.
          </p>
          <Link to={isAuth ? "/dashboard" : "/register"}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl
              bg-primary text-white font-semibold hover:bg-primary-dark
              shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5">
            {isAuth ? "Go to dashboard" : "Get started free"} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold">CogniLoad</span>
          </div>
          <p className="text-xs text-gray-400">
            © 2025 CogniLoad. Cognitive Load Detector.
          </p>
        </div>
      </footer>
    </div>
  )
}
