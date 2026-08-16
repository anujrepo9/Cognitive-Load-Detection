import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { TrackingProvider } from "./context/TrackingContext"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider } from "./components/ui/Toast"
import Sidebar from "./components/layout/Sidebar"
import TopNav from "./components/layout/TopNav"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import LiveMonitoring from "./pages/LiveMonitoring"
import History from "./pages/History"
import Analytics from "./pages/Analytics"
import Reports from "./pages/Reports"
import Recommendations from "./pages/Recommendations"
import Settings from "./pages/Settings"
import Profile from "./pages/Profile"
import TrackingConsentDialog from "./components/tracking/TrackingConsentDialog"

function ProtectedLayout() {
  const { isAuth } = useAuth()
  if (!isAuth) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <Outlet />
        </main>
        <TrackingConsentDialog />
      </div>
    </div>
  )
}

function GuestLayout() {
  const { isAuth } = useAuth()
  if (isAuth) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <TrackingProvider>
              {/* Skip-to-content link for keyboard users */}
              <a href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]
                  focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-xl
                  focus:shadow-lg focus:text-sm focus:font-semibold">
                Skip to main content
              </a>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<GuestLayout />}>
                  <Route path="/login"    element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>
                <Route element={<ProtectedLayout />}>
                  <Route path="/dashboard"       element={<Dashboard />} />
                  <Route path="/live"            element={<LiveMonitoring />} />
                  <Route path="/history"         element={<History />} />
                  <Route path="/analytics"       element={<Analytics />} />
                  <Route path="/reports"         element={<Reports />} />
                  <Route path="/recommendations" element={<Recommendations />} />
                  <Route path="/settings"        element={<Settings />} />
                  <Route path="/profile"         element={<Profile />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </TrackingProvider>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
