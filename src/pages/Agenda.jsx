import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Loader2, ChevronRight } from 'lucide-react'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { Calendar, Ticket } from 'lucide-react'

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  color: '#ff453a', bg: 'rgba(255,69,58,0.08)',   border: 'rgba(255,69,58,0.18)' },
  medium: { label: 'Media', color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)',  border: 'rgba(255,159,10,0.18)' },
  low:    { label: 'Baja',  color: '#6e6e73', bg: 'rgba(110,110,115,0.08)', border: 'rgba(110,110,115,0.18)' },
}

const STATUS_CYCLE = { todo: 'in_progress', in_progress: 'done', done: 'todo' }

function formatDate(date) {
  if (!date) return null
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function isOverdue(date) {
  if (!date) return false
  return new Date(date + 'T00:00:00') < new Date(new Date().toDateString())
}

function taskSortKey(t) {
  const overdue = isOverdue(t.due_date) && t.status !== 'done' ? 0 : 1
  const priority = { high: 0, medium: 1, low: 2 }[t.priority] ?? 1
  const date = t.due_date ? new Date(t.due_date).getTime() : Infinity
  return [overdue, priority, date]
}

function StatusDot({ status, onChange }) {
  const isDone = status === 'done'
  const isProgress = status === 'in_progress'
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(STATUS_CYCLE[status]) }}
      className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all mt-0.5"
      style={{
        backgroundColor: isDone ? '#f5f5f7' : 'transparent',
        border: `1.5px solid ${isDone ? '#f5f5f7' : isProgress ? '#ff9f0a' : 'rgba(255,255,255,0.2)'}`,
      }}
      onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)' }}
      onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = isDone ? '#f5f5f7' : isProgress ? '#ff9f0a' : 'rgba(255,255,255,0.2)' }}
    >
      {isDone && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
      {isProgress && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ff9f0a' }} />}
    </button>
  )
}

const FILTERS = [
  { key: 'active', label: 'Activas' },
  { key: 'todo', label: 'Por hacer' },
  { key: 'in_progress', label: 'En progreso' },
  { key: 'all', label: 'Todas' },
]

export default function Agenda() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*, tasks(*)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Error al cargar tareas')
    } else {
      setProjects(data || [])
    }
    setLoading(false)
  }

  async function handleChangeStatus(projectId, taskId, newStatus) {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (!error) {
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t) }
          : p
      ))
    }
  }

  function filterTasks(tasks) {
    if (!tasks) return []
    if (filter === 'active') return tasks.filter(t => t.status !== 'done')
    if (filter === 'todo') return tasks.filter(t => t.status === 'todo')
    if (filter === 'in_progress') return tasks.filter(t => t.status === 'in_progress')
    return tasks
  }

  const STATUS_ORDER = { blocked: 0, at_risk: 1, on_track: 2 }
  const visibleProjects = projects
    .map(p => ({ ...p, filteredTasks: filterTasks(p.tasks).sort((a, b) => {
      const [ao, ap, ad] = taskSortKey(a)
      const [bo, bp, bd] = taskSortKey(b)
      return ao - bo || ap - bp || ad - bd
    })}))
    .filter(p => p.filteredTasks.length > 0)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  const totalActive = projects.reduce((acc, p) => acc + (p.tasks || []).filter(t => t.status !== 'done').length, 0)
  const totalInProgress = projects.reduce((acc, p) => acc + (p.tasks || []).filter(t => t.status === 'in_progress').length, 0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <NavBar />

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>
            Vista global
          </p>
          <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
            Agenda
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span style={{ color: '#6e6e73' }}>{totalActive} tarea{totalActive !== 1 ? 's' : ''} pendiente{totalActive !== 1 ? 's' : ''}</span>
            {totalInProgress > 0 && (
              <>
                <span style={{ color: '#3a3a3a' }}>·</span>
                <span style={{ color: '#ff9f0a' }}>{totalInProgress} en progreso</span>
              </>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 w-fit rounded-xl p-1 mb-8" style={{ backgroundColor: '#111111' }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3.5 py-1.5 text-sm rounded-lg transition-all font-medium"
              style={{
                backgroundColor: filter === key ? '#2a2a2a' : 'transparent',
                color: filter === key ? '#f5f5f7' : '#6e6e73',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6e6e73' }} />
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-semibold mb-1.5 text-sm" style={{ color: '#f5f5f7' }}>Todo al día</p>
            <p className="text-sm" style={{ color: '#6e6e73' }}>No hay tareas pendientes</p>
          </div>
        ) : (
          <div className="space-y-8">
            {visibleProjects.map(project => (
              <div key={project.id}>
                {/* Project header */}
                <button
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="w-full flex items-center justify-between gap-3 mb-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <h2 className="font-semibold text-base truncate transition-colors"
                      style={{ color: '#f5f5f7' }}
                      onMouseEnter={e => e.target.style.color = '#6e6e73'}
                      onMouseLeave={e => e.target.style.color = '#f5f5f7'}
                    >
                      {project.name}
                    </h2>
                    <StatusBadge status={project.status} />
                    <span className="text-xs shrink-0" style={{ color: '#6e6e73' }}>
                      {project.type === 'maintenance' ? 'Mant.' : 'Impl.'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: '#6e6e73' }} />
                </button>

                {/* Tasks */}
                <div className="space-y-1.5">
                  {project.filteredTasks.map(task => {
                    const p = PRIORITY_CONFIG[task.priority]
                    const isDone = task.status === 'done'
                    const overdue = isOverdue(task.due_date) && !isDone

                    return (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all"
                        style={{
                          backgroundColor: '#111111',
                          border: '1px solid rgba(255,255,255,0.06)',
                          opacity: isDone ? 0.45 : 1,
                        }}
                      >
                        <StatusDot
                          status={task.status}
                          onChange={s => handleChangeStatus(project.id, task.id, s)}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm" style={{
                            color: isDone ? '#6e6e73' : '#f5f5f7',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                              style={{ backgroundColor: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                              {p.label}
                            </span>
                            {task.status === 'in_progress' && (
                              <span className="text-xs" style={{ color: '#ff9f0a' }}>En progreso</span>
                            )}
                            {task.due_date && (
                              <span className="flex items-center gap-1 text-xs"
                                style={{ color: overdue ? '#ff453a' : '#6e6e73' }}>
                                <Calendar className="w-3 h-3" />
                                {formatDate(task.due_date)}
                                {overdue && ' · Vencida'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
