import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Trash2, Plus, Loader2, LogOut } from 'lucide-react'
import TaskList from '../components/TaskList'
import NewTaskModal from '../components/NewTaskModal'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'

const C = {
  bg: '#0d1b2a',
  surface: '#1b263b',
  border: '#415a77',
  muted: '#778da9',
  text: '#e0e1dd',
}

const STATUS_OPTIONS = [
  { value: 'on_track', label: 'On track' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'blocked', label: 'Blocked' },
]

const inputClass = "w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
const inputStyle = { backgroundColor: C.bg, border: `1px solid ${C.border}50`, color: C.text }

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [filter, setFilter] = useState('pending')

  const [name, setName] = useState('')
  const [status, setStatus] = useState('on_track')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => { fetchProject() }, [id])

  async function fetchProject() {
    setLoading(true)
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
    if (error || !data) { toast.error('Proyecto no encontrado'); navigate('/'); return }
    setProject(data)
    setName(data.name)
    setStatus(data.status)
    setDeadline(data.deadline || '')
    setDescription(data.description || '')
    await fetchTasks()
    setLoading(false)
  }

  async function fetchTasks() {
    const { data, error } = await supabase.from('tasks').select('*').eq('project_id', id).order('created_at', { ascending: true })
    if (!error) setTasks(data || [])
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('projects').update({ name, status, deadline: deadline || null, description }).eq('id', id)
    if (error) { toast.error('Error al guardar') } else {
      toast.success('Proyecto actualizado')
      setProject(p => ({ ...p, name, status, deadline, description }))
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar') } else { toast.success('Proyecto eliminado'); navigate('/') }
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
    setTasks(prev => [...prev, task])
    setShowTaskModal(false)
    toast.success('Tarea creada')
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
  const filteredTasks = tasks
    .filter(t => filter === 'pending' ? !t.done : filter === 'done' ? t.done : true)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      const pa = PRIORITY_ORDER[a.priority] ?? 1, pb = PRIORITY_ORDER[b.priority] ?? 1
      if (pa !== pb) return pa - pb
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date)
      return a.due_date ? -1 : b.due_date ? 1 : 0
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.muted }} />
      </div>
    )
  }

  const isDirty = name !== project.name || status !== project.status || deadline !== (project.deadline || '') || description !== (project.description || '')

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 backdrop-blur-md"
        style={{ backgroundColor: `${C.surface}cc`, borderBottom: `1px solid ${C.border}30` }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm transition-all py-1.5 px-3 rounded-lg"
              style={{ color: C.muted }}
              onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.backgroundColor = `${C.border}20` }}
              onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Proyectos</span>
            </button>
            <span style={{ color: `${C.border}60` }}>/</span>
            <span className="text-sm font-medium truncate max-w-[160px]" style={{ color: C.text }}>{name}</span>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut() }}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg transition-all"
            style={{ color: C.muted, border: `1px solid ${C.border}30` }}
            onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border }}
            onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = `${C.border}30` }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Project form card */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}30` }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: C.border }}>Proyecto</p>
              <h1 className="text-xl font-bold" style={{ color: C.text }}>{project.name}</h1>
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: C.muted }}>
                Nombre del proyecto / cliente
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.muted}
                onBlur={e => e.target.style.borderColor = `${C.border}50`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: C.muted }}>Estado</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className={inputClass}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.muted}
                onBlur={e => e.target.style.borderColor = `${C.border}50`}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: C.muted }}>Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className={inputClass}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.muted}
                onBlur={e => e.target.style.borderColor = `${C.border}50`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: C.muted }}>
                Descripción <span style={{ color: `${C.border}80` }}>(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Contexto breve sobre el proyecto..."
                className={`${inputClass} resize-none`}
                style={{ ...inputStyle, placeholder: C.border }}
                onFocus={e => e.target.style.borderColor = C.muted}
                onBlur={e => e.target.style.borderColor = `${C.border}50`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-5" style={{ borderTop: `1px solid ${C.border}20` }}>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-sm transition-all"
              style={{ color: `${C.muted}` }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = C.muted}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar proyecto
            </button>

            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: isDirty && !saving ? C.border : `${C.border}40`,
                color: isDirty && !saving ? C.text : `${C.text}50`,
                cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar cambios
            </button>
          </div>
        </div>

        {/* Tasks section */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold" style={{ color: C.text }}>Tareas</h2>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: C.border, color: C.text }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4e6d8f'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = C.border}
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva tarea
            </button>
          </div>

          {/* Filter tabs */}
          <div
            className="flex gap-0.5 w-fit rounded-xl p-1 mb-5"
            style={{ backgroundColor: C.surface, border: `1px solid ${C.border}30` }}
          >
            {[
              { key: 'pending', label: 'Pendientes' },
              { key: 'done', label: 'Completadas' },
              { key: 'all', label: 'Todas' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-3.5 py-1.5 text-sm rounded-lg transition-all font-medium"
                style={{
                  backgroundColor: filter === key ? C.border : 'transparent',
                  color: filter === key ? C.text : C.muted,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <TaskList tasks={filteredTasks} onToggle={handleToggleTask} onDelete={handleDeleteTask} />

          {filteredTasks.length === 0 && (
            <div
              className="rounded-2xl py-14 text-center"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.border}20` }}
            >
              <p className="text-sm" style={{ color: C.muted }}>
                {filter === 'done' ? 'No hay tareas completadas todavía'
                  : filter === 'pending' ? 'No hay tareas pendientes'
                  : 'No hay tareas en este proyecto'}
              </p>
              {filter !== 'done' && (
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="mt-3 text-sm font-medium transition-all"
                  style={{ color: C.border }}
                  onMouseEnter={e => e.target.style.color = C.muted}
                  onMouseLeave={e => e.target.style.color = C.border}
                >
                  + Crear primera tarea
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
