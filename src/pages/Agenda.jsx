import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Loader2, ChevronRight, Calendar, List, ChevronLeft } from 'lucide-react'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'

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

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const PRIORITY_DOT = { high: '#ff453a', medium: '#ff9f0a', low: '#6e6e73' }

function CalendarView({ projects, onNavigate }) {
  const today = new Date()
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const allTasks = projects.flatMap(p =>
    (p.tasks || []).filter(t => t.due_date).map(t => ({ ...t, projectId: p.id, projectName: p.name }))
  )

  function tasksByDay(day) {
    const key = `${current.year}-${String(current.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return allTasks.filter(t => t.due_date === key)
  }

  const firstDay = new Date(current.year, current.month, 1)
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate()
  // Monday-first: getDay() returns 0=Sun, so offset by -1 mod 7
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) => i < startOffset ? null : i - startOffset + 1)

  const isToday = (d) => d === today.getDate() && current.month === today.getMonth() && current.year === today.getFullYear()

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrent(c => {
          const d = new Date(c.year, c.month - 1)
          return { year: d.getFullYear(), month: d.getMonth() }
        })} className="p-1.5 rounded-lg transition-all" style={{ color: '#6e6e73' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
          onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>
          {MONTHS[current.month]} {current.year}
        </span>
        <button onClick={() => setCurrent(c => {
          const d = new Date(c.year, c.month + 1)
          return { year: d.getFullYear(), month: d.getMonth() }
        })} className="p-1.5 rounded-lg transition-all" style={{ color: '#6e6e73' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
          onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium" style={{ color: '#6e6e73' }}>{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const tasks = day ? tasksByDay(day) : []
            const pending = tasks.filter(t => t.status !== 'done')
            return (
              <div
                key={i}
                className="min-h-[72px] p-1.5 relative"
                style={{
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  borderBottom: i < cells.length - 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                {day && (
                  <>
                    <span
                      className="text-xs w-5 h-5 flex items-center justify-center rounded-full mb-1 font-medium"
                      style={{
                        backgroundColor: isToday(day) ? '#f5f5f7' : 'transparent',
                        color: isToday(day) ? '#000' : pending.length > 0 ? '#f5f5f7' : '#3a3a3a',
                      }}
                    >
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {tasks.slice(0, 3).map(t => (
                        <button
                          key={t.id}
                          onClick={() => onNavigate(t.projectId)}
                          className="w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition-all"
                          style={{
                            backgroundColor: t.status === 'done' ? 'rgba(255,255,255,0.04)' : `${PRIORITY_DOT[t.priority]}22`,
                            color: t.status === 'done' ? '#3a3a3a' : '#f5f5f7',
                            textDecoration: t.status === 'done' ? 'line-through' : 'none',
                          }}
                          title={`${t.title} · ${t.projectName}`}
                        >
                          {t.title}
                        </button>
                      ))}
                      {tasks.length > 3 && (
                        <p className="text-xs px-1" style={{ color: '#6e6e73' }}>+{tasks.length - 3} más</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Agenda() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [view, setView] = useState('list')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*, tasks(*, assignee:assignee_id(id, email, display_name))')
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
    let filtered = tasks
    if (filter === 'active') filtered = filtered.filter(t => t.status !== 'done' && t.status !== 'backlog')
    else if (filter === 'todo') filtered = filtered.filter(t => t.status === 'todo')
    else if (filter === 'in_progress') filtered = filtered.filter(t => t.status === 'in_progress')
    if (assigneeFilter) filtered = filtered.filter(t => (t.assignee?.id || t.assignee_id) === assigneeFilter)
    return filtered
  }

  // Collect unique assignees across all projects
  const allAssignees = []
  const seenIds = new Set()
  for (const p of projects) {
    for (const t of (p.tasks || [])) {
      if (t.assignee?.id && !seenIds.has(t.assignee.id)) {
        seenIds.add(t.assignee.id)
        allAssignees.push(t.assignee)
      }
    }
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

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="flex gap-0.5 w-fit rounded-xl p-1" style={{ backgroundColor: '#111111' }}>
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setView('list') }}
                className="px-3.5 py-1.5 text-sm rounded-lg transition-all font-medium"
                style={{
                  backgroundColor: view === 'list' && filter === key ? '#2a2a2a' : 'transparent',
                  color: view === 'list' && filter === key ? '#f5f5f7' : '#6e6e73',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {allAssignees.length > 0 && (
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="text-sm rounded-xl px-3 py-2 outline-none"
              style={{
                backgroundColor: '#111111',
                color: assigneeFilter ? '#f5f5f7' : '#6e6e73',
                border: assigneeFilter ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <option value="">Por persona</option>
              {allAssignees.map(a => (
                <option key={a.id} value={a.id}>{a.display_name || a.email}</option>
              ))}
            </select>
          )}

          <div className="flex gap-0.5 rounded-xl p-1 ml-auto" style={{ backgroundColor: '#111111' }}>
            <button onClick={() => setView('list')}
              className="p-1.5 rounded-lg transition-all"
              style={{ backgroundColor: view === 'list' ? '#2a2a2a' : 'transparent', color: view === 'list' ? '#f5f5f7' : '#6e6e73' }}>
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('calendar')}
              className="p-1.5 rounded-lg transition-all"
              style={{ backgroundColor: view === 'calendar' ? '#2a2a2a' : 'transparent', color: view === 'calendar' ? '#f5f5f7' : '#6e6e73' }}>
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Calendar view */}
        {!loading && view === 'calendar' && (
          <CalendarView projects={projects} onNavigate={id => navigate(`/project/${id}`)} />
        )}

        {/* List view */}
        {view === 'list' && loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6e6e73' }} />
          </div>
        ) : view === 'list' && visibleProjects.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-semibold mb-1.5 text-sm" style={{ color: '#f5f5f7' }}>Todo al día</p>
            <p className="text-sm" style={{ color: '#6e6e73' }}>No hay tareas pendientes</p>
          </div>
        ) : view === 'list' ? (
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
        ) : null}
      </main>
    </div>
  )
}
