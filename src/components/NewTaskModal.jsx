import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Loader2 } from 'lucide-react'

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
      .insert({
        project_id: projectId,
        user_id: user.id,
        title: title.trim(),
        priority,
        due_date: dueDate || null,
        done: false,
      })
      .select()
      .single()

    if (error) {
      toast.error('Error al crear la tarea')
    } else {
      onCreated(data)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-white font-semibold">Nueva tarea</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Descripción de la tarea *</label>
            <input
              autoFocus
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Prioridad</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Fecha límite</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition text-sm"
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
