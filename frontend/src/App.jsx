import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Sidebar from "./components/layout/Sidebar"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import Analytics from "./pages/Analytics"
import Recommendations from "./pages/Recommendations"
import History from "./pages/History"
import Settings from "./pages/Settings"

function ProtectedLayout() {
  const { isAuth } = useAuth()
  if (!isAuth) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/analytics"       element={<Analytics />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/history"         element={<History />} />
            <Route path="/settings"        element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
