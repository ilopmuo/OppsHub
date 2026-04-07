import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, AlertTriangle, TrendingUp, CheckSquare } from 'lucide-react'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'
import NavBar from '../components/NavBar'

const STATUS_ORDER = { blocked: 0, at_risk: 1, on_track: 2 }

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="skeleton h-3.5 rounded" style={{ width: '62%' }} />
        <div className="skeleton h-5 rounded-full shrink-0" style={{ width: 46 }} />
      </div>
      <div className="skeleton h-5 rounded-full mb-4" style={{ width: 68 }} />
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <div className="skeleton h-3 rounded" style={{ width: 78 }} />
          <div className="skeleton h-3 rounded" style={{ width: 30 }} />
        </div>
        <div className="h-0.5 rounded-full skeleton" />
      </div>
      <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-start gap-2">
          <div className="skeleton rounded-full shrink-0 mt-1.5" style={{ width: 6, height: 6 }} />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 rounded" style={{ width: '78%' }} />
            <div className="skeleton h-3 rounded" style={{ width: '45%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*, tasks(id, title, status, priority, due_date)')
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

  const allTasks = projects.flatMap(p => p.tasks || [])
  const pendingTasks = allTasks.filter(t => t.status !== 'done').length
  const today = new Date()
  const overdue = projects.filter(p => {
    const d = p.deadline || p.renewal_date
    return d && new Date(d + 'T00:00:00') < today
  })
  const soonDeadline = projects.filter(p => {
    const d = p.deadline || p.renewal_date
    if (!d) return false
    const days = Math.ceil((new Date(d + 'T00:00:00') - today) / 86400000)
    return days >= 0 && days <= 7
  })
  const alerts = [...overdue, ...soonDeadline.filter(p => !overdue.includes(p))]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Global metrics */}
        {projects.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Proyectos activos', value: projects.length, icon: TrendingUp, color: '#f5f5f7' },
              { label: 'Tareas pendientes', value: pendingTasks, icon: CheckSquare, color: pendingTasks > 10 ? '#ff9f0a' : '#f5f5f7' },
              { label: 'Requieren atención', value: blocked + atRisk, icon: AlertTriangle, color: blocked + atRisk > 0 ? '#ff453a' : '#30d158' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl px-5 py-4" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: '#6e6e73' }}>{label}</span>
                  <Icon className="w-3.5 h-3.5" style={{ color: '#3a3a3a' }} />
                </div>
                <span className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Deadline alerts */}
        {alerts.length > 0 && (
          <div className="rounded-2xl p-4 mb-8 space-y-2" style={{ backgroundColor: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: '#ff9f0a' }}>Proyectos que requieren atención</p>
            {alerts.map(p => {
              const d = p.deadline || p.renewal_date
              const days = Math.ceil((new Date(d + 'T00:00:00') - today) / 86400000)
              const isOver = days < 0
              return (
                <div key={p.id}
                  onClick={() => navigate(`/project/${p.id}`)}
                  className="flex items-center justify-between cursor-pointer rounded-xl px-3 py-2 transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                >
                  <span className="text-sm" style={{ color: '#f5f5f7' }}>{p.name}</span>
                  <span className="text-xs font-medium" style={{ color: isOver ? '#ff453a' : '#ff9f0a' }}>
                    {isOver ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? 'Vence hoy' : `Vence en ${days}d`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>
              Dashboard
            </p>
            <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
              Proyectos
            </h1>
            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#6e6e73' }}>
                  {projects.length} activo{projects.length !== 1 ? 's' : ''}
                </span>
                {blocked > 0 && (
                  <><span style={{ color: '#3a3a3a' }}>·</span>
                  <span className="text-sm" style={{ color: '#ff453a' }}>{blocked} bloqueado{blocked > 1 ? 's' : ''}</span></>
                )}
                {atRisk > 0 && (
                  <><span style={{ color: '#3a3a3a' }}>·</span>
                  <span className="text-sm" style={{ color: '#ff9f0a' }}>{atRisk} en riesgo</span></>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] shrink-0"
            style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
          >
            <Plus className="w-4 h-4" />
            Nuevo proyecto
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
            </div>
            <p className="font-semibold mb-1.5 text-sm" style={{ color: '#f5f5f7' }}>Sin proyectos todavía</p>
            <p className="text-sm mb-7" style={{ color: '#6e6e73' }}>Crea tu primer proyecto para empezar</p>
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}>
              <Plus className="w-4 h-4" /> Crear proyecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} onClick={() => navigate(`/project/${project.id}`)} />
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
