import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Link2, Copy, Check, AlertTriangle, Flag, CalendarDays } from 'lucide-react'
import PlanPhaseTaskList from './PlanPhaseTaskList'
import { calcEndDateFromHours, workingDaysBetween, addDays } from '../hooks/usePlan'
import toast from 'react-hot-toast'

const PHASE_COLORS = ['#bf5af2', '#64d2ff', '#30d158', '#ff9f0a', '#ff453a', '#ff6b35', '#0ea5e9']

const inputStyle = {
  backgroundColor: '#000000',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f5f5f7',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
}

function PhaseItem({ phase, minStartDate, onUpdatePhase, onDeletePhase, onOpenCalendar, onAddTask, onUpdateTask, onDeleteTask }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Phase header */}
      <div className="flex items-center gap-2 p-3">
        {/* Color dot */}
        <div className="relative shrink-0">
          <div
            className="w-3 h-3 rounded-full cursor-pointer"
            style={{ backgroundColor: phase.color || '#bf5af2' }}
            title="Color"
          />
        </div>

        {/* Name */}
        <input
          value={phase.name}
          onChange={e => onUpdatePhase(phase.id, { name: e.target.value })}
          className="flex-1 min-w-0 text-sm font-medium bg-transparent outline-none"
          style={{ color: '#f5f5f7', border: 'none' }}
        />

        {/* Calendar */}
        <button
          onClick={() => onOpenCalendar(phase)}
          title="Ver días de trabajo"
          className="p-1 rounded transition-colors shrink-0"
          style={{ color: '#3a3a3a' }}
          onMouseEnter={e => e.currentTarget.style.color = '#6e6e73'}
          onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
        >
          <CalendarDays className="w-3.5 h-3.5" />
        </button>

        {/* Sprint toggle */}
        <button
          onClick={() => onUpdatePhase(phase.id, { is_sprint: !phase.is_sprint })}
          title={phase.is_sprint ? 'Quitar marcador de sprint' : 'Marcar como sprint (no puede ser solapada)'}
          className="p-1 rounded transition-colors shrink-0"
          style={{ color: phase.is_sprint ? '#ff9f0a' : '#3a3a3a' }}
          onMouseEnter={e => e.currentTarget.style.color = phase.is_sprint ? '#ffb340' : '#6e6e73'}
          onMouseLeave={e => e.currentTarget.style.color = phase.is_sprint ? '#ff9f0a' : '#3a3a3a'}
        >
          <Flag className="w-3.5 h-3.5" />
        </button>

        {/* Expand tasks */}
        <button
          onClick={() => setOpen(v => !v)}
          className="p-1 rounded transition-colors shrink-0"
          style={{ color: '#6e6e73' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
          onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDeletePhase(phase.id)}
          className="p-1 rounded transition-colors shrink-0"
          style={{ color: '#3a3a3a' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
          onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Phase dates & hours */}
      <div
        className="px-3 pb-3 space-y-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Row 1: dates */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Inicio</label>
            <input
              type="date"
              value={phase.start_date}
              min={phase.is_sprint ? minStartDate : undefined}
              onChange={e => onUpdatePhase(phase.id, { start_date: e.target.value })}
              style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Fin</label>
            <input
              type="date"
              value={phase.end_date}
              min={phase.is_sprint ? phase.start_date : undefined}
              onChange={e => onUpdatePhase(phase.id, { end_date: e.target.value }, { cascade: true })}
              style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
        </div>

        {/* Row 2: hours */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Horas totales</label>
            <input
              type="number"
              min="0"
              step="1"
              value={phase.hours || ''}
              placeholder="0"
              onChange={e => onUpdatePhase(phase.id, { hours: parseFloat(e.target.value) || 0 })}
              style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Horas/día</label>
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={phase.hours_per_day ?? 8}
              onChange={e => onUpdatePhase(phase.id, { hours_per_day: parseFloat(e.target.value) || 8 })}
              style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
        </div>

        {/* Working days info */}
        {phase.hours > 0 && (phase.hours_per_day ?? 8) > 0 && (() => {
          const autoEnd = calcEndDateFromHours(phase.start_date, phase.hours, phase.hours_per_day ?? 8)
          const laborables = workingDaysBetween(phase.start_date, phase.end_date)
          const autoMatch = autoEnd === phase.end_date
          return (
            <div
              className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs"
              style={{
                backgroundColor: autoMatch ? 'rgba(48,209,88,0.06)' : 'rgba(255,159,10,0.06)',
                border: `1px solid ${autoMatch ? 'rgba(48,209,88,0.15)' : 'rgba(255,159,10,0.15)'}`,
              }}
            >
              <span style={{ color: '#6e6e73' }}>
                {Math.ceil(phase.hours / (phase.hours_per_day ?? 8))} días necesarios
              </span>
              <span style={{ color: autoMatch ? '#30d158' : '#ff9f0a' }}>
                {laborables} días laborables
              </span>
            </div>
          )
        })()}
      </div>

      {/* Color picker */}
      <div className="px-3 pb-3">
        <div className="flex gap-2 flex-wrap">
          {PHASE_COLORS.map(c => (
            <button
              key={c}
              onClick={() => onUpdatePhase(phase.id, { color: c })}
              className="w-5 h-5 rounded-full transition-transform"
              style={{
                backgroundColor: c,
                outline: phase.color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
                transform: phase.color === c ? 'scale(1.2)' : 'scale(1)',
              }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Task list */}
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <PlanPhaseTaskList
            phase={phase}
            isEditable={true}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        </div>
      )}
    </div>
  )
}

export default function PlanSidebar({
  plan,
  phases,
  onUpdatePlan,
  onUpdatePhase,
  onAddPhase,
  onDeletePhase,
  onOpenCalendar,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onDeletePlan,
  onPrint,
}) {
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const shareUrl = `${window.location.origin}/plans/${plan.share_token}/view`

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Enlace copiado')
    })
  }

  const totalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)

  return (
    <div
      className="flex flex-col gap-5 overflow-y-auto"
      style={{ height: '100%', paddingBottom: 24 }}
    >
      {/* ── Plan metadata ──────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
          Detalles del plan
        </h3>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#6e6e73' }}>Nombre</label>
          <input
            value={plan.name}
            onChange={e => onUpdatePlan({ name: e.target.value })}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#6e6e73' }}>Cliente</label>
          <input
            value={plan.client_name || ''}
            onChange={e => onUpdatePlan({ client_name: e.target.value || null })}
            placeholder="Nombre del cliente..."
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#6e6e73' }}>Fecha de inicio</label>
          <input
            type="date"
            value={plan.start_date}
            onChange={e => onUpdatePlan({ start_date: e.target.value })}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#6e6e73' }}>Descripción</label>
          <textarea
            value={plan.description || ''}
            onChange={e => onUpdatePlan({ description: e.target.value || null })}
            placeholder="Contexto del plan..."
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>

        {totalHours > 0 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs" style={{ color: '#6e6e73' }}>Total de horas</span>
            <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>{totalHours}h</span>
          </div>
        )}
      </div>

      {/* ── Phases ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
            Fases ({phases.length})
          </h3>
          {totalHours > 0 && (
            <span className="text-xs" style={{ color: '#6e6e73' }}>{totalHours}h total</span>
          )}
        </div>

        <div className="space-y-2">
          {phases.map((phase, idx) => (
            <PhaseItem
              key={phase.id}
              phase={phase}
              minStartDate={idx > 0 ? addDays(phases[idx - 1].end_date, 1) : undefined}
              onUpdatePhase={onUpdatePhase}
              onDeletePhase={onDeletePhase}
              onOpenCalendar={onOpenCalendar}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>

        <button
          onClick={onAddPhase}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            color: '#6e6e73',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
        >
          <Plus className="w-4 h-4" />
          Añadir fase
        </button>
      </div>

      {/* ── Share ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5" style={{ color: '#6e6e73' }} />
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
            Compartir con cliente
          </h3>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="flex-1 min-w-0 text-xs truncate"
            style={{ color: '#6e6e73', fontFamily: 'monospace' }}
          >
            {shareUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="shrink-0 p-1 rounded-lg transition-all"
            style={{ color: copied ? '#30d158' : '#6e6e73' }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.color = '#f5f5f7' }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.color = '#6e6e73' }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <p className="text-xs" style={{ color: '#3a3a3a' }}>
          El cliente puede ver el plan en modo lectura sin necesidad de cuenta.
        </p>

        <button
          onClick={onPrint}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#f5f5f7' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
        >
          Exportar PDF
        </button>
      </div>

      {/* ── Danger zone ────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-all"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
            onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar plan
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)' }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#ff453a' }} />
              <p className="text-xs" style={{ color: '#ff453a' }}>
                Esto eliminará el plan y todas sus fases permanentemente. ¿Continuar?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl text-sm transition-all"
                style={{ backgroundColor: '#2a2a2a', color: '#6e6e73' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#333'; e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#2a2a2a'; e.currentTarget.style.color = '#6e6e73' }}
              >
                Cancelar
              </button>
              <button
                onClick={onDeletePlan}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: 'rgba(255,69,58,0.15)', color: '#ff453a' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.25)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.15)'}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
