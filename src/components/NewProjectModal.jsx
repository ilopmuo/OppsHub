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

export default function NewProjectModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [status, setStatus] = useState('on_track')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: name.trim(), status, deadline: deadline || null, description: description.trim() || null })
      .select().single()
    if (error) { toast.error('Error al crear el proyecto') } else { toast.success('Proyecto creado'); onCreated(data) }
    setSaving(false)
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

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-base" style={{ color: '#f5f5f7' }}>Nuevo proyecto</h2>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Nombre *</label>
            <input
              autoFocus required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Acme Corp, Proyecto Alpha..."
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
                <option value="on_track">On track</option>
                <option value="at_risk">At risk</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
              Descripción <span style={{ color: '#3a3a3a' }}>(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Contexto breve..."
              style={{ ...inputStyle, resize: 'none' }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

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
              disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: name.trim() && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.15)',
                color: name.trim() && !saving ? '#000000' : '#6e6e73',
                cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear proyecto
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
