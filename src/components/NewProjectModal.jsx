import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Loader2 } from 'lucide-react'

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
      .insert({
        user_id: user.id,
        name: name.trim(),
        status,
        deadline: deadline || null,
        description: description.trim() || null,
      })
      .select()
      .single()

    if (error) {
      toast.error('Error al crear el proyecto')
    } else {
      toast.success('Proyecto creado')
      onCreated(data)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-white font-semibold">Nuevo proyecto</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nombre del proyecto / cliente *</label>
            <input
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Acme Corp, Proyecto Alpha..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Estado</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              >
                <option value="on_track">On track</option>
                <option value="at_risk">At risk</option>
                <option value="blocked">Blocked</option>
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
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Descripción <span className="text-gray-600">(opcional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Contexto breve..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition resize-none"
            />
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
              disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition text-sm"
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
