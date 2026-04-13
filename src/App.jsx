import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Agenda from './pages/Agenda'
import JoinProject from './pages/JoinProject'
import ProfileSettings from './pages/ProfileSettings'
import Habits from './pages/Habits'
import ReportMaker from './pages/ReportMaker'
import Plans from './pages/Plans'
import PlanEditor from './pages/PlanEditor'
import PlanPublicView from './pages/PlanPublicView'
import { useTheme } from './hooks/useTheme'
import { useDeadlineNotifications } from './hooks/useDeadlineNotifications'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    )
  }

  return user ? children : <Navigate to="/auth" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    )
  }

  return user ? <Navigate to="/" replace /> : children
}

function AppContent() {
  useTheme()
  useDeadlineNotifications()

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#f5f5f7',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
            fontSize: '13px',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          },
          success: {
            iconTheme: { primary: '#30d158', secondary: '#1a1a1a' },
          },
          error: {
            iconTheme: { primary: '#ff453a', secondary: '#1a1a1a' },
          },
        }}
      />
      <Routes>
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id"
          element={
            <ProtectedRoute>
              <ProjectDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agenda"
          element={
            <ProtectedRoute>
              <Agenda />
            </ProtectedRoute>
          }
        />
        <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportMaker /></ProtectedRoute>} />
        <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
        <Route path="/plans/:id" element={<ProtectedRoute><PlanEditor /></ProtectedRoute>} />
        <Route path="/join" element={<JoinProject />} />
        <Route path="/plans/:token/view" element={<PlanPublicView />} />
        <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}
