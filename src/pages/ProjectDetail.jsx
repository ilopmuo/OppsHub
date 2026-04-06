import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Save, Trash2, Plus, Loader2, List, LayoutGrid } from 'lucide-react'
import TaskList from '../components/TaskList'
import KanbanBoard from '../components/KanbanBoard'
import NewTaskModal from '../components/NewTaskModal'
import TaskDetailModal from '../components/TaskDetailModal'
import StatusBadge from '../components/StatusBadge'
import MilestoneList from '../components/MilestoneList'
import ProjectStats from '../components/ProjectStats'
import NavBar from '../components/NavBar'

const STATUS_OPTIONS = [
  { value: 'on_track', label: 'On track' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'blocked', label: 'Blocked' },
]

const SLA_OPTIONS = [
  { value: 'ok', label: 'Cumpliendo' },
  { value: 'at_risk', label: 'En riesgo' },
  { value: 'breach', label: 'Incumpliendo' },
]

const inputStyle = {
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f5f5f7',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
}

const fi = e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'
const fo = e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function getTaskView() {
  return localStorage.getItem('opshub-task-view') || 'list'
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskModalStatus, setTaskModalStatus] = useState('todo')
  const [selectedTask, setSelectedTask] = useState(null)
  const [filter, setFilter] = useState('todo')
  const [taskView, setTaskView] = useState(getTaskView)

  // Form fields
  const [name, setName] = useState('')
  const [status, setStatus] = useState('on_track')
  const [startDate, setStartDate] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [renewalDate, setRenewalDate] = useState('')
  const [slaStatus, setSlaStatus] = useState('ok')
  const [openTickets, setOpenTickets] = useState('')
  const [lastContact, setLastContact] = useState('')

  useEffect(() => { fetchProject() }, [id])

  async function fetchProject() {
    setLoading(true)
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
    if (error || !data) { toast.error('Proyecto no encontrado'); navigate('/'); return }
    setProject(data)
    setName(data.name); setStatus(data.status); setStartDate(data.start_date || '')
    setDescription(data.description || ''); setDeadline(data.deadline || '')
    setRenewalDate(data.renewal_date || ''); setSlaStatus(data.sla_status || 'ok')
    setOpenTickets(data.open_tickets !== null && data.open_tickets !== undefined ? String(data.open_tickets) : '')
    setLastContact(data.last_contact || '')
    await Promise.all([fetchTasks(), fetchMilestones()])
    setLoading(false)
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('project_id', id).order('created_at', { ascending: true })
    setTasks(data || [])
  }

  async function fetchMilestones() {
    const { data } = await supabase.from('milestones').select('*').eq('project_id', id).order('created_at', { ascending: true })
    setMilestones(data || [])
  }

  async function handleSave() {
    setSaving(true)
    const isImpl = project.type !== 'maintenance'
    const payload = {
      name, status, description, start_date: startDate || null,
      deadline: isImpl ? (deadline || null) : null,
      renewal_date: !isImpl ? (renewalDate || null) : null,
      sla_status: !isImpl ? slaStatus : null,
      open_tickets: !isImpl ? (openTickets !== '' ? parseInt(openTickets) : null) : null,
      last_contact: !isImpl ? (lastContact || null) : null,
    }
    const { error } = await supabase.from('projects').update(payload).eq('id', id)
    if (error) { toast.error('Error al guardar') } else {
      toast.success('Guardado'); setProject(p => ({ ...p, ...payload }))
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar') } else { toast.success('Eliminado'); navigate('/') }
  }

  async function handleChangeStatus(taskId, newStatus) {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  async function handleDeleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) { setTasks(prev => prev.filter(t => t.id !== taskId)); toast.success('Tarea eliminada') }
  }

  function onTaskCreated(task) {
    setTasks(prev => [...prev, task]); setShowTaskModal(false); toast.success('Tarea creada')
  }

  function openAddTask(status = 'todo') {
    setTaskModalStatus(status)
    setShowTaskModal(true)
  }

  function switchView(v) {
    setTaskView(v)
    localStorage.setItem('opshub-task-view', v)
  }

  const filteredTasks = tasks
    .filter(t => {
      if (filter === 'todo') return t.status === 'todo'
      if (filter === 'in_progress') return t.status === 'in_progress'
      if (filter === 'done') return t.status === 'done'
      return true
    })
    .sort((a, b) => {
      if (a.status === 'done' !== b.status === 'done') return a.status === 'done' ? 1 : -1
      const pa = PRIORITY_ORDER[a.priority] ?? 1, pb = PRIORITY_ORDER[b.priority] ?? 1
      if (pa !== pb) return pa - pb
      return a.due_date && b.due_date ? new Date(a.due_date) - new Date(b.due_date) : a.due_date ? -1 : 1
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#000000' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6e6e73' }} />
      </div>
    )
  }

  const isImpl = project.type !== 'maintenance'
  const isDirty = name !== project.name || status !== project.status
    || startDate !== (project.start_date || '') || description !== (project.description || '')
    || (isImpl && deadline !== (project.deadline || ''))
    || (!isImpl && renewalDate !== (project.renewal_date || ''))
    || (!isImpl && slaStatus !== (project.sla_status || 'ok'))
    || (!isImpl && openTickets !== (project.open_tickets !== null && project.open_tickets !== undefined ? String(project.open_tickets) : ''))
    || (!isImpl && lastContact !== (project.last_contact || ''))

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <NavBar breadcrumb={name} />

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">

        {/* Heading */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <span className="text-xs" style={{ color: '#6e6e73' }}>
            {isImpl ? 'Implementación' : 'Mantenimiento'}
          </span>
        </div>

        {/* Stats */}
        <ProjectStats project={project} tasks={tasks} milestones={milestones} />

        {/* Form */}
        <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#6e6e73' }}>Detalles</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Fecha de inicio</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
            </div>

            {isImpl && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Deadline</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
              </div>
            )}

            {!isImpl && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Renovación de contrato</label>
                  <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado SLA</label>
                  <select value={slaStatus} onChange={e => setSlaStatus(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo}>
                    {SLA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Tickets abiertos</label>
                  <input type="number" min="0" value={openTickets} onChange={e => setOpenTickets(e.target.value)}
                    placeholder="0" style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Último contacto</label>
                  <input type="date" value={lastContact} onChange={e => setLastContact(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Descripción <span style={{ color: '#3a3a3a' }}>(opcional)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="Contexto breve..." style={{ ...inputStyle, resize: 'none' }} onFocus={fi} onBlur={fo} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
            <button onClick={handleSave} disabled={!isDirty || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: isDirty && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.1)',
                color: isDirty && !saving ? '#000000' : '#6e6e73',
                cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </div>

        {/* Milestones (implementation only) */}
        {isImpl && (
          <MilestoneList projectId={id} milestones={milestones} onChange={setMilestones} />
        )}

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#f5f5f7' }}>Tareas</h2>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex gap-0.5 rounded-xl p-1" style={{ backgroundColor: '#111111' }}>
                <button onClick={() => switchView('list')}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ backgroundColor: taskView === 'list' ? '#2a2a2a' : 'transparent', color: taskView === 'list' ? '#f5f5f7' : '#6e6e73' }}>
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => switchView('kanban')}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ backgroundColor: taskView === 'kanban' ? '#2a2a2a' : 'transparent', color: taskView === 'kanban' ? '#f5f5f7' : '#6e6e73' }}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>

              <button onClick={() => openAddTask('todo')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}>
                <Plus className="w-3.5 h-3.5" /> Nueva tarea
              </button>
            </div>
          </div>

          {/* Kanban view */}
          {taskView === 'kanban' && (
            <KanbanBoard
              tasks={tasks}
              onUpdateStatus={handleChangeStatus}
              onDelete={handleDeleteTask}
              onAddTask={status => openAddTask(status)}
              onClickTask={setSelectedTask}
            />
          )}

          {/* List view */}
          {taskView === 'list' && (
            <>
              <div className="flex gap-0.5 w-fit rounded-xl p-1 mb-5" style={{ backgroundColor: '#111111' }}>
                {[
                  { key: 'todo', label: 'Por hacer' },
                  { key: 'in_progress', label: 'En progreso' },
                  { key: 'done', label: 'Completadas' },
                  { key: 'all', label: 'Todas' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className="px-3.5 py-1.5 text-sm rounded-lg transition-all font-medium"
                    style={{ backgroundColor: filter === key ? '#2a2a2a' : 'transparent', color: filter === key ? '#f5f5f7' : '#6e6e73' }}>
                    {label}
                  </button>
                ))}
              </div>

              <TaskList tasks={filteredTasks} onChangeStatus={handleChangeStatus} onDelete={handleDeleteTask} onClickTask={setSelectedTask} />

              {filteredTasks.length === 0 && (
                <div className="rounded-2xl py-14 text-center" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-sm" style={{ color: '#6e6e73' }}>
                    {filter === 'done' ? 'No hay tareas completadas'
                      : filter === 'todo' ? 'No hay tareas por hacer'
                      : filter === 'in_progress' ? 'No hay tareas en progreso'
                      : 'Sin tareas'}
                  </p>
                  {filter !== 'done' && (
                    <button onClick={() => openAddTask('todo')} className="mt-3 text-sm transition-colors"
                      style={{ color: '#6e6e73' }}
                      onMouseEnter={e => e.target.style.color = '#f5f5f7'}
                      onMouseLeave={e => e.target.style.color = '#6e6e73'}>
                      + Añadir tarea
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showTaskModal && (
        <NewTaskModal
          projectId={id}
          defaultStatus={taskModalStatus}
          onClose={() => setShowTaskModal(false)}
          onCreated={onTaskCreated}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdated={updated => {
            setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
            setSelectedTask(null)
            toast.success('Tarea actualizada')
          }}
          onDeleted={taskId => {
            setTasks(prev => prev.filter(t => t.id !== taskId))
            setSelectedTask(null)
            toast.success('Tarea eliminada')
          }}
        />
      )}
    </div>
  )
}
