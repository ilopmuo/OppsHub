import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { X, Loader2, Trash2 } from 'lucide-react'

const inputStyle = {
  backgroundColor: '#000000',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f5f5f7',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
}

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'Por hacer' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'done',        label: 'Hecho' },
]

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low',    label: 'Baja' },
]

export default function TaskDetailModal({ task, onClose, onUpdated, onDeleted }) {
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isDirty = title !== task.title || status !== task.status
    || priority !== task.priority || dueDate !== (task.due_date || '')

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const payload = { title: title.trim(), status, priority, due_date: dueDate || null }
    const { error } = await supabase.from('tasks').update(payload).eq('id', task.id)
    if (error) {
      toast.error('Error al guardar')
    } else {
      onUpdated({ ...task, ...payload })
      onClose()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta tarea?')) return
    setDeleting(true)
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) {
      toast.error('Error al eliminar')
    } else {
      onDeleted(task.id)
      onClose()
    }
    setDeleting(false)
  }

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-base" style={{ color: '#f5f5f7' }}>Detalle de tarea</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Tarea</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Prioridad</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Fecha límite</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Eliminar
            </button>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: '#2a2a2a', color: '#6e6e73' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#333' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !isDirty}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: isDirty && title.trim() && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.15)',
                  color: isDirty && title.trim() && !saving ? '#000000' : '#6e6e73',
                  cursor: isDirty && title.trim() && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
