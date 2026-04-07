import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MilestoneList({ projectId, milestones, onChange }) {
  const { user } = useAuth()
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('milestones')
      .insert({ project_id: projectId, user_id: user.id, title: newTitle.trim(), done: false })
      .select().single()
    if (error) { toast.error('Error al crear el hito') } else {
      onChange([...milestones, data])
      setNewTitle('')
    }
    setAdding(false)
  }

  async function handleToggle(id, done) {
    const { error } = await supabase.from('milestones').update({ done }).eq('id', id)
    if (!error) onChange(milestones.map(m => m.id === id ? { ...m, done } : m))
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (!error) { onChange(milestones.filter(m => m.id !== id)); toast.success('Hito eliminado') }
  }

  const completed = milestones.filter(m => m.done).length
  const total = milestones.length

  return (
    <div>
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#f5f5f7' }}>Hitos</h2>
          {total > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1a1a1a', color: '#6e6e73', border: '1px solid rgba(255,255,255,0.06)' }}>
              {completed}/{total}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-5">
          <div className="h-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(completed / total * 100)}%`,
                backgroundColor: completed === total ? '#30d158' : 'rgba(255,255,255,0.3)',
              }}
            />
          </div>
        </div>
      )}

      {/* Milestone list */}
      {milestones.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {milestones.map(m => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl group transition-all"
              style={{
                backgroundColor: '#111111',
                border: '1px solid rgba(255,255,255,0.06)',
                opacity: m.done ? 0.45 : 1,
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(m.id, !m.done)}
                className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all"
                style={{
                  backgroundColor: m.done ? '#f5f5f7' : 'transparent',
                  border: `1.5px solid ${m.done ? '#f5f5f7' : 'rgba(255,255,255,0.2)'}`,
                }}
                onMouseEnter={e => { if (!m.done) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)' }}
                onMouseLeave={e => { if (!m.done) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              >
                {m.done && (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth={3}>
                    <path className="milestone-tick" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Title */}
              <span
                className="flex-1 text-sm"
                style={{
                  color: m.done ? '#6e6e73' : '#f5f5f7',
                  textDecoration: m.done ? 'line-through' : 'none',
                }}
              >
                {m.title}
              </span>

              {/* Delete */}
              <button
                onClick={() => handleDelete(m.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: '#6e6e73' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Añadir hito..."
          className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            backgroundColor: '#111111',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f5f5f7',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0"
          style={{
            backgroundColor: newTitle.trim() ? '#f5f5f7' : 'rgba(245,245,247,0.1)',
            color: newTitle.trim() ? '#000000' : '#6e6e73',
            cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Añadir
        </button>
      </form>
    </div>
  )
}
