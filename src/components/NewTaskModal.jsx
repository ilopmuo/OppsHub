import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Loader2 } from 'lucide-react'

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

export default function NewTaskModal({ projectId, defaultStatus = 'todo', members = [], onClose, onCreated }) {
  const { user } = useAuth()
  const [closing, setClosing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState(user?.id || '')
  const [saving, setSaving] = useState(false)

  const hasTeam = members.length > 1

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        status: defaultStatus,
        done: defaultStatus === 'done',
        assignee_id: assigneeId || user.id,
      })
      .select('*, assignee:assignee_id(id, email, display_name)')
      .single()
    if (error) { toast.error('Error al crear la tarea') } else { onCreated(data) }
    setSaving(false)
  }

  function handleClose() { setClosing(true); setTimeout(onClose, 170) }
  const anim = closing ? 'modal-out' : 'modal-in'
  const dur  = closing ? '0.17s ease' : '0.22s cubic-bezier(0.16,1,0.3,1)'

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: `${closing ? 'backdrop-out' : 'backdrop-in'} 0.17s ease both` }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', animation: `${anim} ${dur} both` }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-base" style={{ color: '#f5f5f7' }}>Nueva tarea</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Tarea *</label>
            <input
              autoFocus required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Descripción <span style={{ color: '#3a3a3a' }}>(opcional)</span></label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Contexto, detalles, enlaces..."
              style={{ ...inputStyle, resize: 'none' }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Prioridad</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
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
          </div>

          {hasTeam && (
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Asignado a</label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.email}{m.id === user?.id ? ' (tú)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: '#2a2a2a', color: '#6e6e73' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: title.trim() && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.15)',
                color: title.trim() && !saving ? '#000000' : '#6e6e73',
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
