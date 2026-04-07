import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Loader2, Trash2, Send } from 'lucide-react'

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

const fi = e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'
const fo = e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'

const STATUS_OPTIONS = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'todo',        label: 'Por hacer' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'done',        label: 'Hecho' },
]

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low',    label: 'Baja' },
]

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function initials(email) {
  if (!email) return '?'
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

export default function TaskDetailModal({ task, onClose, onUpdated, onDeleted, members = [] }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('details')

  // Detail fields
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id || task.assignee_id || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Comments
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const commentsEndRef = useRef(null)

  const currentAssigneeId = task.assignee?.id || task.assignee_id || ''
  const isDirty = title !== task.title || description !== (task.description || '')
    || status !== task.status || priority !== task.priority
    || dueDate !== (task.due_date || '') || assigneeId !== currentAssigneeId

  useEffect(() => {
    if (tab === 'comments') fetchComments()
  }, [tab])

  async function fetchComments() {
    setLoadingComments(true)
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoadingComments(false)
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate || null,
      assignee_id: assigneeId || null,
    }
    const { error } = await supabase.from('tasks').update(payload).eq('id', task.id)
    if (error) {
      toast.error('Error al guardar')
    } else {
      // Notify new assignee if changed
      if (assigneeId && assigneeId !== currentAssigneeId && assigneeId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: assigneeId,
          type: 'task_assigned',
          project_id: task.project_id,
          task_id: task.id,
          message: `Se te asignó la tarea "${title.trim()}"`,
        })
      }
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

  async function handleSendComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSendingComment(true)
    const { data, error } = await supabase
      .from('task_comments')
      .insert({ task_id: task.id, user_id: user.id, content: newComment.trim() })
      .select().single()
    if (error) {
      toast.error('Error al enviar')
    } else {
      setComments(prev => [...prev, data])
      setNewComment('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      // Notify assignee if different from commenter
      const notifyId = task.assignee?.id || task.assignee_id
      if (notifyId && notifyId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: notifyId,
          type: 'comment_added',
          project_id: task.project_id,
          task_id: task.id,
          message: `Nuevo comentario en "${task.title}"`,
        })
      }
    }
    setSendingComment(false)
  }

  async function handleDeleteComment(id) {
    const { error } = await supabase.from('task_comments').delete().eq('id', id)
    if (!error) setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: '#111111' }}>
            {[{ key: 'details', label: 'Detalles' }, { key: 'comments', label: `Comentarios${comments.length > 0 ? ` (${comments.length})` : ''}` }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-3 py-1 text-sm rounded-lg font-medium transition-all"
                style={{
                  backgroundColor: tab === t.key ? '#2a2a2a' : 'transparent',
                  color: tab === t.key ? '#f5f5f7' : '#6e6e73',
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'transparent' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab: Details */}
        {tab === 'details' && (
          <div className="overflow-y-auto flex-1">
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Tarea</label>
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                  style={inputStyle} onFocus={fi} onBlur={fo} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
                  Descripción <span style={{ color: '#3a3a3a' }}>(opcional)</span>
                </label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Contexto, detalles, enlaces..."
                  style={{ ...inputStyle, resize: 'none' }} onFocus={fi} onBlur={fo} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Prioridad</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo}>
                    {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Fecha límite</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Asignado a</label>
                  {members.length > 0 ? (
                    <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo}>
                      <option value="">Sin asignar</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.display_name || m.email}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                      placeholder="Sin miembros aún..."
                      disabled style={{ ...inputStyle, color: '#3a3a3a' }} />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 pb-6 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: '#6e6e73' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Eliminar
              </button>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ backgroundColor: '#2a2a2a', color: '#6e6e73' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#333' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !title.trim() || !isDirty}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: isDirty && title.trim() && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.15)',
                    color: isDirty && title.trim() && !saving ? '#000000' : '#6e6e73',
                    cursor: isDirty && title.trim() && !saving ? 'pointer' : 'not-allowed',
                  }}>
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Comments */}
        {tab === 'comments' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingComments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6e6e73' }} />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: '#6e6e73' }}>
                  Sin comentarios. Sé el primero.
                </p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex items-start gap-3 group">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold"
                      style={{ backgroundColor: '#2a2a2a', color: '#f5f5f7' }}>
                      {initials(user?.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-medium" style={{ color: '#f5f5f7' }}>
                          {user?.email?.split('@')[0]}
                        </span>
                        <span className="text-xs" style={{ color: '#3a3a3a' }}>{formatTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: '#c0c0c0' }}>{c.content}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-all p-1 rounded"
                      style={{ color: '#6e6e73' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendComment}
              className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: '#f5f5f7' }}
              />
              <button type="submit" disabled={!newComment.trim() || sendingComment}
                className="p-2 rounded-xl transition-all"
                style={{
                  backgroundColor: newComment.trim() ? '#f5f5f7' : '#2a2a2a',
                  color: newComment.trim() ? '#000000' : '#6e6e73',
                }}>
                {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
