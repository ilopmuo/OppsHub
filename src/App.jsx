import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import { useTheme } from './hooks/useTheme'
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

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1b263b',
            color: '#e0e1dd',
            border: '1px solid rgba(65,90,119,0.5)',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 8px 32px rgba(13,27,42,0.6)',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#1b263b' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#1b263b' },
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
