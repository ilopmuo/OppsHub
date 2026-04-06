import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Trash2, Archive, Plus, Loader2, LayoutDashboard
} from 'lucide-react'
import TaskList from '../components/TaskList'
import NewTaskModal from '../components/NewTaskModal'
import StatusBadge from '../components/StatusBadge'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const STATUS_OPTIONS = [
  { value: 'on_track', label: 'On track' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'blocked', label: 'Blocked' },
]

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggle } = useTheme()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [filter, setFilter] = useState('pending') // 'all' | 'pending' | 'done'

  // Editable fields
  const [name, setName] = useState('')
  const [status, setStatus] = useState('on_track')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    fetchProject()
  }, [id])

  async function fetchProject() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      toast.error('Proyecto no encontrado')
      navigate('/')
      return
    }

    setProject(data)
    setName(data.name)
    setStatus(data.status)
    setDeadline(data.deadline || '')
    setDescription(data.description || '')

    await fetchTasks()
    setLoading(false)
  }

  async function fetchTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true })

    if (!error) {
      setTasks(data || [])
    }
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({ name, status, deadline: deadline || null, description })
      .eq('id', id)

    if (error) {
      toast.error('Error al guardar')
    } else {
      toast.success('Proyecto actualizado')
      setProject(p => ({ ...p, name, status, deadline, description }))
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el proyecto "${name}"? Esta acción no se puede deshacer.`)) return

    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Proyecto eliminado')
      navigate('/')
    }
  }

  async function handleToggleTask(taskId, done) {
    const { error } = await supabase
      .from('tasks')
      .update({ done })
      .eq('id', taskId)

    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done } : t))
    }
  }

  async function handleDeleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success('Tarea eliminada')
    }
  }

  function onTaskCreated(task) {
    setTasks(prev => [...prev, task])
    setShowTaskModal(false)
    toast.success('Tarea creada')
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

  const filteredTasks = tasks
    .filter(t => {
      if (filter === 'pending') return !t.done
      if (filter === 'done') return t.done
      return true
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      const pa = PRIORITY_ORDER[a.priority] ?? 1
      const pb = PRIORITY_ORDER[b.priority] ?? 1
      if (pa !== pb) return pa - pb
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    )
  }

  const isDirty =
    name !== project.name ||
    status !== project.status ||
    deadline !== (project.deadline || '') ||
    description !== (project.description || '')

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-violet-600 p-1.5 rounded-lg">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold">OpsHub</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Project form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-white">Detalles del proyecto</h1>
            <StatusBadge status={project.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Nombre del proyecto / cliente</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Estado</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Descripción <span className="text-gray-600">(opcional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Contexto breve sobre el proyecto..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar proyecto
            </button>

            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-2 text-sm rounded-lg transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar cambios
            </button>
          </div>
        </div>

        {/* Tasks section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Tareas</h2>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white font-medium px-3 py-1.5 text-sm rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva tarea
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit mb-4">
            {[
              { key: 'pending', label: 'Pendientes' },
              { key: 'done', label: 'Completadas' },
              { key: 'all', label: 'Todas' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  filter === key
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <TaskList
            tasks={filteredTasks}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onEmpty={() => (
              <div className="text-center py-12 text-gray-500 text-sm">
                {filter === 'done'
                  ? 'No hay tareas completadas'
                  : 'No hay tareas pendientes'}
              </div>
            )}
          />

          {filteredTasks.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl py-12 text-center">
              <p className="text-gray-500 text-sm">
                {filter === 'done'
                  ? 'No hay tareas completadas todavía'
                  : filter === 'pending'
                  ? 'No hay tareas pendientes'
                  : 'No hay tareas en este proyecto'}
              </p>
              {filter !== 'done' && (
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="mt-3 text-violet-400 hover:text-violet-300 text-sm transition"
                >
                  + Crear primera tarea
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {showTaskModal && (
        <NewTaskModal
          projectId={id}
          onClose={() => setShowTaskModal(false)}
          onCreated={onTaskCreated}
        />
      )}
    </div>
  )
}
