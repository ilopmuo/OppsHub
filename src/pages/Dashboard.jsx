import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, LogOut } from 'lucide-react'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'

const STATUS_ORDER = { blocked: 0, at_risk: 1, on_track: 2 }

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
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{
          backgroundColor: 'rgba(0,0,0,0.72)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
              <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
              <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
              <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
              <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
            </svg>
            <span className="font-semibold text-sm" style={{ color: '#f5f5f7' }}>OppsHub</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <span className="text-xs hidden sm:block" style={{ color: '#6e6e73' }}>{user?.email}</span>
            <button
              onClick={async () => { await supabase.auth.signOut(); toast.success('Sesión cerrada') }}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Page title */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
              Proyectos
            </h1>

            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#6e6e73' }}>
                  {projects.length} activo{projects.length !== 1 ? 's' : ''}
                </span>
                {blocked > 0 && (
                  <>
                    <span style={{ color: '#3a3a3a' }}>·</span>
                    <span className="text-sm" style={{ color: '#ff453a' }}>
                      {blocked} bloqueado{blocked > 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {atRisk > 0 && (
                  <>
                    <span style={{ color: '#3a3a3a' }}>·</span>
                    <span className="text-sm" style={{ color: '#ff9f0a' }}>
                      {atRisk} en riesgo
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
          >
            <Plus className="w-4 h-4" />
            Nuevo proyecto
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-2xl h-52 animate-pulse"
                style={{ backgroundColor: '#111111' }}
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
            </div>
            <p className="font-semibold mb-1.5 text-sm" style={{ color: '#f5f5f7' }}>Sin proyectos todavía</p>
            <p className="text-sm mb-7" style={{ color: '#6e6e73' }}>
              Crea tu primer proyecto para empezar
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
            >
              <Plus className="w-4 h-4" />
              Crear proyecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <NewProjectModal onClose={() => setShowModal(false)} onCreated={onProjectCreated} />
      )}
    </div>
  )
}
