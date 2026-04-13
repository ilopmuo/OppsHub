import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { X, Loader2, LayoutList, Link2 } from 'lucide-react'
import { today } from '../hooks/usePlan'

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

export default function NewPlanModal({ onClose, onCreated, projectId: prefilledProjectId = null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [closing,   setClosing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [projects,  setProjects]  = useState([])

  // Form fields
  const [name,        setName]        = useState('')
  const [clientName,  setClientName]  = useState('')
  const [startDate,   setStartDate]   = useState(today())
  const [linkedProject, setLinkedProject] = useState(prefilledProjectId || '')

  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')
      setProjects(data || [])
    }
    fetchProjects()
  }, [])

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 170)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const payload = {
      owner_id:   user.id,
      name:       name.trim(),
      client_name: clientName.trim() || null,
      start_date: startDate,
      project_id: linkedProject || null,
    }

    const { data, error } = await supabase
      .from('project_plans')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error('Error al crear el plan')
      setSaving(false)
      return
    }

    toast.success('Plan creado')
    setSaving(false)
    setClosing(true)
    setTimeout(() => {
      if (onCreated) onCreated(data)
      navigate(`/plans/${data.id}`)
    }, 170)
  }

  const anim = closing ? 'modal-out' : 'modal-in'
  const dur  = closing ? '0.17s ease' : '0.22s cubic-bezier(0.16,1,0.3,1)'

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 z-50"
      style={{
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: `${closing ? 'backdrop-out' : 'backdrop-in'} 0.17s ease both`,
      }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.08)',
          animation: `${anim} ${dur} both`,
        }}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#2a2a2a' }}>
              <LayoutList className="w-4 h-4" style={{ color: '#bf5af2' }} />
            </div>
            <h2 className="font-semibold text-base" style={{ color: '#f5f5f7' }}>Nuevo plan</h2>
          </div>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Plan name */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
              Nombre del plan <span style={{ color: '#ff453a' }}>*</span>
            </label>
            <input
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Plan de implementación Q2, Roadmap 2026..."
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Client name */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
              Cliente <span style={{ color: '#3a3a3a' }}>(opcional)</span>
            </label>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nombre del cliente..."
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
              Fecha de inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Linked project */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
              <div className="flex items-center gap-1.5">
                <Link2 className="w-3 h-3" />
                Vincular a proyecto <span style={{ color: '#3a3a3a' }}>(opcional)</span>
              </div>
            </label>
            <select
              value={linkedProject}
              onChange={e => setLinkedProject(e.target.value)}
              style={{ ...inputStyle, appearance: 'none' }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            >
              <option value="">Sin vincular (plan independiente)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
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
              Crear plan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
