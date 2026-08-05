import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, User, Shield, Save, Camera } from "lucide-react"
import { useAuth } from "../context/AuthContext"

export default function Profile() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [saved, setSaved] = useState(false)

  const handleSave = (e) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage your personal information
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="card p-6 text-center">
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent
              flex items-center justify-center text-white text-3xl font-bold shadow-glow-primary">
              {(name[0] || "U").toUpperCase()}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full
              bg-primary text-white flex items-center justify-center border-2
              border-white dark:border-slate-900 hover:bg-primary-dark transition-colors">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{name || "User"}</h2>
          <p className="text-sm text-gray-400">{email}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full
            bg-success/10 text-success text-xs font-medium">
            <Shield className="w-3.5 h-3.5" /> Pro member
          </div>
        </motion.div>

        {/* Edit form */}
        <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} onSubmit={handleSave} className="lg:col-span-2 card p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5">
            Personal information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="input pl-9" placeholder="Your name" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9" placeholder="you@example.com" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-5 border-t border-gray-100
            dark:border-slate-800">
            <p className="text-xs text-gray-400">
              Member since {new Date().toLocaleDateString()}
            </p>
            <div className="flex items-center gap-3">
              {saved && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm text-success">✓ Saved</motion.span>
              )}
              <button type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                  bg-primary text-white text-sm font-semibold hover:bg-primary-dark
                  shadow-lg shadow-primary/20 transition-colors">
                <Save className="w-4 h-4" /> Save changes
              </button>
            </div>
          </div>
        </motion.form>
      </div>
    </div>
  )
}
