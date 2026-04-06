import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, LogOut } from 'lucide-react'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'

const STATUS_ORDER = { blocked: 0, at_risk: 1, on_track: 2 }

const C = {
  bg: '#0d1b2a',
  surface: '#1b263b',
  border: '#415a77',
  muted: '#778da9',
  text: '#e0e1dd',
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*, tasks(id, title, done, priority, due_date)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Error al cargar proyectos')
    } else {
      setProjects(
        (data || []).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      )
    }
    setLoading(false)
  }

  function onProjectCreated(project) {
    setProjects(prev =>
      [{ ...project, tasks: [] }, ...prev].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      )
    )
    setShowModal(false)
  }

  const blocked = projects.filter(p => p.status === 'blocked').length
  const atRisk = projects.filter(p => p.status === 'at_risk').length

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 backdrop-blur-md"
        style={{ backgroundColor: `${C.surface}cc`, borderBottom: `1px solid ${C.border}30` }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: C.border }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="font-semibold text-base tracking-tight" style={{ color: C.text }}>OpsHub</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span
              className="text-xs hidden sm:block px-3 py-1.5 rounded-lg"
              style={{ color: C.muted, backgroundColor: `${C.surface}`, border: `1px solid ${C.border}30` }}
            >
              {user?.email}
            </span>
            <button
              onClick={async () => { await supabase.auth.signOut(); toast.success('Sesión cerrada') }}
              className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg transition-all"
              style={{ color: C.muted, border: `1px solid ${C.border}30` }}
              onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border }}
              onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = `${C.border}30` }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: C.border }}>
              Dashboard
            </p>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.text }}>
              Proyectos activos
            </h1>

            {/* Status summary pills */}
            {projects.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: `${C.surface}`, color: C.muted, border: `1px solid ${C.border}30` }}>
                  {projects.length} total
                </span>
                {blocked > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {blocked} bloqueado{blocked > 1 ? 's' : ''}
                  </span>
                )}
                {atRisk > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    {atRisk} en riesgo
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0"
            style={{ backgroundColor: C.border, color: C.text }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4e6d8f'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.border}
          >
            <Plus className="w-4 h-4" />
            Nuevo proyecto
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-2xl h-52 animate-pulse"
                style={{ backgroundColor: C.surface }}
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ backgroundColor: C.surface, border: `1px solid ${C.border}30` }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ backgroundColor: `${C.border}20` }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2" style={{ color: C.text }}>Sin proyectos todavía</h3>
            <p className="text-sm mb-6" style={{ color: C.muted }}>
              Crea tu primer proyecto para empezar a gestionar tus clientes
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: C.border, color: C.text }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4e6d8f'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = C.border}
            >
              <Plus className="w-4 h-4" />
              Crear primer proyecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={onProjectCreated}
        />
      )}
    </div>
  )
}
