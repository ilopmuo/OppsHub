import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Link2, Copy, Check, AlertTriangle, Flag, CalendarDays, GitBranch, RotateCcw, CheckCircle2, Diamond, AlignLeft, GitMerge } from 'lucide-react'
import PlanPhaseTaskList from './PlanPhaseTaskList'
import { calcEndDateFromHours, workingDaysBetween, addDays, daysBetween, computePhaseStatus } from '../hooks/usePlan'
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

function PhaseItem({ phase, minStartDate, baselinePhase, allPhases, onUpdatePhase, onDeletePhase, onOpenCalendar, onAddTask, onUpdateTask, onDeleteTask }) {
  const [open, setOpen] = useState(false)

  const effectiveStatus = computePhaseStatus(phase)
  const isAutoStatus    = !phase.is_milestone && effectiveStatus !== (phase.status ?? 'on_track')
  const STATUS_META = {
    on_track: { label: 'En plazo',   color: '#30d158' },
    at_risk:  { label: 'En riesgo',  color: '#ff9f0a' },
    delayed:  { label: 'Retrasado',  color: '#ff453a' },
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Phase header */}
      <div className="flex items-center gap-2 p-3">
        {/* Phase type indicator */}
        {phase.is_milestone ? (
          <div
            className="shrink-0"
            style={{
              width: 12, height: 12,
              transform: 'rotate(45deg)',
              backgroundColor: phase.color || '#ff9f0a',
              borderRadius: 2,
            }}
          />
        ) : (
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: phase.color || '#bf5af2' }}
          />
        )}

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
        {/* Dates */}
        {phase.is_milestone ? (
          <div className="pt-2">
            <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Fecha del hito</label>
            <input
              type="date"
              value={phase.start_date}
              onChange={e => { if (e.target.value) onUpdatePhase(phase.id, { start_date: e.target.value, end_date: e.target.value }) }}
              style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Inicio</label>
                <input
                  type="date"
                  value={phase.start_date}
                  min={phase.is_sprint ? minStartDate : undefined}
                  onChange={e => {
                    const val = e.target.value
                    if (!val) return
                    const effective = (phase.is_sprint && minStartDate && val < minStartDate) ? minStartDate : val
                    onUpdatePhase(phase.id, { start_date: effective })
                  }}
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Horas totales</label>
                <input
                  type="number" min="0" step="1"
                  value={phase.hours || ''} placeholder="0"
                  onChange={e => onUpdatePhase(phase.id, { hours: parseFloat(e.target.value) || 0 })}
                  style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Horas/día</label>
                <input
                  type="number" min="1" max="24" step="0.5"
                  value={phase.hours_per_day ?? 8}
                  onChange={e => onUpdatePhase(phase.id, { hours_per_day: parseFloat(e.target.value) || 8 })}
                  style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            </div>

            {phase.hours > 0 && (phase.hours_per_day ?? 8) > 0 && (() => {
              const autoEnd    = calcEndDateFromHours(phase.start_date, phase.hours, phase.hours_per_day ?? 8)
              const laborables = workingDaysBetween(phase.start_date, phase.end_date)
              const autoMatch  = autoEnd === phase.end_date
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
          </>
        )}

        {/* Baseline deviation banner */}
        {baselinePhase && (() => {
          const startDev = daysBetween(baselinePhase.start_date, phase.start_date)
          const endDev   = daysBetween(baselinePhase.end_date,   phase.end_date)
          if (startDev === 0 && endDev === 0) return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs"
              style={{ backgroundColor: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.15)' }}>
              <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: '#30d158' }} />
              <span style={{ color: '#30d158' }}>En plazo con el plan base</span>
            </div>
          )
          const delayed = startDev > 0
          return (
            <div className="px-2 py-1.5 rounded-lg text-xs space-y-0.5"
              style={{
                backgroundColor: delayed ? 'rgba(255,69,58,0.06)' : 'rgba(48,209,88,0.06)',
                border: `1px solid ${delayed ? 'rgba(255,69,58,0.2)' : 'rgba(48,209,88,0.2)'}`,
              }}>
              <div className="flex items-center justify-between">
                <span style={{ color: '#6e6e73' }}>Inicio</span>
                <span style={{ color: delayed ? '#ff453a' : '#30d158', fontWeight: 600 }}>
                  {startDev > 0 ? `+${startDev}d` : startDev < 0 ? `${startDev}d` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: '#6e6e73' }}>Fin</span>
                <span style={{ color: endDev > 0 ? '#ff453a' : endDev < 0 ? '#30d158' : '#6e6e73', fontWeight: 600 }}>
                  {endDev > 0 ? `+${endDev}d` : endDev < 0 ? `${endDev}d` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#3a3a3a' }}>Plan base</span>
                <span style={{ color: '#3a3a3a' }}>{baselinePhase.start_date} → {baselinePhase.end_date}</span>
              </div>
            </div>
          )
        })()}

        {/* Progress + Status (hidden for milestones) */}
        {!phase.is_milestone && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs" style={{ color: '#3a3a3a' }}>Progreso</label>
                <span className="text-xs font-semibold" style={{ color: '#f5f5f7' }}>{phase.progress ?? 0}%</span>
              </div>
              <input
                type="range" min="0" max="100" step="5"
                value={phase.progress ?? 0}
                onChange={e => onUpdatePhase(phase.id, { progress: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: phase.color }}
              />
            </div>

            {/* Status — shows computed (auto) or manual */}
            <div>
              {isAutoStatus && (
                <p className="text-xs mb-1.5" style={{ color: '#3a3a3a' }}>
                  Estado calculado automáticamente ·{' '}
                  <span style={{ color: STATUS_META[effectiveStatus]?.color }}>
                    {STATUS_META[effectiveStatus]?.label}
                  </span>
                </p>
              )}
              <div className="flex gap-1.5">
                {Object.entries(STATUS_META).map(([key, { label, color }]) => {
                  const isEffective = effectiveStatus === key
                  const isManual    = (phase.status ?? 'on_track') === key
                  const highlight   = isAutoStatus ? isEffective : isManual
                  return (
                    <button
                      key={key}
                      onClick={() => onUpdatePhase(phase.id, { status: key })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs flex-1 justify-center transition-all"
                      style={{
                        backgroundColor: highlight ? color + '22' : 'transparent',
                        color:           highlight ? color : '#3a3a3a',
                        border:          `1px solid ${highlight ? color + '50' : 'rgba(255,255,255,0.06)'}`,
                        outline:         isAutoStatus && isEffective ? `1px solid ${color}60` : 'none',
                        outlineOffset:   2,
                      }}
                      onMouseEnter={e => { if (!highlight) { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color + '30' } }}
                      onMouseLeave={e => { if (!highlight) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' } }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Depends on */}
        {allPhases && allPhases.length > 1 && (
          <div>
            <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Depende de</label>
            <select
              value={phase.depends_on || ''}
              onChange={e => onUpdatePhase(phase.id, { depends_on: e.target.value || null })}
              style={{
                ...inputStyle, padding: '5px 8px', fontSize: 11,
                appearance: 'none', backgroundImage: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            >
              <option value="">— Sin dependencia —</option>
              {allPhases
                .filter(p => p.id !== phase.id)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.is_milestone ? '◆ ' : ''}{p.name}
                  </option>
                ))
              }
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs mb-1" style={{ color: '#3a3a3a' }}>Notas</label>
          <textarea
            value={phase.description || ''}
            onChange={e => onUpdatePhase(phase.id, { description: e.target.value || null })}
            placeholder="Contexto, requisitos, exclusiones..."
            rows={2}
            style={{ ...inputStyle, padding: '5px 8px', fontSize: 11, resize: 'vertical' }}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
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
  onAddMilestone,
  snapshots = [],
  activeSnapshotId = null,
  onSetActiveSnapshot,
  onCreateSnapshot,
  onDeleteSnapshot,
}) {
  const [copied,           setCopied]           = useState(false)
  const [confirmDelete,    setConfirmDelete]     = useState(false)
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [newSnapshotName,  setNewSnapshotName]  = useState('')

  // Baseline map: phase_id → snapshot phase
  const activeSnapshot = snapshots.find(s => s.id === activeSnapshotId) ?? null
  const baselineMap    = activeSnapshot
    ? Object.fromEntries((activeSnapshot.plan_snapshot_phases || []).map(sp => [sp.phase_id, sp]))
    : {}

  function formatDate(isoStr) {
    return new Date(isoStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  async function handleCreateSnapshot() {
    const name = newSnapshotName.trim() || `Plan base · ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
    await onCreateSnapshot(name)
    setCreatingSnapshot(false)
    setNewSnapshotName('')
  }

  async function handleReplan() {
    const name = `Re-plan · ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
    await onCreateSnapshot(name)
  }

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
              allPhases={phases}
              minStartDate={idx > 0 ? addDays(phases[idx - 1].end_date, 1) : undefined}
              baselinePhase={baselineMap[phase.id] ?? null}
              onUpdatePhase={onUpdatePhase}
              onDeletePhase={onDeletePhase}
              onOpenCalendar={onOpenCalendar}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onAddPhase}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm transition-all"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: '#6e6e73',
              border: '1px dashed rgba(255,255,255,0.1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir fase
          </button>
          <button
            onClick={onAddMilestone}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{
              backgroundColor: 'rgba(255,159,10,0.06)',
              color: '#ff9f0a',
              border: '1px dashed rgba(255,159,10,0.2)',
            }}
            title="Añadir hito (punto de control sin duración)"
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,159,10,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,159,10,0.06)' }}
          >
            <div style={{ width: 10, height: 10, transform: 'rotate(45deg)', backgroundColor: '#ff9f0a', borderRadius: 1 }} />
            Hito
          </button>
        </div>
      </div>

      {/* ── Plan base (baselines) ─────────────────────────── */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5" style={{ color: '#6e6e73' }} />
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
              Plan base
            </h3>
          </div>
          <div className="flex gap-1.5">
            {snapshots.length > 0 && (
              <button
                onClick={handleReplan}
                title="Guardar estado actual como nuevo plan base (Re-plan)"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                style={{ backgroundColor: 'rgba(100,210,255,0.08)', color: '#64d2ff', border: '1px solid rgba(100,210,255,0.2)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(100,210,255,0.15)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(100,210,255,0.08)'}
              >
                <RotateCcw className="w-3 h-3" />
                Re-plan
              </button>
            )}
            <button
              onClick={() => setCreatingSnapshot(true)}
              title="Guardar una foto del plan actual"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f5f5f7' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#6e6e73' }}
            >
              <Plus className="w-3 h-3" />
              Guardar
            </button>
          </div>
        </div>

        {/* Inline create form */}
        {creatingSnapshot && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newSnapshotName}
              onChange={e => setNewSnapshotName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateSnapshot(); if (e.key === 'Escape') { setCreatingSnapshot(false); setNewSnapshotName('') } }}
              placeholder={`Plan base · ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
              style={{ ...inputStyle, padding: '5px 10px', fontSize: 12, flex: 1 }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <button
              onClick={handleCreateSnapshot}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0"
              style={{ backgroundColor: '#bf5af2', color: '#fff' }}
            >
              OK
            </button>
          </div>
        )}

        {/* Empty state */}
        {snapshots.length === 0 && !creatingSnapshot && (
          <p className="text-xs" style={{ color: '#3a3a3a' }}>
            Guarda el estado actual del plan para poder comparar después cuando haya cambios.
          </p>
        )}

        {/* Snapshot list */}
        {snapshots.length > 0 && (
          <div className="space-y-1.5">
            {snapshots.map((snap, idx) => {
              const isActive = snap.id === activeSnapshotId
              return (
                <div
                  key={snap.id}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all"
                  style={{
                    backgroundColor: isActive ? 'rgba(191,90,242,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(191,90,242,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  onClick={() => onSetActiveSnapshot(isActive ? null : snap.id)}
                >
                  {/* Index dot */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                      backgroundColor: isActive ? '#bf5af2' : 'rgba(255,255,255,0.06)',
                      color: isActive ? '#fff' : '#6e6e73',
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Name + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: isActive ? '#f5f5f7' : '#6e6e73' }}>
                      {snap.name}
                    </p>
                    <p className="text-xs" style={{ color: '#3a3a3a' }}>
                      {formatDate(snap.created_at)}
                    </p>
                  </div>

                  {/* Active badge */}
                  {isActive && (
                    <span className="text-xs shrink-0 px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: 'rgba(191,90,242,0.15)', color: '#bf5af2', fontSize: 10 }}>
                      activo
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteSnapshot(snap.id) }}
                    className="p-1 rounded shrink-0 transition-colors"
                    style={{ color: '#2a2a2a' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                    onMouseLeave={e => e.currentTarget.style.color = '#2a2a2a'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Comparison hint */}
        {activeSnapshot && (
          <p className="text-xs" style={{ color: '#3a3a3a' }}>
            Las barras fantasma en el Gantt muestran dónde estaban las fases en "<span style={{ color: '#6e6e73' }}>{activeSnapshot.name}</span>".
          </p>
        )}
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
