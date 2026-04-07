import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Save, Trash2, Plus, Loader2, List, LayoutGrid, AlertTriangle, Download, ChevronDown, ChevronUp } from 'lucide-react'
import TaskList from '../components/TaskList'
import KanbanBoard from '../components/KanbanBoard'
import NewTaskModal from '../components/NewTaskModal'
import TaskDetailModal from '../components/TaskDetailModal'
import StatusBadge from '../components/StatusBadge'
import MilestoneList from '../components/MilestoneList'
import ProjectStats from '../components/ProjectStats'
import NavBar from '../components/NavBar'
import ProjectMembers from '../components/ProjectMembers'
import ActivityLog from '../components/ActivityLog'
import ProjectNotificationSettings from '../components/ProjectNotificationSettings'

async function logActivity(projectId, userId, action, metadata = {}) {
  await supabase.from('project_activity').insert({ project_id: projectId, user_id: userId, action, metadata })
}
async function createNotification(userId, type, projectId, taskId, message) {
  if (!userId) return
  await supabase.from('notifications').insert({ user_id: userId, type, project_id: projectId, task_id: taskId, message })
}

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
  const { user } = useAuth()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskModalStatus, setTaskModalStatus] = useState('todo')
  const [selectedTask, setSelectedTask] = useState(null)
  const [filter, setFilter] = useState('todo')
  const [taskView, setTaskView] = useState(getTaskView)
  const [editingDetails, setEditingDetails] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [status, setStatus] = useState('on_track')
  const [startDate, setStartDate] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [renewalDate, setRenewalDate] = useState('')
  const [slaStatus, setSlaStatus] = useState('ok')
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
    setLastContact(data.last_contact || '')
    await Promise.all([fetchTasks(), fetchMilestones(), fetchMembers(data)])
    setLoading(false)
  }

  async function fetchMembers(proj) {
    const p = proj || project
    if (!p) return
    const [{ data: pm }, { data: owner }] = await Promise.all([
      supabase.from('project_members').select('id, role, profile:user_id(id, email, display_name)').eq('project_id', id),
      supabase.from('profiles').select('id, email, display_name').eq('id', p.user_id).single(),
    ])
    const all = [
      owner ? { profile: owner, role: 'owner' } : null,
      ...(pm || []),
    ].filter(Boolean).map(m => m.profile)
    setMembers(all.filter(Boolean))
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*, assignee:assignee_id(id, email, display_name)').eq('project_id', id).order('created_at', { ascending: true })
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
    const task = tasks.find(t => t.id === taskId)
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      const action = newStatus === 'done' ? 'task_completed' : 'task_moved'
      logActivity(id, user.id, action, { task_title: task?.title, from: task?.status, to: newStatus })
      if (newStatus === 'done') {
        const assigneeId = task?.assignee?.id || task?.assignee_id
        const notifyId = assigneeId || user.id
        await supabase.from('notifications').insert({
          user_id: notifyId,
          type: 'task_completed',
          project_id: id,
          task_id: taskId,
          message: `Tarea completada: "${task?.title}"`,
        })
      }
    }
  }

  async function handleDeleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId)
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success('Tarea eliminada')
      logActivity(id, user.id, 'task_deleted', { task_title: task?.title })
    }
  }

  function onTaskCreated(task) {
    setTasks(prev => [...prev, task])
    setShowTaskModal(false)
    toast.success('Tarea creada')
    logActivity(id, user.id, 'task_created', { task_title: task.title })
  }

  function openAddTask(status = 'todo') {
    setTaskModalStatus(status)
    setShowTaskModal(true)
  }

  function switchView(v) {
    setTaskView(v)
    localStorage.setItem('opshub-task-view', v)
  }

  function handleExport() {
    const isImpl = project.type !== 'maintenance'
    const statusLabel = { on_track: 'On track', at_risk: 'At risk', blocked: 'Blocked' }
    const priorityLabel = { high: 'Alta', medium: 'Media', low: 'Baja' }
    const taskStatusLabel = { todo: 'Por hacer', in_progress: 'En progreso', done: 'Hecho' }
    const todoTasks = tasks.filter(t => t.status === 'todo')
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
    const doneTasks = tasks.filter(t => t.status === 'done')
    const pct = tasks.length > 0 ? Math.round(doneTasks.length / tasks.length * 100) : 0

    const lines = [
      `# ${project.name}`,
      `Tipo: ${isImpl ? 'Implementación' : 'Mantenimiento'}`,
      `Estado: ${statusLabel[project.status]}`,
      project.start_date ? `Inicio: ${project.start_date}` : '',
      isImpl && project.deadline ? `Deadline: ${project.deadline}` : '',
      !isImpl && project.renewal_date ? `Renovación: ${project.renewal_date}` : '',
      project.description ? `\nDescripción: ${project.description}` : '',
      '',
      `## Progreso de tareas: ${pct}% (${doneTasks.length}/${tasks.length})`,
      '',
    ]

    if (inProgressTasks.length > 0) {
      lines.push('### En progreso')
      inProgressTasks.forEach(t => {
        lines.push(`- [~] ${t.title} (${priorityLabel[t.priority]})${t.due_date ? ` · ${t.due_date}` : ''}`)
        if (t.description) lines.push(`       ${t.description}`)
      })
      lines.push('')
    }
    if (todoTasks.length > 0) {
      lines.push('### Por hacer')
      todoTasks.forEach(t => {
        lines.push(`- [ ] ${t.title} (${priorityLabel[t.priority]})${t.due_date ? ` · ${t.due_date}` : ''}`)
        if (t.description) lines.push(`       ${t.description}`)
      })
      lines.push('')
    }
    if (doneTasks.length > 0) {
      lines.push('### Completadas')
      doneTasks.forEach(t => lines.push(`- [x] ${t.title}`))
      lines.push('')
    }

    if (milestones.length > 0) {
      lines.push('## Hitos')
      milestones.forEach(m => lines.push(`- [${m.done ? 'x' : ' '}] ${m.title}`))
      lines.push('')
    }

    lines.push(`---`)
    lines.push(`Exportado desde OppsHub · ${new Date().toLocaleDateString('es-ES')}`)

    const blob = new Blob([lines.filter(l => l !== null && l !== undefined).join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/\s+/g, '_')}_resumen.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Resumen exportado')
  }

  const filteredTasks = tasks
    .filter(t => {
      if (filter === 'backlog') return t.status === 'backlog'
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
    || (!isImpl && lastContact !== (project.last_contact || ''))

  function fmtDate(d) {
    if (!d) return null
    return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const deadlineDate = isImpl ? project.deadline : project.renewal_date
  const deadlineDays = deadlineDate
    ? Math.ceil((new Date(deadlineDate + 'T00:00:00') - new Date()) / 86400000)
    : null
  const showAlert = deadlineDays !== null && deadlineDays <= 7
  const alertOver = deadlineDays !== null && deadlineDays < 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <NavBar breadcrumb={name} />

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}>
                {isImpl ? 'Implementación' : 'Mantenimiento'}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
              {project.name}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <ProjectNotificationSettings projectId={id} />
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ backgroundColor: '#1a1a1a', color: '#6e6e73', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
            </button>
            <button
              onClick={handleDelete}
              title="Eliminar proyecto"
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
              style={{ backgroundColor: '#1a1a1a', color: '#6e6e73', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff453a'; e.currentTarget.style.borderColor = 'rgba(255,69,58,0.3)'; e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.backgroundColor = '#1a1a1a' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Deadline alert ── */}
        {showAlert && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-6"
            style={{
              backgroundColor: alertOver ? 'rgba(255,69,58,0.08)' : 'rgba(255,159,10,0.08)',
              border: `1px solid ${alertOver ? 'rgba(255,69,58,0.2)' : 'rgba(255,159,10,0.2)'}`,
            }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: alertOver ? '#ff453a' : '#ff9f0a' }} />
            <p className="text-sm" style={{ color: alertOver ? '#ff453a' : '#ff9f0a' }}>
              {alertOver
                ? `${isImpl ? 'Deadline' : 'Renovación'} vencido hace ${Math.abs(deadlineDays)} día${Math.abs(deadlineDays) !== 1 ? 's' : ''}`
                : deadlineDays === 0
                  ? `${isImpl ? 'Deadline' : 'Renovación'} es hoy`
                  : `${isImpl ? 'Deadline' : 'Renovación'} en ${deadlineDays} día${deadlineDays !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-8 items-start">

          {/* ── LEFT: Tasks (primary) ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold" style={{ color: '#f5f5f7' }}>Tareas</h2>
                {tasks.filter(t => t.status !== 'done').length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}>
                    {tasks.filter(t => t.status !== 'done').length} pendientes
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
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

            {/* Kanban */}
            {taskView === 'kanban' && (
              <KanbanBoard
                tasks={tasks}
                onUpdateStatus={handleChangeStatus}
                onDelete={handleDeleteTask}
                onAddTask={status => openAddTask(status)}
                onClickTask={setSelectedTask}
              />
            )}

            {/* List */}
            {taskView === 'list' && (
              <>
                <div className="flex gap-0.5 w-fit rounded-xl p-1 mb-4" style={{ backgroundColor: '#111111' }}>
                  {[
                    { key: 'backlog', label: 'Backlog' },
                    { key: 'todo', label: 'Por hacer' },
                    { key: 'in_progress', label: 'En progreso' },
                    { key: 'done', label: 'Completadas' },
                    { key: 'all', label: 'Todas' },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setFilter(key)}
                      className="px-3 py-1.5 text-sm rounded-lg transition-all font-medium"
                      style={{ backgroundColor: filter === key ? '#2a2a2a' : 'transparent', color: filter === key ? '#f5f5f7' : '#6e6e73' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <TaskList tasks={filteredTasks} onChangeStatus={handleChangeStatus} onDelete={handleDeleteTask} onClickTask={setSelectedTask} members={members} />
                {filteredTasks.length === 0 && (
                  <div className="rounded-2xl py-14 text-center" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm" style={{ color: '#6e6e73' }}>
                      {filter === 'done' ? 'No hay tareas completadas'
                        : filter === 'backlog' ? 'No hay tareas en backlog'
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

          {/* ── RIGHT: Sidebar ── */}
          <div className="space-y-4 lg:sticky lg:top-20">

            {/* Stats */}
            <ProjectStats project={project} tasks={tasks} milestones={milestones} />

            {/* Project details (collapsible) */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setEditingDetails(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 transition-all"
                style={{ borderBottom: editingDetails ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="text-xs font-semibold" style={{ color: '#6e6e73' }}>Detalles del proyecto</span>
                {editingDetails
                  ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#6e6e73' }} />
                  : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#6e6e73' }} />
                }
              </button>

              {!editingDetails && (
                <div className="px-4 pb-4 pt-2 space-y-2">
                  {project.description && (
                    <p className="text-xs leading-relaxed" style={{ color: '#6e6e73' }}>{project.description}</p>
                  )}
                  <div className="space-y-1.5">
                    {project.start_date && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: '#3a3a3a' }}>Inicio</span>
                        <span className="text-xs" style={{ color: '#6e6e73' }}>{fmtDate(project.start_date)}</span>
                      </div>
                    )}
                    {isImpl && project.deadline && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: '#3a3a3a' }}>Deadline</span>
                        <span className="text-xs" style={{ color: '#6e6e73' }}>{fmtDate(project.deadline)}</span>
                      </div>
                    )}
                    {!isImpl && project.renewal_date && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: '#3a3a3a' }}>Renovación</span>
                        <span className="text-xs" style={{ color: '#6e6e73' }}>{fmtDate(project.renewal_date)}</span>
                      </div>
                    )}
                    {!isImpl && project.last_contact && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: '#3a3a3a' }}>Último contacto</span>
                        <span className="text-xs" style={{ color: '#6e6e73' }}>
                          {new Date(project.last_contact + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    )}
                  </div>
                  {!project.description && !project.start_date && !project.deadline && !project.renewal_date && (
                    <p className="text-xs" style={{ color: '#3a3a3a' }}>Sin detalles</p>
                  )}
                </div>
              )}

              {editingDetails && (
                <div className="px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Nombre</label>
                    <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Estado</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo}>
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Fecha de inicio</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
                  </div>
                  {isImpl && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Deadline</label>
                      <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
                    </div>
                  )}
                  {!isImpl && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Renovación</label>
                        <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Estado SLA</label>
                        <select value={slaStatus} onChange={e => setSlaStatus(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo}>
                          {SLA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Último contacto</label>
                        <input type="date" value={lastContact} onChange={e => setLastContact(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>Descripción</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                      placeholder="Contexto breve..." style={{ ...inputStyle, resize: 'none' }} onFocus={fi} onBlur={fo} />
                  </div>
                  <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={handleDelete} className="flex items-center gap-1 text-xs transition-colors"
                      style={{ color: '#6e6e73' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
                      <Trash2 className="w-3 h-3" /> Eliminar proyecto
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingDetails(false)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ backgroundColor: '#2a2a2a', color: '#6e6e73' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#333' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}>
                        Cancelar
                      </button>
                      <button
                        onClick={async () => { await handleSave(); setEditingDetails(false) }}
                        disabled={!isDirty || saving}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                        style={{
                          backgroundColor: isDirty && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.1)',
                          color: isDirty && !saving ? '#000' : '#6e6e73',
                          cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
                        }}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Milestones */}
            {isImpl && (
              <MilestoneList projectId={id} milestones={milestones} onChange={setMilestones} />
            )}

            {/* Team */}
            <ProjectMembers projectId={id} projectOwnerId={project.user_id} />

            {/* Activity */}
            <ActivityLog projectId={id} />
          </div>
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
          members={members}
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
