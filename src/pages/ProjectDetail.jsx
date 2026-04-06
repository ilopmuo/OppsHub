import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Trash2, Plus, Loader2, LogOut, Rocket, Wrench } from 'lucide-react'
import TaskList from '../components/TaskList'
import NewTaskModal from '../components/NewTaskModal'
import StatusBadge from '../components/StatusBadge'
import MilestoneList from '../components/MilestoneList'
import { useAuth } from '../contexts/AuthContext'

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

const focusIn = e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'
const focusOut = e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [filter, setFilter] = useState('pending')

  // Shared editable fields
  const [name, setName] = useState('')
  const [status, setStatus] = useState('on_track')
  const [description, setDescription] = useState('')
  // Implementation
  const [deadline, setDeadline] = useState('')
  // Maintenance
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
    setName(data.name)
    setStatus(data.status)
    setDescription(data.description || '')
    setDeadline(data.deadline || '')
    setRenewalDate(data.renewal_date || '')
    setSlaStatus(data.sla_status || 'ok')
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
      name, status, description,
      deadline: isImpl ? (deadline || null) : null,
      renewal_date: !isImpl ? (renewalDate || null) : null,
      sla_status: !isImpl ? slaStatus : null,
      open_tickets: !isImpl ? (openTickets !== '' ? parseInt(openTickets) : null) : null,
      last_contact: !isImpl ? (lastContact || null) : null,
    }
    const { error } = await supabase.from('projects').update(payload).eq('id', id)
    if (error) { toast.error('Error al guardar') } else {
      toast.success('Guardado')
      setProject(p => ({ ...p, ...payload }))
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar') } else { toast.success('Eliminado'); navigate('/') }
  }

  async function handleToggleTask(taskId, done) {
    const { error } = await supabase.from('tasks').update({ done }).eq('id', taskId)
    if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done } : t))
  }

  async function handleDeleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) { setTasks(prev => prev.filter(t => t.id !== taskId)); toast.success('Tarea eliminada') }
  }

  function onTaskCreated(task) {
    setTasks(prev => [...prev, task]); setShowTaskModal(false); toast.success('Tarea creada')
  }

  const filteredTasks = tasks
    .filter(t => filter === 'pending' ? !t.done : filter === 'done' ? t.done : true)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
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

  // Detect unsaved changes
  const isDirty = name !== project.name
    || status !== project.status
    || description !== (project.description || '')
    || (isImpl && deadline !== (project.deadline || ''))
    || (!isImpl && renewalDate !== (project.renewal_date || ''))
    || (!isImpl && slaStatus !== (project.sla_status || 'ok'))
    || (!isImpl && openTickets !== (project.open_tickets !== null && project.open_tickets !== undefined ? String(project.open_tickets) : ''))
    || (!isImpl && lastContact !== (project.last_contact || ''))

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
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 transition-colors"
              style={{ color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              <ArrowLeft className="w-4 h-4" />
              Proyectos
            </button>
            <span style={{ color: '#3a3a3a' }}>/</span>
            <span className="font-medium truncate max-w-[160px]" style={{ color: '#f5f5f7' }}>{name}</span>
          </div>
          <button
            onClick={async () => await supabase.auth.signOut()}
            className="transition-colors" style={{ color: '#6e6e73' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
            onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">

        {/* Project heading */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          {/* Type pill */}
          <span
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}
          >
            {isImpl ? <Rocket className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
            {isImpl ? 'Implementación' : 'Mantenimiento'}
          </span>
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Implementation: deadline */}
            {isImpl && (
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Deadline</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
              </div>
            )}

            {/* Maintenance fields */}
            {!isImpl && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Renovación de contrato</label>
                  <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado SLA</label>
                  <select value={slaStatus} onChange={e => setSlaStatus(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut}>
                    {SLA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Tickets abiertos</label>
                  <input
                    type="number" min="0" value={openTickets}
                    onChange={e => setOpenTickets(e.target.value)}
                    placeholder="0" style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Último contacto</label>
                  <input type="date" value={lastContact} onChange={e => setLastContact(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
                Descripción <span style={{ color: '#3a3a3a' }}>(opcional)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="Contexto breve..." style={{ ...inputStyle, resize: 'none' }} onFocus={focusIn} onBlur={focusOut} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
            <button onClick={handleSave} disabled={!isDirty || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: isDirty && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.1)',
                color: isDirty && !saving ? '#000000' : '#6e6e73',
                cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </div>

        {/* Milestones (implementation only) */}
        {isImpl && (
          <div>
            <MilestoneList
              projectId={id}
              milestones={milestones}
              onChange={setMilestones}
            />
          </div>
        )}

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#f5f5f7' }}>Tareas</h2>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva tarea
            </button>
          </div>

          {/* Filter */}
          <div className="flex gap-0.5 w-fit rounded-xl p-1 mb-5" style={{ backgroundColor: '#111111' }}>
            {[
              { key: 'pending', label: 'Pendientes' },
              { key: 'done', label: 'Completadas' },
              { key: 'all', label: 'Todas' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className="px-3.5 py-1.5 text-sm rounded-lg transition-all font-medium"
                style={{ backgroundColor: filter === key ? '#2a2a2a' : 'transparent', color: filter === key ? '#f5f5f7' : '#6e6e73' }}
              >
                {label}
              </button>
            ))}
          </div>

          <TaskList tasks={filteredTasks} onToggle={handleToggleTask} onDelete={handleDeleteTask} />

          {filteredTasks.length === 0 && (
            <div className="rounded-2xl py-14 text-center" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm" style={{ color: '#6e6e73' }}>
                {filter === 'done' ? 'No hay tareas completadas' : filter === 'pending' ? 'No hay tareas pendientes' : 'Sin tareas'}
              </p>
              {filter !== 'done' && (
                <button onClick={() => setShowTaskModal(true)} className="mt-3 text-sm transition-colors"
                  style={{ color: '#6e6e73' }}
                  onMouseEnter={e => e.target.style.color = '#f5f5f7'}
                  onMouseLeave={e => e.target.style.color = '#6e6e73'}
                >
                  + Añadir tarea
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {showTaskModal && (
        <NewTaskModal projectId={id} onClose={() => setShowTaskModal(false)} onCreated={onTaskCreated} />
      )}
    </div>
  )
}
