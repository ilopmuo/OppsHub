import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Loader2 } from 'lucide-react'

const C = {
  bg: '#0d1b2a',
  surface: '#1b263b',
  border: '#415a77',
  muted: '#778da9',
  text: '#e0e1dd',
}

const inputClass = "w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
const inputStyle = { backgroundColor: C.bg, border: `1px solid ${C.border}50`, color: C.text }

export default function NewTaskModal({ projectId, onClose, onCreated }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('tasks')
      .insert({ project_id: projectId, user_id: user.id, title: title.trim(), priority, due_date: dueDate || null, done: false })
      .select().single()
    if (error) { toast.error('Error al crear la tarea') } else { onCreated(data) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(13,27,42,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}40` }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${C.border}25` }}>
          <div>
            <h2 className="font-semibold" style={{ color: C.text }}>Nueva tarea</h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>Añade una tarea al proyecto</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: C.muted }}
            onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.backgroundColor = `${C.border}20` }}
            onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: C.muted }}>
              Descripción de la tarea *
            </label>
            <input
              autoFocus required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className={inputClass}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.muted}
              onBlur={e => e.target.style.borderColor = `${C.border}50`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: C.muted }}>Prioridad</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className={inputClass}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.muted}
                onBlur={e => e.target.style.borderColor = `${C.border}50`}
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: C.muted }}>Fecha límite</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.muted}
                onBlur={e => e.target.style.borderColor = `${C.border}50`}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: `${C.border}20`, color: C.muted, border: `1px solid ${C.border}30` }}
              onMouseEnter={e => e.currentTarget.style.color = C.text}
              onMouseLeave={e => e.currentTarget.style.color = C.muted}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: title.trim() && !saving ? C.border : `${C.border}40`,
                color: title.trim() && !saving ? C.text : `${C.text}50`,
                cursor: title.trim() && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear tarea
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
