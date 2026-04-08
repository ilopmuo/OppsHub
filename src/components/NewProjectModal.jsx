import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Loader2, ArrowLeft, Wrench, Rocket, LayoutGrid } from 'lucide-react'
import ProjectIconUpload from './ProjectIconUpload'

const TEMPLATES = {
  implementation: [
    {
      id: 'blank',
      label: 'En blanco',
      description: 'Sin tareas predefinidas',
      tasks: [],
    },
    {
      id: 'web',
      label: 'Proyecto web',
      description: 'Kickoff → Diseño → Dev → QA → Entrega',
      tasks: [
        { title: 'Reunión de kickoff', priority: 'high' },
        { title: 'Análisis de requisitos', priority: 'high' },
        { title: 'Diseño y prototipo', priority: 'medium' },
        { title: 'Desarrollo frontend', priority: 'medium' },
        { title: 'Desarrollo backend', priority: 'medium' },
        { title: 'Testing y QA', priority: 'medium' },
        { title: 'Despliegue a producción', priority: 'high' },
      ],
    },
    {
      id: 'onboarding',
      label: 'Onboarding cliente',
      description: 'Bienvenida → Configuración → Formación → Go-live',
      tasks: [
        { title: 'Reunión de bienvenida', priority: 'high' },
        { title: 'Recopilación de datos del cliente', priority: 'high' },
        { title: 'Configuración inicial', priority: 'medium' },
        { title: 'Sesión de formación', priority: 'medium' },
        { title: 'Pruebas con el cliente', priority: 'medium' },
        { title: 'Go-live y cierre', priority: 'high' },
      ],
    },
  ],
  maintenance: [
    {
      id: 'blank',
      label: 'En blanco',
      description: 'Sin tareas predefinidas',
      tasks: [],
    },
    {
      id: 'sla',
      label: 'SLA básico',
      description: 'Revisiones y seguimiento de incidencias',
      tasks: [
        { title: 'Revisión mensual de servicio', priority: 'high' },
        { title: 'Control de incidencias abiertas', priority: 'medium' },
        { title: 'Actualización de dependencias', priority: 'low' },
        { title: 'Informe de estado al cliente', priority: 'medium' },
      ],
    },
    {
      id: 'enterprise',
      label: 'Cuenta enterprise',
      description: 'SLA + business review trimestral',
      tasks: [
        { title: 'Revisión mensual de servicio', priority: 'high' },
        { title: 'Control de incidencias', priority: 'high' },
        { title: 'Business review trimestral', priority: 'high' },
        { title: 'Plan de mejora continua', priority: 'medium' },
        { title: 'Actualización de documentación', priority: 'low' },
        { title: 'Renovación / negociación contrato', priority: 'high' },
      ],
    },
  ],
}

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
  const [closing, setClosing] = useState(false)
  const [step, setStep] = useState('type') // 'type' | 'template' | 'form'
  const [type, setType] = useState(null)
  const [template, setTemplate] = useState('blank')

  // Shared fields
  const [name, setName] = useState('')
  const [status, setStatus] = useState('on_track')
  const [startDate, setStartDate] = useState('')
  const [description, setDescription] = useState('')
  // Implementation
  const [deadline, setDeadline] = useState('')
  // Maintenance
  const [renewalDate, setRenewalDate] = useState('')
  const [slaStatus, setSlaStatus] = useState('ok')
  const [lastContact, setLastContact] = useState('')

  const [iconUrl, setIconUrl] = useState(null)
  const [saving, setSaving] = useState(false)

  function handleClose() { setClosing(true); setTimeout(onClose, 170) }

  function selectType(t) {
    setType(t)
    setTemplate('blank')
    setStep('template')
  }

  function selectTemplate(tpl) {
    setTemplate(tpl)
    setStep('form')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const payload = {
      user_id: user.id,
      name: name.trim(),
      status,
      type,
      start_date: startDate || null,
      description: description.trim() || null,
      deadline: type === 'implementation' ? (deadline || null) : null,
      renewal_date: type === 'maintenance' ? (renewalDate || null) : null,
      sla_status: type === 'maintenance' ? slaStatus : null,
      last_contact: type === 'maintenance' ? (lastContact || null) : null,
      icon_url: iconUrl || null,
    }

    const { data, error } = await supabase.from('projects').insert(payload).select().single()
    if (error) { toast.error('Error al crear el proyecto'); setSaving(false); return }

    // Insert template tasks
    const tplDef = TEMPLATES[type]?.find(t => t.id === template)
    if (tplDef?.tasks?.length > 0) {
      await supabase.from('tasks').insert(
        tplDef.tasks.map(t => ({
          project_id: data.id,
          user_id: user.id,
          title: t.title,
          priority: t.priority,
          status: 'todo',
          done: false,
        }))
      )
    }

    toast.success('Proyecto creado')
    onCreated(data)
    setSaving(false)
  }

  const anim = closing ? 'modal-out' : 'modal-in'
  const dur = closing ? '0.17s ease' : '0.22s cubic-bezier(0.16,1,0.3,1)'

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
        {/* Handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            {(step === 'template' || step === 'form') && (
              <button
                onClick={() => setStep(step === 'form' ? 'template' : 'type')}
                className="p-1 rounded-lg transition-all"
                style={{ color: '#6e6e73' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
                onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-semibold text-base" style={{ color: '#f5f5f7' }}>
              {step === 'type' ? 'Nuevo proyecto' : step === 'template' ? 'Plantilla' : type === 'implementation' ? 'Implementación' : 'Mantenimiento'}
            </h2>
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

        {/* Step 1 — Type selector */}
        {step === 'type' && (
          <div className="p-6 space-y-3">
            <p className="text-sm mb-4" style={{ color: '#6e6e73' }}>¿Qué tipo de proyecto es?</p>

            <button
              onClick={() => selectType('implementation')}
              className="w-full text-left p-4 rounded-2xl transition-all group"
              style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#161616'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#1a1a1a' }}>
                  <Rocket className="w-4 h-4" style={{ color: '#f5f5f7' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5" style={{ color: '#f5f5f7' }}>Implementación</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#6e6e73' }}>
                    Proyecto con fecha de entrega, fases e hitos. Ideal para despliegues y proyectos acotados en el tiempo.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => selectType('maintenance')}
              className="w-full text-left p-4 rounded-2xl transition-all group"
              style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#161616'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#1a1a1a' }}>
                  <Wrench className="w-4 h-4" style={{ color: '#f5f5f7' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5" style={{ color: '#f5f5f7' }}>Mantenimiento</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#6e6e73' }}>
                    Proyecto continuo con SLA, renovación de contrato y seguimiento de incidencias.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step 2 — Template */}
        {step === 'template' && (
          <div className="p-6 space-y-3">
            <p className="text-sm mb-4" style={{ color: '#6e6e73' }}>¿Con qué plantilla quieres empezar?</p>
            {(TEMPLATES[type] || []).map(tpl => (
              <button
                key={tpl.id}
                onClick={() => selectTemplate(tpl.id)}
                className="w-full text-left p-4 rounded-2xl transition-all"
                style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#161616'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#1a1a1a' }}>
                    <LayoutGrid className="w-4 h-4" style={{ color: tpl.id === 'blank' ? '#3a3a3a' : '#f5f5f7' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-0.5" style={{ color: '#f5f5f7' }}>{tpl.label}</p>
                    <p className="text-xs" style={{ color: '#6e6e73' }}>{tpl.description}</p>
                    {tpl.tasks.length > 0 && (
                      <p className="text-xs mt-1.5" style={{ color: '#3a3a3a' }}>
                        {tpl.tasks.length} tarea{tpl.tasks.length !== 1 ? 's' : ''} incluida{tpl.tasks.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Icon + name row */}
            <div className="flex items-center gap-3">
              <ProjectIconUpload iconUrl={iconUrl} onChange={setIconUrl} size={56} />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Nombre *</label>
                <input
                autoFocus required value={name} onChange={e => setName(e.target.value)}
                placeholder="Ej: Acme Corp, Proyecto Alpha..."
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <option value="on_track">On track</option>
                  <option value="at_risk">At risk</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Fecha de inicio</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>

              {/* Implementation: deadline */}
              {type === 'implementation' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Deadline</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  />
                </div>
              )}

              {/* Maintenance: renewal date */}
              {type === 'maintenance' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Renovación</label>
                  <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  />
                </div>
              )}
            </div>

            {/* Maintenance extra fields */}
            {type === 'maintenance' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Estado SLA</label>
                  <select value={slaStatus} onChange={e => setSlaStatus(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  >
                    <option value="ok">Cumpliendo</option>
                    <option value="at_risk">En riesgo</option>
                    <option value="breach">Incumpliendo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Último contacto</label>
                  <input type="date" value={lastContact} onChange={e => setLastContact(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
                Descripción <span style={{ color: '#3a3a3a' }}>(opcional)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Contexto breve..." style={{ ...inputStyle, resize: 'none' }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: '#2a2a2a', color: '#6e6e73' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = '#333' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving || !name.trim()}
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
        )}
      </div>
    </div>
  )
}
