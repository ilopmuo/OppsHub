import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import GanttChart from './GanttChart'
import toast from 'react-hot-toast'
import { useLang } from '../contexts/LanguageContext'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { Pencil, ChevronDown, ChevronUp, Save, Clock, GalleryHorizontal, MessageSquare, Zap, Plus, Trash2 } from 'lucide-react'

// ── Shared styles ─────────────────────────────────────────────────────────────
const CARD = {
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  padding: 20,
}
const INPUT = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f5f5f7',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s',
  width: '100%',
}
const TOOLTIP_STYLE = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f5f5f7',
  fontSize: 12,
  padding: '6px 10px',
}
const fi = e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'
const fo = e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'

// ── Helpers ───────────────────────────────────────────────────────────────────
function monthLabel(iso, locale = 'es-ES') {
  const [y, m] = iso.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' })
}
function isoMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function lastNMonths(n) {
  const months = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(isoMonth(d))
  }
  return months
}
function last12Months() { return lastNMonths(12) }
function lastNMonthsFrom(n, fromIso) {
  const from = new Date(fromIso + 'T00:00:00')
  const months = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    months.push(isoMonth(d))
  }
  return months
}
function initials(m) {
  if (m?.display_name) return m.display_name.slice(0, 2).toUpperCase()
  if (m?.email) return m.email.split('@')[0].slice(0, 2).toUpperCase()
  return '?'
}
function shortName(m) {
  if (m?.display_name) return m.display_name.split(' ')[0]
  if (m?.email) return m.email.split('@')[0]
  return 'Miembro'
}
function fmtNum(n) {
  if (n == null || n === '') return '—'
  const num = parseFloat(n)
  if (isNaN(num)) return '—'
  return num.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtDate(iso, locale = 'es-ES') {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Strings (i18n) ───────────────────────────────────────────────────────────
const SR = {
  es: {
    locale: 'es-ES',
    // version bar
    currentVersion: 'Versión actual', currentVersionLive: 'Versión actual (en vivo)',
    noVersionsSaved: 'Sin versiones guardadas', saveVersion: 'Guardar versión',
    save: 'Guardar', saving: 'Guardando…', backToCurrent: 'Volver a versión actual',
    // section subtitles
    sub01: 'Tipo de proyecto, satisfacción del cliente y asignación del equipo',
    sub02: 'Bugs registrados, estado y evolución mensual',
    sub03: 'Progreso del plan, fases y estado del proyecto',
    sub04: 'Tareas cerradas, bugs resueltos, trabajo en progreso y esfuerzo del equipo este mes',
    sub05: 'Snapshots semanales de presupuesto, costes y facturación',
    sub06: 'Nuevas oportunidades de negocio y retos actuales',
    // section 01
    projectType: 'Tipo de proyecto', typeImpl: 'Implementación', typeMaint: 'Mantenimiento',
    renewalDate: 'Fecha de renovación', deadline: 'Deadline', status: 'Estado',
    teamAlloc: 'Team allocation', resource: 'recurso', resources: 'recursos',
    noResources: 'Sin recursos. Añádelos en la tab Recursos & Finanzas.',
    nameRole: 'Nombre / Rol', dedication: 'Dedicación',
    satPlaceholder: 'Describe la satisfacción del cliente…',
    // section 02
    stabilityVerdicts: [
      { key: 'stable',   label: 'El sistema funciona con estabilidad',                         color: '#30d158' },
      { key: 'minor',    label: 'Hay bugs menores abiertos bajo seguimiento',                  color: '#ff9f0a' },
      { key: 'critical', label: 'Hay incidencias críticas abiertas que requieren atención',    color: '#ff453a' },
      { key: 'unknown',  label: 'Sin datos suficientes para determinar la estabilidad',        color: '#6e6e73' },
    ],
    selectVerdict: 'Selecciona el estado del sistema',
    thisMonth: 'Este mes', thisYear: 'Este año',
    open: 'Abiertos', inProgress: 'En progreso', closed: 'Cerrados', backlog: 'Backlog',
    bugsPerMonth: 'Bugs por mes — haz click en cualquier celda para editar',
    backlogDesc: 'El backlog acumulado (abiertos + en progreso − cerrados) indica cuántos bugs siguen sin resolver',
    monthCol: 'Mes', bugEvolution: 'Evolución de bugs (últimos 6 meses)', totalAccumulated: 'Total acumulado',
    // phase status labels
    phaseCompleted: 'Completada', phasePending: 'Pendiente', phaseOverdue: 'Retrasada',
    phaseAtRisk: 'En riesgo', phaseAhead: n => `+${n}% adelantado`, phaseBehind: n => `${n}% retrasado`, phaseOnTrack: 'En plazo',
    // section 03
    noPlan: 'Sin plan vinculado. Crea uno en la tab Plan para ver métricas de progreso.',
    globalProgress: 'Progreso global', phasesCompleted: 'Fases completadas', plannedHours: 'Horas planificadas',
    activePhase: 'Fase activa', timeElapsed: 'Tiempo transcurrido',
    daysRemaining: n => `${n} días restantes`, daysOverdue: n => `${Math.abs(n)} días de retraso`,
    progressLabel: 'Progreso', aheadMsg: n => `Vais ${n}% por delante del tiempo transcurrido`,
    behindMsg: n => `Vais ${n}% por detrás del tiempo transcurrido`,
    onTrackMsg: 'El ritmo está alineado con el tiempo transcurrido',
    allPhases: 'Todas las fases', activeLabel: 'activa', showLess: 'Ver menos',
    showMorePhases: n => `Ver ${n} fase${n > 1 ? 's' : ''} más`,
    effortHoursLabel: 'Horas de esfuerzo del equipo por mes', clickToEdit: 'Haz click en una celda para editar',
    effortEvolution: 'Evolución del esfuerzo (horas)', hoursBar: 'Horas', effortTarget: 'Objetivo mensual (h)',
    // section 04
    tasksClosedMonth: 'Tareas cerradas este mes', bugsClosedMonth: 'Bugs cerrados este mes',
    workDistribution: 'Distribución del trabajo por mes', tasksClosed: 'Tareas cerradas', bugsClosed: 'Bugs cerrados',
    spCommitted: 'SP comprometidos', spCompleted: 'SP completados', spRate: 'Tasa de completado',
    otherDeliverables: 'Otras entregas', addDeliverable: 'Añadir entrega', deliverablePlaceholder: 'Nombre de la entrega…',
    statusPending: 'Pendiente', statusInProgress: 'En progreso', statusDone: 'Hecho',
    // section 05
    noFinancialData: 'Sin datos financieros. Configúralos en la pestaña Recursos & Finanzas.',
    budget: 'Presupuesto', etdCost: 'Coste real (ETD)', billed: 'Facturado', currentMargin: 'Margen actual',
    financialStatus: 'Estado financiero', onTarget: 'En objetivo', critical: 'Crítico',
    etdBar: 'Coste real (ETD)', targetMargin: 'Margen objetivo', currentProfit: 'Beneficio actual',
    remainingBudget: 'Presupuesto restante',
    estimatedCostLabel: 'Coste estimado total', budgetConsumed: 'del presupuesto consumido',
    estimatedMarginLabel: 'Margen estimado', healthGood: 'Bajo control', healthWarning: 'Atención',
    healthRisk: 'En riesgo', budgetHealth: 'Salud presupuestaria',
    resourceBreakdown: 'Desglose por recurso', resName: 'Nombre', resRole: 'Rol', resHours: 'H. reales', resRate: 'Tarifa/h', resCost: 'Coste real', resTotal: 'Total',
    resPlannedH: 'H. planificadas', resRemH: 'H. restantes', resRemCost: 'Coste restante',
    invoiceList: 'Facturas', invDate: 'Fecha', invDesc: 'Descripción', invAmount: 'Importe', invNoDesc: '—',
    costEvolution: 'Evolución mensual', evoCost: 'Coste', evoBilled: 'Facturado',
    licensesTitle: 'Licencias del producto', licName: 'Licencia', licCount: 'Unidades', licPrice: 'Precio/u', licTotal: 'Total', licGrandTotal: 'Valor total', licAddRow: '+ Añadir licencia', licNamePlaceholder: 'Nombre…',
    // section 06
    oppPlaceholder: 'Describe las oportunidades de negocio identificadas…',
    chalPlaceholder: 'Describe los retos o bloqueos actuales…', saveChanges: 'Guardar cambios',
    member: 'Miembro',
    exportPresentation: 'Exportar presentación',
    autoDetect: 'Auto-detectar estado', autoDetecting: 'Analizando…',
    autoDetectDone: n => `${n} sección${n !== 1 ? 'es' : ''} actualizadas`,
    commentPlaceholder: 'Añade un comentario a esta sección…',
    commentSave: 'Guardar comentario', commentSaved: 'Comentario guardado',
  },
  en: {
    locale: 'en-US',
    // version bar
    currentVersion: 'Current version', currentVersionLive: 'Current version (live)',
    noVersionsSaved: 'No saved versions', saveVersion: 'Save version',
    save: 'Save', saving: 'Saving…', backToCurrent: 'Back to current version',
    // section subtitles
    sub01: 'Project type, customer satisfaction and team allocation',
    sub02: 'Registered bugs, status and monthly evolution',
    sub03: 'Plan progress, phases and project status',
    sub04: 'Closed tasks, resolved bugs, work in progress and team effort this month',
    sub05: 'Weekly snapshots of budget, costs and billing',
    sub06: 'New business opportunities and current challenges',
    // section 01
    projectType: 'Project type', typeImpl: 'Implementation', typeMaint: 'Maintenance',
    renewalDate: 'Renewal date', deadline: 'Deadline', status: 'Status',
    teamAlloc: 'Team allocation', resource: 'resource', resources: 'resources',
    noResources: 'No resources. Add them in the Resources & Finances tab.',
    nameRole: 'Name / Role', dedication: 'Dedication',
    satPlaceholder: 'Describe customer satisfaction…',
    // section 02
    stabilityVerdicts: [
      { key: 'stable',   label: 'The system is running stably',                           color: '#30d158' },
      { key: 'minor',    label: 'There are minor open bugs under monitoring',              color: '#ff9f0a' },
      { key: 'critical', label: 'There are critical open incidents requiring attention',   color: '#ff453a' },
      { key: 'unknown',  label: 'Insufficient data to assess system stability',            color: '#6e6e73' },
    ],
    selectVerdict: 'Select the system status',
    thisMonth: 'This month', thisYear: 'This year',
    open: 'Open', inProgress: 'In progress', closed: 'Closed', backlog: 'Backlog',
    bugsPerMonth: 'Bugs per month — click any cell to edit',
    backlogDesc: 'The accumulated backlog (open + in progress − closed) indicates how many bugs remain unresolved',
    monthCol: 'Month', bugEvolution: 'Bug evolution (last 6 months)', totalAccumulated: 'Total accumulated',
    // phase status labels
    phaseCompleted: 'Completed', phasePending: 'Pending', phaseOverdue: 'Overdue',
    phaseAtRisk: 'At risk', phaseAhead: n => `+${n}% ahead`, phaseBehind: n => `${n}% behind`, phaseOnTrack: 'On track',
    // section 03
    noPlan: 'No plan linked. Create one in the Plan tab to see progress metrics.',
    globalProgress: 'Global progress', phasesCompleted: 'Phases completed', plannedHours: 'Planned hours',
    activePhase: 'Active phase', timeElapsed: 'Time elapsed',
    daysRemaining: n => `${n} days remaining`, daysOverdue: n => `${Math.abs(n)} days overdue`,
    progressLabel: 'Progress', aheadMsg: n => `You are ${n}% ahead of the elapsed time`,
    behindMsg: n => `You are ${n}% behind the elapsed time`,
    onTrackMsg: 'The pace is aligned with the elapsed time',
    allPhases: 'All phases', activeLabel: 'active', showLess: 'Show less',
    showMorePhases: n => `Show ${n} more phase${n > 1 ? 's' : ''}`,
    effortHoursLabel: 'Team effort hours per month', clickToEdit: 'Click a cell to edit',
    effortEvolution: 'Effort evolution (hours)', hoursBar: 'Hours', effortTarget: 'Monthly target (h)',
    // section 04
    tasksClosedMonth: 'Tasks closed this month', bugsClosedMonth: 'Bugs closed this month',
    workDistribution: 'Monthly work distribution', tasksClosed: 'Tasks closed', bugsClosed: 'Bugs closed',
    spCommitted: 'SP committed', spCompleted: 'SP completed', spRate: 'Completion rate',
    otherDeliverables: 'Other deliverables', addDeliverable: 'Add deliverable', deliverablePlaceholder: 'Deliverable name…',
    statusPending: 'Pending', statusInProgress: 'In progress', statusDone: 'Done',
    // section 05
    noFinancialData: 'No financial data. Configure it in the Resources & Finances tab.',
    budget: 'Budget', etdCost: 'Actual cost (ETD)', billed: 'Billed', currentMargin: 'Current margin',
    financialStatus: 'Financial status', onTarget: 'On target', critical: 'Critical',
    etdBar: 'Actual cost (ETD)', targetMargin: 'Target margin', currentProfit: 'Current profit',
    remainingBudget: 'Remaining budget',
    estimatedCostLabel: 'Estimated total cost', budgetConsumed: 'of budget consumed',
    estimatedMarginLabel: 'Estimated margin', healthGood: 'Under control', healthWarning: 'Warning',
    healthRisk: 'At risk', budgetHealth: 'Budget health',
    resourceBreakdown: 'Resource breakdown', resName: 'Name', resRole: 'Role', resHours: 'Actual h.', resRate: 'Rate/h', resCost: 'Actual cost', resTotal: 'Total',
    resPlannedH: 'Planned h.', resRemH: 'Remaining h.', resRemCost: 'Remaining cost',
    invoiceList: 'Invoices', invDate: 'Date', invDesc: 'Description', invAmount: 'Amount', invNoDesc: '—',
    costEvolution: 'Monthly evolution', evoCost: 'Cost', evoBilled: 'Billed',
    licensesTitle: 'Product licenses', licName: 'License', licCount: 'Units', licPrice: 'Price/u', licTotal: 'Total', licGrandTotal: 'Total value', licAddRow: '+ Add license', licNamePlaceholder: 'Name…',
    // section 06
    oppPlaceholder: 'Describe the identified business opportunities…',
    chalPlaceholder: 'Describe the current challenges or blockers…', saveChanges: 'Save changes',
    member: 'Member',
    exportPresentation: 'Export presentation',
    autoDetect: 'Auto-detect status', autoDetecting: 'Analyzing…',
    autoDetectDone: n => `${n} section${n !== 1 ? 's' : ''} updated`,
    commentPlaceholder: 'Add a comment to this section…',
    commentSave: 'Save comment', commentSaved: 'Comment saved',
  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STATUS_DOTS = [
  { value: 'good',    color: '#30d158', shadow: 'rgba(48,209,88,0.5)' },
  { value: 'regular', color: '#ff9f0a', shadow: 'rgba(255,159,10,0.5)' },
  { value: 'bad',     color: '#ff453a', shadow: 'rgba(255,69,58,0.5)' },
]

function SectionHeader({ number, title, subtitle, status, onStatusChange, hasComment, commentExpanded, onCommentToggle }) {
  const activeDot = STATUS_DOTS.find(d => d.value === status)
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}>
          {number}
        </span>
        <h2 className="text-base font-semibold" style={{ color: '#f5f5f7' }}>{title}</h2>

        {/* Status dots — clickable in edit mode, static in snapshot */}
        {onStatusChange ? (
          <div className="flex items-center gap-1.5">
            {STATUS_DOTS.map(d => (
              <button key={d.value} onClick={() => onStatusChange(status === d.value ? null : d.value)}
                style={{
                  width: 10, height: 10, borderRadius: '50%', backgroundColor: d.color,
                  border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                  boxShadow: status === d.value ? `0 0 7px 2px ${d.shadow}` : 'none',
                  opacity: status && status !== d.value ? 0.18 : 1,
                  transition: 'box-shadow 0.2s, opacity 0.2s',
                }}
              />
            ))}
          </div>
        ) : activeDot ? (
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: activeDot.color, flexShrink: 0,
                        boxShadow: `0 0 7px 2px ${activeDot.shadow}` }} />
        ) : null}

        {/* Comment toggle — only in edit mode */}
        {onCommentToggle && (
          <button
            onClick={onCommentToggle}
            title="Comentario de sección"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
              backgroundColor: commentExpanded ? 'rgba(100,210,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: commentExpanded ? '#64d2ff' : hasComment ? '#64d2ff' : '#3a3a3a',
              transition: 'background 0.15s, color 0.15s',
              position: 'relative',
            }}
            onMouseEnter={e => { if (!commentExpanded) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#6e6e73' } }}
            onMouseLeave={e => { if (!commentExpanded) { e.currentTarget.style.backgroundColor = hasComment ? 'rgba(100,210,255,0.06)' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = hasComment ? '#64d2ff' : '#3a3a3a' } }}
          >
            <MessageSquare size={13} />
            {hasComment && !commentExpanded && (
              <span style={{
                position: 'absolute', top: 4, right: 4, width: 5, height: 5,
                borderRadius: '50%', backgroundColor: '#64d2ff',
              }} />
            )}
          </button>
        )}
      </div>
      {subtitle && <p className="text-xs ml-9" style={{ color: '#6e6e73' }}>{subtitle}</p>}
    </div>
  )
}

const COMMENT_COLORS = [
  { color: '#f5f5f7', label: 'Blanco' },
  { color: '#ff453a', label: 'Rojo' },
  { color: '#ff9f0a', label: 'Naranja' },
  { color: '#30d158', label: 'Verde' },
  { color: '#64d2ff', label: 'Azul' },
  { color: '#bf5af2', label: 'Púrpura' },
]

function SectionCommentEditor({ sectionNumber, initialHtml, projectId, onSave, lang }) {
  const t = SR[lang] ?? SR.es
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [boldActive, setBoldActive] = useState(false)
  const [italicActive, setItalicActive] = useState(false)
  const editorRef = useRef(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = initialHtml ?? ''
      initialized.current = true
    }
  }, [initialHtml])

  function updateStates() {
    setBoldActive(document.queryCommandState('bold'))
    setItalicActive(document.queryCommandState('italic'))
  }

  function exec(cmd, val = null) {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
    updateStates()
  }

  async function save() {
    setSaving(true)
    const newHtml = editorRef.current?.innerHTML ?? ''
    const { data: cur } = await supabase.from('projects').select('section_comments').eq('id', projectId).single()
    const updated = { ...(cur?.section_comments ?? {}), [sectionNumber]: newHtml }
    const { error } = await supabase.from('projects').update({ section_comments: updated }).eq('id', projectId)
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    setDirty(false)
    onSave({ section_comments: updated })
    toast.success(t.commentSaved)
  }

  const btnBase = (active) => ({
    width: 26, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color: active ? '#f5f5f7' : '#6e6e73',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div className="sr-no-print" style={{
      marginBottom: 24, borderRadius: 12,
      border: '1px solid rgba(100,210,255,0.12)',
      backgroundColor: 'rgba(100,210,255,0.03)',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onMouseDown={e => { e.preventDefault(); exec('bold') }} style={btnBase(boldActive)}
          onMouseEnter={e => { if (!boldActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (!boldActive) e.currentTarget.style.backgroundColor = 'transparent' }}>
          <strong>B</strong>
        </button>
        <button onMouseDown={e => { e.preventDefault(); exec('italic') }} style={{ ...btnBase(italicActive), fontStyle: 'italic' }}
          onMouseEnter={e => { if (!italicActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (!italicActive) e.currentTarget.style.backgroundColor = 'transparent' }}>
          I
        </button>
        <button onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }} style={btnBase(false)}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Lista">
          ≡
        </button>
        <span style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
        {COMMENT_COLORS.map(({ color, label }) => (
          <button key={color} title={label}
            onMouseDown={e => { e.preventDefault(); exec('foreColor', color) }}
            style={{
              width: 13, height: 13, borderRadius: '50%', backgroundColor: color,
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', padding: 0, flexShrink: 0,
            }}
          />
        ))}
        {dirty && (
          <>
            <span style={{ flex: 1 }} />
            <button onClick={save} disabled={saving}
              className="text-xs px-3 py-1 rounded-lg font-semibold"
              style={{ backgroundColor: '#f5f5f7', color: '#000', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {saving ? t.saving : t.commentSave}
            </button>
          </>
        )}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={() => { setDirty(true); updateStates() }}
        onKeyUp={updateStates}
        onMouseUp={updateStates}
        data-placeholder={t.commentPlaceholder}
        style={{
          minHeight: 72, outline: 'none',
          color: '#f5f5f7', fontSize: 13, fontFamily: 'inherit',
          lineHeight: 1.65, caretColor: '#f5f5f7',
          padding: '10px 14px',
        }}
        className="section-comment-editor"
      />
    </div>
  )
}

function KpiCard({ label, value, color = '#f5f5f7', sub }) {
  return (
    <div style={CARD} className="flex flex-col gap-1">
      <p className="text-xs" style={{ color: '#6e6e73' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value ?? '—'}</p>
      {sub && <p className="text-xs" style={{ color: '#6e6e73' }}>{sub}</p>}
    </div>
  )
}

// ── Section 1: Project Status ─────────────────────────────────────────────────
function ProjectStatusSection({ project, onSave, lang = 'es' }) {
  const isImpl = project.type === 'implementation'

  // Customer satisfaction — rich text editor
  const [satDirty, setSatDirty] = useState(false)
  const [satSaving, setSatSaving] = useState(false)
  const [boldActive, setBoldActive] = useState(false)
  const editorRef = useRef(null)
  const satInitialized = useRef(false)

  // Set initial HTML content once the editor mounts
  useEffect(() => {
    if (editorRef.current && !satInitialized.current) {
      editorRef.current.innerHTML = project.customer_satisfaction_text ?? ''
      satInitialized.current = true
    }
  }, [project.customer_satisfaction_text])

  function toggleBold() {
    document.execCommand('bold', false, null)
    editorRef.current?.focus()
    setBoldActive(document.queryCommandState('bold'))
  }

  function onEditorInput() {
    setSatDirty(true)
    setBoldActive(document.queryCommandState('bold'))
  }

  function onEditorKeyUp() {
    setBoldActive(document.queryCommandState('bold'))
  }

  async function saveSat() {
    setSatSaving(true)
    const html = editorRef.current?.innerHTML ?? ''
    const { error } = await supabase
      .from('projects')
      .update({ customer_satisfaction_text: html })
      .eq('id', project.id)
    setSatSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    setSatDirty(false)
    onSave({ customer_satisfaction_text: html })
  }

  // Resources
  const [resources, setResources] = useState([])
  const [editingPct, setEditingPct] = useState({}) // id → string value

  useEffect(() => {
    supabase
      .from('project_resources')
      .select('id, name, role, hourly_rate, dedication_pct')
      .eq('project_id', project.id)
      .order('created_at')
      .then(({ data }) => setResources(data ?? []))
  }, [project.id])

  async function saveDedication(id, val) {
    const pct = val === '' ? null : Math.min(100, Math.max(0, parseFloat(val)))
    if (val !== '' && isNaN(pct)) { toast.error('Valor inválido'); return }
    const { error } = await supabase
      .from('project_resources')
      .update({ dedication_pct: pct })
      .eq('id', id)
    if (error) { toast.error('Error al guardar'); return }
    setResources(prev => prev.map(r => r.id === id ? { ...r, dedication_pct: pct } : r))
    setEditingPct(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const t = SR[lang] ?? SR.es
  const TYPE_LABELS = { implementation: t.typeImpl, maintenance: t.typeMaint }
  const STATUS_LABELS = { on_track: 'On track', at_risk: 'At risk', blocked: 'Blocked' }
  const STATUS_COLORS = { on_track: '#30d158', at_risk: '#ff9f0a', blocked: '#ff453a' }

  return (
    <div className="flex flex-col gap-4 mb-4">
      {/* Row 1: Tipo + Team allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type + date */}
        <div style={CARD}>
          <p className="text-xs mb-3" style={{ color: '#6e6e73' }}>{t.projectType}</p>
          <span className="text-sm font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: isImpl ? 'rgba(100,210,255,0.12)' : 'rgba(191,90,242,0.12)',
                     color: isImpl ? '#64d2ff' : '#bf5af2' }}>
            {TYPE_LABELS[project.type] ?? project.type}
          </span>
          {!isImpl && project.renewal_date && (
            <div className="mt-3">
              <p className="text-xs" style={{ color: '#6e6e73' }}>{t.renewalDate}</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: '#f5f5f7' }}>{fmtDate(project.renewal_date, t.locale)}</p>
            </div>
          )}
          {isImpl && project.deadline && (
            <div className="mt-3">
              <p className="text-xs" style={{ color: '#6e6e73' }}>{t.deadline}</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: '#f5f5f7' }}>{fmtDate(project.deadline, t.locale)}</p>
            </div>
          )}
          <div className="mt-3">
            <p className="text-xs" style={{ color: '#6e6e73' }}>{t.status}</p>
            <span className="text-sm font-medium mt-0.5 inline-block"
              style={{ color: STATUS_COLORS[project.status] ?? '#f5f5f7' }}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
        </div>

        {/* Team allocation */}
        <div style={CARD}>
          <p className="text-xs mb-3" style={{ color: '#6e6e73' }}>
            {t.teamAlloc} ({resources.length} {resources.length !== 1 ? t.resources : t.resource})
          </p>
          {resources.length === 0 ? (
            <p className="text-xs" style={{ color: '#6e6e73' }}>{t.noResources}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 text-xs" style={{ color: '#6e6e73', gridTemplateColumns: '1fr auto auto' }}>
                <span>{t.nameRole}</span>
                <span style={{ textAlign: 'right' }}>€/h</span>
                <span style={{ textAlign: 'right', minWidth: 64 }}>{t.dedication}</span>
              </div>
              {resources.map(r => {
                const isEditing = editingPct[r.id] !== undefined
                return (
                  <div key={r.id} className="grid gap-2 items-center"
                    style={{ gridTemplateColumns: '1fr auto auto' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#f5f5f7' }}>{r.name}</p>
                      {r.role && <p className="text-xs truncate" style={{ color: '#6e6e73' }}>{r.role}</p>}
                    </div>
                    <span className="text-xs font-mono" style={{ color: '#6e6e73', textAlign: 'right' }}>
                      {r.hourly_rate != null ? `${r.hourly_rate}€` : '—'}
                    </span>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="number" min="0" max="100"
                          style={{ ...INPUT, width: 56, padding: '3px 6px', textAlign: 'right' }}
                          value={editingPct[r.id]}
                          onChange={e => setEditingPct(prev => ({ ...prev, [r.id]: e.target.value }))}
                          onBlur={() => saveDedication(r.id, editingPct[r.id])}
                          onKeyDown={e => { if (e.key === 'Enter') saveDedication(r.id, editingPct[r.id]) }}
                          onFocus={fi}
                        />
                        <span className="text-xs" style={{ color: '#6e6e73' }}>%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingPct(prev => ({ ...prev, [r.id]: r.dedication_pct ?? '' }))}
                        title="Click para editar"
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                                 borderRadius: 8, cursor: 'pointer', fontSize: 12,
                                 color: r.dedication_pct != null ? '#f5f5f7' : '#3a3a3a',
                                 padding: '3px 8px', minWidth: 56, textAlign: 'right',
                                 backgroundColor: 'rgba(255,255,255,0.03)' }}>
                        {r.dedication_pct != null ? `${r.dedication_pct}%` : '—'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Customer satisfaction — full width */}
      <div style={CARD} className="flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onMouseDown={e => { e.preventDefault(); toggleBold() }}
            title="Negrita (Ctrl+B)"
            style={{
              width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              backgroundColor: boldActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: boldActive ? '#f5f5f7' : '#6e6e73',
              transition: 'background 0.15s, color 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { if (!boldActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (!boldActive) e.currentTarget.style.backgroundColor = 'transparent' }}
          >B</button>
          <span style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <p className="text-xs" style={{ color: '#6e6e73' }}>Customer satisfaction</p>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={onEditorInput}
          onKeyUp={onEditorKeyUp}
          onMouseUp={onEditorKeyUp}
          data-placeholder={t.satPlaceholder}
          style={{
            minHeight: 180, outline: 'none',
            color: '#f5f5f7', fontSize: 15, fontFamily: 'inherit',
            lineHeight: 1.7, caretColor: '#f5f5f7',
          }}
          className="csat-editor"
        />

        {satDirty && (
          <button onClick={saveSat} disabled={satSaving}
            className="mt-3 px-3 py-1.5 rounded-xl text-xs font-semibold self-end"
            style={{ backgroundColor: '#f5f5f7', color: '#000', border: 'none', cursor: 'pointer' }}>
            {satSaving ? t.saving : t.save}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Section 2: System Stability ───────────────────────────────────────────────
function SystemStabilitySection({ projectId, project, onSave, lang = 'es' }) {
  const [stats, setStats] = useState([])   // [{month_year, open_count, closed_count}]
  const [editing, setEditing] = useState({}) // { 'YYYY-MM_open' | 'YYYY-MM_closed' → string }
  const [verdict, setVerdict] = useState(project?.stability_verdict ?? null)
  const [showPicker, setShowPicker] = useState(false)

  const months = lastNMonths(6)

  useEffect(() => {
    supabase
      .from('project_bug_stats')
      .select('*')
      .eq('project_id', projectId)
      .in('month_year', months)
      .then(({ data }) => setStats(data ?? []))
  }, [projectId])

  const t = SR[lang] ?? SR.es
  const statsMap = Object.fromEntries(stats.map(s => [s.month_year, s]))

  async function saveCell(monthYear, field, rawVal) {
    const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10))
    if (isNaN(val)) { toast.error('Valor inválido'); return }

    const existing = statsMap[monthYear]
    const payload = {
      project_id:         projectId,
      month_year:         monthYear,
      open_count:         field === 'open'        ? val : (existing?.open_count         ?? 0),
      in_progress_count:  field === 'in_progress' ? val : (existing?.in_progress_count  ?? 0),
      closed_count:       field === 'closed'      ? val : (existing?.closed_count       ?? 0),
    }

    const { error } = await supabase
      .from('project_bug_stats')
      .upsert(payload, { onConflict: 'project_id,month_year' })
    if (error) { toast.error('Error al guardar'); return }

    setStats(prev => {
      const idx = prev.findIndex(s => s.month_year === monthYear)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = { ...next[idx], ...payload }; return next
      }
      return [...prev, payload]
    })
    setEditing(prev => { const n = { ...prev }; delete n[`${monthYear}_${field}`]; return n })
  }

  function startEdit(monthYear, field) {
    const existing = statsMap[monthYear]
    const current = field === 'open' ? (existing?.open_count ?? '')
      : field === 'in_progress' ? (existing?.in_progress_count ?? '')
      : (existing?.closed_count ?? '')
    setEditing(prev => ({ ...prev, [`${monthYear}_${field}`]: String(current === 0 ? '' : current) }))
  }

  // KPIs
  const now = new Date()
  const thisMonth = isoMonth(now)
  const thisMonthStats = statsMap[thisMonth]
  const totalOpenThisMonth       = thisMonthStats?.open_count        ?? 0
  const totalInProgressThisMonth = thisMonthStats?.in_progress_count ?? 0
  const totalClosedThisMonth     = thisMonthStats?.closed_count      ?? 0
  const yearStats = stats.filter(s => s.month_year.startsWith(String(now.getFullYear())))
  const totalOpenYear       = yearStats.reduce((sum, s) => sum + (s.open_count        ?? 0), 0)
  const totalInProgressYear = yearStats.reduce((sum, s) => sum + (s.in_progress_count ?? 0), 0)
  const totalClosedYear     = yearStats.reduce((sum, s) => sum + (s.closed_count      ?? 0), 0)
  // Backlog acumulado = proxy de aging: bugs abiertos históricos que aún no se han cerrado
  const backlog = stats.reduce((sum, s) => sum + (s.open_count ?? 0) + (s.in_progress_count ?? 0) - (s.closed_count ?? 0), 0)

  // Chart data
  const chartData = months.map(m => ({
    month:      monthLabel(m, t.locale),
    abiertos:   statsMap[m]?.open_count        ?? 0,
    en_progreso: statsMap[m]?.in_progress_count ?? 0,
    cerrados:   statsMap[m]?.closed_count      ?? 0,
  }))

  // Donut: totals across all loaded months
  const totalOpen       = stats.reduce((s, r) => s + (r.open_count        ?? 0), 0)
  const totalInProgress = stats.reduce((s, r) => s + (r.in_progress_count ?? 0), 0)
  const totalClosed     = stats.reduce((s, r) => s + (r.closed_count      ?? 0), 0)
  const donutData = [
    { name: t.open,       value: totalOpen,       color: '#ff453a' },
    { name: t.inProgress, value: totalInProgress, color: '#ff9f0a' },
    { name: t.closed,     value: totalClosed,     color: '#30d158' },
  ].filter(d => d.value > 0)
  if (donutData.length === 0) donutData.push({ name: '—', value: 1, color: '#2a2a2a' })

  async function saveVerdict(key) {
    setVerdict(key)
    setShowPicker(false)
    await supabase.from('projects').update({ stability_verdict: key }).eq('id', projectId)
    onSave?.({ stability_verdict: key })
  }

  const activeVerdict = t.stabilityVerdicts.find(v => v.key === verdict)

  const FIELD_COLORS = { open: '#ff453a', in_progress: '#ff9f0a', closed: '#30d158' }
  const FIELD_BG     = { open: 'rgba(255,69,58,0.06)', in_progress: 'rgba(255,159,10,0.06)', closed: 'rgba(48,209,88,0.06)' }

  function CellBtn({ monthYear, field }) {
    const key = `${monthYear}_${field}`
    const isEditingCell = editing[key] !== undefined
    const val = field === 'open' ? statsMap[monthYear]?.open_count
      : field === 'in_progress' ? statsMap[monthYear]?.in_progress_count
      : statsMap[monthYear]?.closed_count
    const color = FIELD_COLORS[field]

    if (isEditingCell) return (
      <input
        autoFocus type="number" min="0"
        style={{ ...INPUT, width: 64, padding: '3px 6px', textAlign: 'center', fontSize: 12 }}
        value={editing[key]}
        onChange={e => setEditing(prev => ({ ...prev, [key]: e.target.value }))}
        onBlur={() => saveCell(monthYear, field, editing[key])}
        onKeyDown={e => { if (e.key === 'Enter') saveCell(monthYear, field, editing[key]) }}
        onFocus={fi}
      />
    )

    return (
      <button onClick={() => startEdit(monthYear, field)} title="Click para editar"
        style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
          cursor: 'pointer', fontSize: 13, fontWeight: val ? 600 : 400,
          color: val ? color : '#3a3a3a',
          padding: '3px 10px', minWidth: 56, textAlign: 'center',
          backgroundColor: val ? FIELD_BG[field] : 'rgba(255,255,255,0.02)',
          transition: 'background 0.15s',
        }}>
        {val ?? '—'}
      </button>
    )
  }

  const SEP = <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

  const VERDICT_ANIM = {
    stable:   { glow: `0 0 24px 6px rgba(48,209,88,0.18)`,   border: `rgba(48,209,88,0.7)`,   dur: '4s'   },
    minor:    { glow: `0 0 24px 6px rgba(255,159,10,0.22)`,  border: `rgba(255,159,10,0.7)`,  dur: '2.5s' },
    critical: { glow: `0 0 28px 8px rgba(255,69,58,0.38)`,   border: `rgba(255,69,58,0.85)`,  dur: '1.2s' },
    unknown:  { glow: `0 0 0 0 transparent`,                  border: `rgba(110,110,115,0.4)`, dur: '5s'   },
  }

  return (
    <div className="mb-2">
      <style>{`
        @keyframes verdict-enter {
          from { opacity: 0; transform: translateY(-10px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glow-stable {
          0%,100% { box-shadow: 0 0 0 0 rgba(48,209,88,0);    border-color: rgba(48,209,88,0.3); }
          50%     { box-shadow: 0 0 24px 6px rgba(48,209,88,0.18); border-color: rgba(48,209,88,0.7); }
        }
        @keyframes glow-minor {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,159,10,0);   border-color: rgba(255,159,10,0.3); }
          50%     { box-shadow: 0 0 24px 6px rgba(255,159,10,0.22); border-color: rgba(255,159,10,0.7); }
        }
        @keyframes glow-critical {
          0%,100% { box-shadow: 0 0 10px 2px rgba(255,69,58,0.22); border-color: rgba(255,69,58,0.45); }
          50%     { box-shadow: 0 0 28px 8px rgba(255,69,58,0.42); border-color: rgba(255,69,58,0.9); }
        }
        @keyframes glow-unknown {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.55; }
        }
        @keyframes dot-pulse {
          0%,100% { transform: scale(1);   opacity: 1; }
          50%     { transform: scale(1.5); opacity: 0.6; }
        }
        @keyframes picker-enter {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Verdict banner */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        {activeVerdict ? (
          <button onClick={() => setShowPicker(v => !v)} style={{
            width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            <div
              key={activeVerdict.key}
              style={{
                borderRadius: 14, padding: '20px 28px',
                backgroundColor: `${activeVerdict.color}10`,
                border: `1px solid ${activeVerdict.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                animation: `verdict-enter 0.35s cubic-bezier(0.16,1,0.3,1), glow-${activeVerdict.key} ${VERDICT_ANIM[activeVerdict.key]?.dur ?? '3s'} ease-in-out infinite 0.35s`,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  backgroundColor: activeVerdict.color, flexShrink: 0,
                  animation: `dot-pulse ${VERDICT_ANIM[activeVerdict.key]?.dur ?? '3s'} ease-in-out infinite`,
                }} />
                <p style={{ fontSize: 22, fontWeight: 700, color: activeVerdict.color, lineHeight: 1.2, letterSpacing: '-0.01em', margin: 0 }}>
                  {activeVerdict.label}
                </p>
              </div>
              <span style={{ fontSize: 11, color: activeVerdict.color, opacity: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {showPicker ? '▲' : '▼'}
              </span>
            </div>
          </button>
        ) : (
          <button onClick={() => setShowPicker(v => !v)} style={{
            width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            <div style={{
              borderRadius: 14, padding: '16px 24px',
              border: '1px dashed rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 18, color: '#3a3a3a' }}>+</span>
              <p style={{ fontSize: 14, color: '#3a3a3a', margin: 0 }}>{t.selectVerdict}</p>
            </div>
          </button>
        )}

        {showPicker && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 50,
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: '#1c1c1e',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            animation: 'picker-enter 0.2s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {t.stabilityVerdicts.map(v => (
              <button key={v.key} onClick={() => saveVerdict(v.key)} style={{
                width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer',
                padding: '14px 20px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', gap: 12,
                backgroundColor: verdict === v.key ? `${v.color}10` : 'transparent',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = `${v.color}10`}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = verdict === v.key ? `${v.color}10` : 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: v.color, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: verdict === v.key ? v.color : '#d1d1d6', fontWeight: verdict === v.key ? 600 : 400 }}>
                  {v.label}
                </span>
                {verdict === v.key && <span style={{ marginLeft: 'auto', color: v.color, fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Este mes — principal */}
      <div style={{ ...CARD, padding: '28px 32px', marginBottom: 12, background: 'rgba(255,255,255,0.04)' }}>
        <p className="text-xs font-semibold mb-6" style={{ color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.thisMonth}</p>
        <div className="flex gap-12">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: '#ff453a' }}>{t.open}</p>
            <p style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: totalOpenThisMonth > 0 ? '#ff453a' : '#f5f5f7', letterSpacing: '-0.04em' }}>{totalOpenThisMonth}</p>
          </div>
          {SEP}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: '#ff9f0a' }}>{t.inProgress}</p>
            <p style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: totalInProgressThisMonth > 0 ? '#ff9f0a' : '#f5f5f7', letterSpacing: '-0.04em' }}>{totalInProgressThisMonth}</p>
          </div>
          {SEP}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: '#30d158' }}>{t.closed}</p>
            <p style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: '#30d158', letterSpacing: '-0.04em' }}>{totalClosedThisMonth}</p>
          </div>
        </div>
      </div>

      {/* Este año — secundario */}
      <div style={{ ...CARD, padding: '14px 20px', marginBottom: 16 }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.thisYear}</p>
        <div className="flex gap-5">
          <div>
            <p className="text-xs mb-1" style={{ color: '#ff453a' }}>{t.open}</p>
            <p className="text-xl font-bold" style={{ color: totalOpenYear > 0 ? '#ff453a' : '#f5f5f7' }}>{totalOpenYear}</p>
          </div>
          {SEP}
          <div>
            <p className="text-xs mb-1" style={{ color: '#ff9f0a' }}>{t.inProgress}</p>
            <p className="text-xl font-bold" style={{ color: totalInProgressYear > 0 ? '#ff9f0a' : '#f5f5f7' }}>{totalInProgressYear}</p>
          </div>
          {SEP}
          <div>
            <p className="text-xs mb-1" style={{ color: '#30d158' }}>{t.closed}</p>
            <p className="text-xl font-bold" style={{ color: '#30d158' }}>{totalClosedYear}</p>
          </div>
          {SEP}
          <div>
            <p className="text-xs mb-1" style={{ color: '#6e6e73' }}>{t.backlog}</p>
            <p className="text-xl font-bold" style={{ color: backlog > 0 ? '#ff453a' : '#30d158' }}>{Math.max(0, backlog)}</p>
          </div>
        </div>
      </div>

      {/* Monthly input table */}
      <div style={CARD} className="mb-4">
        <p className="text-xs font-medium mb-1" style={{ color: '#6e6e73' }}>{t.bugsPerMonth}</p>
        <p className="text-xs mb-4" style={{ color: '#3a3a3a' }}>{t.backlogDesc}</p>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ color: '#6e6e73', fontWeight: 500, textAlign: 'left', paddingBottom: 8, whiteSpace: 'nowrap', width: 90 }}>{t.monthCol}</th>
                {months.map(m => (
                  <th key={m} style={{ color: m === thisMonth ? '#f5f5f7' : '#6e6e73', fontWeight: m === thisMonth ? 600 : 500,
                                       textAlign: 'center', paddingBottom: 8, minWidth: 80, whiteSpace: 'nowrap' }}>
                    {monthLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { field: 'open',        label: t.open,       color: '#ff453a' },
                { field: 'in_progress', label: t.inProgress, color: '#ff9f0a' },
                { field: 'closed',      label: t.closed,     color: '#30d158' },
              ].map((row, ri, rows) => (
                <tr key={row.field} style={{ borderTop: ri > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <td style={{ padding: '8px 0', color: row.color, fontWeight: 500 }}>{row.label}</td>
                  {months.map(m => (
                    <td key={m} style={{ textAlign: 'center', padding: '6px 4px' }}>
                      <CellBtn monthYear={m} field={row.field} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
        <div style={CARD}>
          <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>{t.bugEvolution}</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={8} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="abiertos"    fill="#ff453a" radius={[3,3,0,0]} name={t.open} />
              <Bar dataKey="en_progreso" fill="#ff9f0a" radius={[3,3,0,0]} name={t.inProgress} />
              <Bar dataKey="cerrados"    fill="#30d158" radius={[3,3,0,0]} name={t.closed} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={CARD} className="flex flex-col items-center justify-center">
          <p className="text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>{t.totalAccumulated}</p>
          <PieChart width={140} height={140}>
            <Pie data={donutData} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" paddingAngle={2}>
              {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
          <div className="flex flex-col gap-1 mt-1 items-start">
            {donutData.filter(d => d.name !== 'Sin datos').map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs" style={{ color: '#6e6e73' }}>{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section 3: Delivering Value ───────────────────────────────────────────────

// Mirrors computePhaseStatus from usePlan.js using phase.progress (0-100)
function phaseMetrics(phase, lang = 'es') {
  const todayDate = new Date(); todayDate.setHours(0,0,0,0)
  const todayStr  = isoMonth(todayDate).slice(0,7) // not used for comparison below
  const start = new Date(phase.start_date + 'T00:00:00')
  const end   = new Date(phase.end_date   + 'T00:00:00')

  const totalDays   = Math.max(1, Math.round((end - start) / 86400000))
  const elapsedDays = Math.round((todayDate - start) / 86400000)
  const timePct     = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
  const progress    = phase.progress ?? 0   // ← same value as the Gantt bar

  const daysRemaining = Math.round((end - todayDate) / 86400000)
  const isCompleted   = progress >= 100
  const isUpcoming    = todayDate < start
  const isOverdue     = todayDate > end && !isCompleted
  const isActive      = !isUpcoming && !isCompleted && todayDate <= end

  const delta = progress - timePct  // positive = ahead of schedule

  // Same rules as computePhaseStatus
  let scheduleStatus, scheduleColor, scheduleLabel
  const s = SR[lang] ?? SR.es
  if (isCompleted)          { scheduleStatus = 'done';    scheduleColor = '#30d158'; scheduleLabel = s.phaseCompleted }
  else if (isUpcoming)      { scheduleStatus = 'upcoming';scheduleColor = '#6e6e73'; scheduleLabel = s.phasePending }
  else if (isOverdue)       { scheduleStatus = 'overdue'; scheduleColor = '#ff453a'; scheduleLabel = s.phaseOverdue }
  else if (timePct - progress > 25) { scheduleStatus = 'risk';   scheduleColor = '#ff9f0a'; scheduleLabel = s.phaseAtRisk }
  else if (delta > 8)       { scheduleStatus = 'ahead';   scheduleColor = '#30d158'; scheduleLabel = s.phaseAhead(Math.round(delta)) }
  else if (delta < -8)      { scheduleStatus = 'behind';  scheduleColor = '#ff9f0a'; scheduleLabel = s.phaseBehind(Math.round(delta)) }
  else                      { scheduleStatus = 'ontrack'; scheduleColor = '#64d2ff'; scheduleLabel = s.phaseOnTrack }

  return { timePct, progress, delta, daysRemaining, totalDays, elapsedDays,
           isCompleted, isUpcoming, isActive, isOverdue,
           scheduleStatus, scheduleColor, scheduleLabel }
}

// ── Gantt section (own block, between 01 and 02) ─────────────────────────────
function PlanGanttSection({ projectId }) {
  const [plan,   setPlan]   = useState(null)
  const [phases, setPhases] = useState([])

  useEffect(() => {
    async function load() {
      const { data: plans } = await supabase
        .from('project_plans').select('*').eq('project_id', projectId).limit(1)
      if (!plans?.length) return
      setPlan(plans[0])
      const { data: ph } = await supabase
        .from('plan_phases').select('*, plan_tasks(*)').eq('plan_id', plans[0].id).order('order_index')
      setPhases((ph ?? []).map(p => ({ ...p, plan_tasks: (p.plan_tasks ?? []).sort((a, b) => a.order_index - b.order_index) })))
    }
    load()
  }, [projectId])

  if (!plan || !phases.length) return null

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, backgroundColor: '#111111', overflow: 'hidden', margin: '0 -24px' }}>
      <GanttChart plan={plan} phases={phases} isEditable={false} />
    </div>
  )
}

function DeliveringValueSection({ projectId, project, onSave, lang = 'es' }) {
  const [phases, setPhases] = useState([])
  const [hasPlan, setHasPlan] = useState(null)
  const [showAllPhases, setShowAllPhases] = useState(false)
  const PHASES_VISIBLE = 4

  const [deliverables, setDeliverables] = useState([])
  const [addingDeliverable, setAddingDeliverable] = useState(false)
  const [newDelivName, setNewDelivName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: plans } = await supabase
        .from('project_plans').select('id').eq('project_id', projectId).limit(1)
      if (plans?.length) {
        setHasPlan(true)
        const { data: ph } = await supabase
          .from('plan_phases')
          .select('id, name, color, start_date, end_date, hours, is_milestone, progress')
          .eq('plan_id', plans[0].id).order('order_index')
        setPhases((ph ?? []).filter(p => !p.is_milestone))
      } else {
        setHasPlan(false)
      }
    }
    load()
    supabase.from('project_deliverables').select('*')
      .eq('project_id', projectId).order('created_at')
      .then(({ data }) => setDeliverables(data ?? []))
  }, [projectId])

  async function addDeliverable() {
    const name = newDelivName.trim()
    if (!name) return
    const { data, error } = await supabase.from('project_deliverables')
      .insert({ project_id: projectId, name, status: 'pending' })
      .select().single()
    if (error) { toast.error('Error al guardar'); return }
    setDeliverables(prev => [...prev, data])
    setNewDelivName('')
    setAddingDeliverable(false)
  }

  async function cycleStatus(deliv) {
    const next = deliv.status === 'pending' ? 'in_progress' : deliv.status === 'in_progress' ? 'done' : 'pending'
    const { error } = await supabase.from('project_deliverables')
      .update({ status: next }).eq('id', deliv.id)
    if (error) { toast.error('Error al guardar'); return }
    setDeliverables(prev => prev.map(d => d.id === deliv.id ? { ...d, status: next } : d))
  }

  async function deleteDeliverable(id) {
    const { error } = await supabase.from('project_deliverables').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar'); return }
    setDeliverables(prev => prev.filter(d => d.id !== id))
  }

  const t = SR[lang] ?? SR.es

  function delivStatusMeta(status) {
    if (status === 'done')        return { color: '#30d158', label: t.statusDone }
    if (status === 'in_progress') return { color: '#64d2ff', label: t.statusInProgress }
    return                               { color: '#3a3a3a', label: t.statusPending }
  }

  // Derived plan stats
  const phasesWithMetrics = phases.map(p => ({ ...p, metrics: phaseMetrics(p, lang) }))
  const activePhase     = phasesWithMetrics.find(p => p.metrics.isActive)
  const totalHours      = phases.reduce((s, p) => s + (p.hours ?? 0), 0)
  const overallPct      = phases.length > 0
    ? Math.round(phases.reduce((s, p) => s + (p.progress ?? 0), 0) / phases.length) : 0
  const completedPhases = phasesWithMetrics.filter(p => p.metrics.isCompleted).length

  const visiblePhases = showAllPhases ? phasesWithMetrics : phasesWithMetrics.slice(0, PHASES_VISIBLE)
  const hiddenCount   = phasesWithMetrics.length - PHASES_VISIBLE

  return (
    <div className="mb-2">
      {hasPlan === false && (
        <div style={{ ...CARD, marginBottom: 16 }}>
          <p className="text-sm" style={{ color: '#6e6e73' }}>{t.noPlan}</p>
        </div>
      )}

      {phases.length > 0 && (<>
        {/* Overall plan summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <KpiCard label={t.globalProgress} value={`${overallPct}%`}
            color={overallPct >= 75 ? '#30d158' : overallPct >= 40 ? '#64d2ff' : '#ff9f0a'} />
          <KpiCard label={t.phasesCompleted} value={`${completedPhases}/${phases.length}`}
            color="#f5f5f7" />
          <KpiCard label={t.plannedHours} value={totalHours > 0 ? `${totalHours}h` : '—'}
            color="#64d2ff" />
        </div>

        {/* Active phase spotlight */}
        {activePhase && (() => {
          const m = activePhase.metrics
          return (
            <div style={{ ...CARD, marginBottom: 16, border: `1px solid ${activePhase.color}30` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: activePhase.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: activePhase.color }}>{t.activePhase}</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: `${m.scheduleColor}18`, color: m.scheduleColor }}>
                  {m.scheduleLabel}
                </span>
              </div>
              <p className="text-lg font-semibold mb-4" style={{ color: '#f5f5f7' }}>{activePhase.name}</p>

              {/* Tiempo transcurrido */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1.5" style={{ color: '#6e6e73' }}>
                  <span>{t.timeElapsed}</span>
                  <span style={{ color: '#f5f5f7' }}>{Math.round(m.timePct)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${m.timePct}%`, backgroundColor: '#6e6e73' }} />
                </div>
                <p className="text-xs mt-1" style={{ color: '#6e6e73' }}>
                  {m.daysRemaining > 0 ? t.daysRemaining(m.daysRemaining) : t.daysOverdue(m.daysRemaining)}
                </p>
              </div>

              {/* Progreso */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5" style={{ color: '#6e6e73' }}>
                  <span>{t.progressLabel}</span>
                  <span style={{ color: activePhase.color }}>{m.progress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${m.progress}%`, backgroundColor: activePhase.color }} />
                </div>
              </div>

              {/* Delta indicator */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ backgroundColor: `${m.scheduleColor}10` }}>
                <span style={{ fontSize: 16 }}>
                  {m.scheduleStatus === 'ahead' ? '↑' : m.scheduleStatus === 'behind' ? '↓' : '→'}
                </span>
                <p className="text-xs" style={{ color: m.scheduleColor }}>
                  {m.scheduleStatus === 'ahead'   && t.aheadMsg(Math.round(m.delta))}
                  {m.scheduleStatus === 'behind'  && t.behindMsg(Math.abs(Math.round(m.delta)))}
                  {m.scheduleStatus === 'ontrack' && t.onTrackMsg}
                </p>
              </div>
            </div>
          )
        })()}

        {/* All phases */}
        <div style={CARD} className="mb-4">
          <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>{t.allPhases}</p>
          <div className="flex flex-col gap-4">
            {visiblePhases.map(phase => {
              const m = phase.metrics
              const isActive = phase.id === activePhase?.id
              return (
                <div key={phase.id} style={{ opacity: m.isUpcoming ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                      <span className="text-sm font-medium truncate" style={{ color: '#f5f5f7' }}>{phase.name}</span>
                      {isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${phase.color}20`, color: phase.color }}>{t.activeLabel}</span>
                      )}
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-3"
                      style={{ backgroundColor: `${m.scheduleColor}15`, color: m.scheduleColor }}>
                      {m.scheduleLabel}
                    </span>
                  </div>

                  <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${m.timePct}%`, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                      style={{ width: `${m.progress}%`, backgroundColor: phase.color }} />
                  </div>

                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: '#3a3a3a' }}>
                      {new Date(phase.start_date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(phase.end_date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: phase.color }}>{m.progress}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Expand / collapse */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllPhases(v => !v)}
              className="flex items-center gap-1.5 mt-4 text-xs transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', padding: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
              {showAllPhases
                ? <><ChevronUp className="w-3.5 h-3.5" /> {t.showLess}</>
                : <><ChevronDown className="w-3.5 h-3.5" /> {t.showMorePhases(hiddenCount)}</>
              }
            </button>
          )}
        </div>
      </>)}

      {/* Other deliverables */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium" style={{ color: '#6e6e73' }}>{t.otherDeliverables}</p>
          <button
            onClick={() => setAddingDeliverable(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
            onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
          >
            <Plus size={12} /> {t.addDeliverable}
          </button>
        </div>

        {deliverables.length === 0 && !addingDeliverable && (
          <p className="text-xs" style={{ color: '#3a3a3a' }}>—</p>
        )}

        <div className="flex flex-col gap-2">
          {deliverables.map(d => {
            const meta = delivStatusMeta(d.status)
            return (
              <div key={d.id} className="flex items-center justify-between gap-3 group">
                <span className="text-sm flex-1" style={{ color: '#f5f5f7' }}>{d.name}</span>
                <button
                  onClick={() => cycleStatus(d)}
                  style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${meta.color}30`, backgroundColor: `${meta.color}14`, color: meta.color, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                >{meta.label}</button>
                <button
                  onClick={() => deleteDeliverable(d.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3a3a', display: 'flex', opacity: 0, transition: 'opacity 0.15s', padding: 0 }}
                  className="group-hover:!opacity-100"
                  onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                  onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
                ><Trash2 size={12} /></button>
              </div>
            )
          })}
        </div>

        {addingDeliverable && (
          <div className="flex gap-2 mt-3">
            <input
              autoFocus
              value={newDelivName}
              onChange={e => setNewDelivName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addDeliverable(); if (e.key === 'Escape') { setAddingDeliverable(false); setNewDelivName('') } }}
              placeholder={t.deliverablePlaceholder}
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#f5f5f7', outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              onClick={addDeliverable}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#f5f5f7', color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >OK</button>
            <button
              onClick={() => { setAddingDeliverable(false); setNewDelivName('') }}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6e6e73', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            >✕</button>
          </div>
        )}
      </div>

      {/* Effort table + chart (global view) */}
      <EffortOverview projectId={projectId} project={project} onSave={onSave} lang={lang} />
    </div>
  )
}

// ── Effort Overview (monthly table + chart) — used in Global ─────────────────
function EffortOverview({ projectId, project, onSave, lang = 'es' }) {
  const [effort, setEffort] = useState([])
  const [editingEffort, setEditingEffort] = useState({})
  const [target, setTarget] = useState(project?.effort_target_hours ?? null)
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetBuf, setTargetBuf] = useState('')
  const months = lastNMonths(4)
  const thisMonth = isoMonth()

  useEffect(() => {
    supabase.from('project_effort').select('*').eq('project_id', projectId)
      .then(({ data }) => setEffort(data ?? []))
  }, [projectId])

  async function saveTarget() {
    const val = targetBuf === '' ? null : parseFloat(targetBuf)
    if (targetBuf !== '' && (isNaN(val) || val < 0)) { toast.error('Valor inválido'); return }
    setTarget(val)
    setEditingTarget(false)
    await supabase.from('projects').update({ effort_target_hours: val }).eq('id', projectId)
    onSave?.({ effort_target_hours: val })
  }

  async function saveEffort(monthYear, hours) {
    const val = parseFloat(hours)
    if (isNaN(val) || val < 0) { toast.error('Horas inválidas'); return }
    const { error } = await supabase
      .from('project_effort')
      .upsert({ project_id: projectId, month_year: monthYear, hours: val }, { onConflict: 'project_id,month_year' })
    if (error) { toast.error('Error al guardar'); return }
    setEffort(prev => {
      const idx = prev.findIndex(e => e.month_year === monthYear)
      if (idx >= 0) return prev.map(e => e.month_year === monthYear ? { ...e, hours: val } : e)
      return [...prev, { month_year: monthYear, hours: val }]
    })
    setEditingEffort(prev => { const n = { ...prev }; delete n[monthYear]; return n })
  }

  const t = SR[lang] ?? SR.es
  const effortMap = Object.fromEntries(effort.map(e => [e.month_year, e.hours]))
  const chartData  = months.map(m => ({ month: monthLabel(m, t.locale), horas: effortMap[m] ?? 0 }))

  return (<>
    <div style={CARD} className="mb-4 mt-4">
      <p className="text-xs font-medium mb-1" style={{ color: '#6e6e73' }}>{t.effortHoursLabel}</p>
      <p className="text-xs mb-4" style={{ color: '#3a3a3a' }}>{t.clickToEdit}</p>
      <div className="overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {months.map(m => (
                <th key={m} style={{ color: m === thisMonth ? '#f5f5f7' : '#6e6e73',
                                     fontWeight: m === thisMonth ? 600 : 500,
                                     textAlign: 'center', paddingBottom: 8, minWidth: 72, whiteSpace: 'nowrap' }}>
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {months.map(m => {
                const isEditing = editingEffort[m] !== undefined
                const val = effortMap[m]
                return (
                  <td key={m} style={{ textAlign: 'center', padding: '8px 4px' }}>
                    {isEditing ? (
                      <input autoFocus type="number" min="0"
                        style={{ ...INPUT, width: 64, textAlign: 'center', padding: '4px 6px' }}
                        value={editingEffort[m]}
                        onChange={e => setEditingEffort(prev => ({ ...prev, [m]: e.target.value }))}
                        onBlur={() => saveEffort(m, editingEffort[m])}
                        onKeyDown={e => { if (e.key === 'Enter') saveEffort(m, editingEffort[m]) }}
                        onFocus={fi}
                      />
                    ) : (
                      <button onClick={() => setEditingEffort(prev => ({ ...prev, [m]: val ?? '' }))}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.06)',
                                 cursor: 'pointer', color: val ? '#64d2ff' : '#3a3a3a', fontSize: 12,
                                 padding: '4px 8px', borderRadius: 6,
                                 backgroundColor: val ? 'rgba(100,210,255,0.06)' : 'rgba(255,255,255,0.02)',
                                 fontWeight: val ? 600 : 400 }}>
                        {val != null ? `${val}h` : '—'}
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div style={CARD}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium" style={{ color: '#6e6e73' }}>{t.effortEvolution}</p>
        <div className="flex items-center gap-2">
          {target != null && !editingTarget && (
            <span className="text-xs" style={{ color: '#ff9f0a' }}>
              — {t.effortTarget}: {target}h
            </span>
          )}
          {editingTarget ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus type="number" min="0" placeholder="0"
                style={{ ...INPUT, width: 72, padding: '3px 8px', fontSize: 12, textAlign: 'center' }}
                value={targetBuf}
                onChange={e => setTargetBuf(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false) }}
                onFocus={fi}
              />
              <button onClick={saveTarget}
                style={{ fontSize: 11, color: '#30d158', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>
                ✓
              </button>
              <button onClick={() => setEditingTarget(false)}
                style={{ fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => { setTargetBuf(target != null ? String(target) : ''); setEditingTarget(true) }}
              style={{ fontSize: 11, color: '#6e6e73', background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                       borderRadius: 6, cursor: 'pointer', padding: '3px 8px',
                       transition: 'color 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
              {target != null ? t.effortTarget : `+ ${t.effortTarget}`}
            </button>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="horas" fill="#64d2ff" radius={[4,4,0,0]} name={t.hoursBar} />
          {target != null
            ? <ReferenceLine y={Number(target)} stroke="#ff9f0a" strokeWidth={2}
                label={{ value: `${target}h`, position: 'insideTopRight', fill: '#ff9f0a', fontSize: 11, fontWeight: 600, dy: -6 }} />
            : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </>)
}

// ── Team Effort This Month ────────────────────────────────────────────────────
function TeamEffortMonth({ projectId, lang = 'es' }) {
  // weeks: all Mondays within current month
  const now = new Date()
  const y = now.getFullYear(), mo = now.getMonth()
  const monthStart = new Date(y, mo, 1)
  const monthEnd   = new Date(y, mo + 1, 0)

  function mondaysInMonth() {
    const weeks = []
    const d = new Date(monthStart)
    // advance to first Monday
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
    while (d <= monthEnd) {
      const p = n => String(n).padStart(2, '0')
      weeks.push(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`)
      d.setDate(d.getDate() + 7)
    }
    return weeks
  }
  const weeks = mondaysInMonth()

  function weekShortLabel(iso) {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString((SR[lang] ?? SR.es).locale, { day: 'numeric', month: 'short' })
  }

  const [data, setData] = useState([])  // [{name, role, weeks: {weekStr: {planned,actual}}]

  useEffect(() => {
    async function load() {
      const ms = `${y}-${String(mo+1).padStart(2,'0')}-01`
      const me = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth()+1).padStart(2,'0')}-${String(monthEnd.getDate()).padStart(2,'0')}`

      const { data: resources } = await supabase
        .from('project_resources')
        .select('id, name, role')
        .eq('project_id', projectId)
        .order('created_at')
      if (!resources?.length) { setData([]); return }

      const ids = resources.map(r => r.id)
      const { data: allocs } = await supabase
        .from('resource_allocations')
        .select('resource_id, week_start, hours, actual_hours')
        .in('resource_id', ids)
        .gte('week_start', ms)
        .lte('week_start', me)

      const allocMap = {}
      for (const a of allocs ?? []) {
        const k = `${a.resource_id}_${a.week_start}`
        allocMap[k] = { planned: a.hours ?? 0, actual: a.actual_hours ?? 0 }
      }

      const rows = resources.map(r => ({
        id: r.id, name: r.name, role: r.role,
        weeks: Object.fromEntries(weeks.map(w => [w, allocMap[`${r.id}_${w}`] ?? { planned: 0, actual: 0 }])),
      })).filter(r => weeks.some(w => r.weeks[w].planned > 0 || r.weeks[w].actual > 0))

      setData(rows)
    }
    load()
  }, [projectId])

  if (data.length === 0) return null

  // max hours across all cells for scaling bars
  const maxH = Math.max(1, ...data.flatMap(r => weeks.flatMap(w => [r.weeks[w].planned, r.weeks[w].actual])))

  return (
    <div style={CARD} className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium" style={{ color: '#6e6e73' }}>Esfuerzo del equipo este mes por semana</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <span className="text-xs" style={{ color: '#6e6e73' }}>Planificado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: '#64d2ff' }} />
            <span className="text-xs" style={{ color: '#6e6e73' }}>Real</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {data.map(r => (
          <div key={r.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-medium" style={{ color: '#f5f5f7' }}>{r.name}</span>
              {r.role && <span className="text-xs" style={{ color: '#6e6e73' }}>{r.role}</span>}
            </div>
            <div className="flex gap-3 items-end">
              {weeks.map(w => {
                const { planned, actual } = r.weeks[w]
                const planH = Math.round((planned / maxH) * 80)
                const actH  = Math.round((actual  / maxH) * 80)
                const hasData = planned > 0 || actual > 0
                return (
                  <div key={w} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                    {/* Bars */}
                    <div className="flex items-end gap-0.5" style={{ height: 80 }}>
                      {/* Planned */}
                      <div style={{ width: 10, height: planH || 2, borderRadius: '3px 3px 0 0',
                                    backgroundColor: 'rgba(255,255,255,0.12)',
                                    transition: 'height 0.3s' }} />
                      {/* Actual */}
                      <div style={{ width: 10, height: actH || (actual > 0 ? 2 : 0), borderRadius: '3px 3px 0 0',
                                    backgroundColor: actual > 0 ? '#64d2ff' : 'transparent',
                                    transition: 'height 0.3s' }} />
                    </div>
                    {/* Hour labels */}
                    {hasData && (
                      <span className="text-xs" style={{ color: actual > 0 ? '#64d2ff' : '#3a3a3a', whiteSpace: 'nowrap' }}>
                        {actual > 0 ? `${actual}h` : `${planned}h`}
                      </span>
                    )}
                    {/* Week label */}
                    <span className="text-xs" style={{ color: '#3a3a3a', whiteSpace: 'nowrap', fontSize: 10 }}>
                      {weekShortLabel(w)}
                    </span>
                  </div>
                )
              })}
              {/* Total */}
              <div className="flex flex-col items-center gap-1 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs font-semibold" style={{ color: '#f5f5f7' }}>
                  {weeks.reduce((s, w) => s + (r.weeks[w].actual || r.weeks[w].planned), 0)}h
                </span>
                <span className="text-xs" style={{ color: '#3a3a3a', fontSize: 10 }}>total</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 4: Team Performance ───────────────────────────────────────────────
function getTeamKpiFields(lang) {
  const t = SR[lang] ?? SR.es
  return [
    { key: 'tasks_closed',      label: t.tasksClosedMonth, color: '#30d158' },
    { key: 'bugs_closed',       label: t.bugsClosedMonth,  color: '#ff9f0a' },
    { key: 'in_progress',       label: t.inProgress,       color: '#64d2ff' },
    { key: 'points_committed',  label: t.spCommitted,      color: '#bf5af2' },
    { key: 'points_completed',  label: t.spCompleted,      color: '#5e5ce6' },
  ]
}

const EMPTY_KPIS = { tasks_closed: 0, bugs_closed: 0, in_progress: 0, points_committed: 0, points_completed: 0 }

function TeamPerformanceSection({ projectId, lang = 'es' }) {
  const months    = lastNMonths(4)  // [3 months ago … this month]
  const thisMonth = months[months.length - 1]
  const [allKpis, setAllKpis] = useState({})  // month_year → kpis row
  const [editing, setEditing] = useState(null)
  const [draft,   setDraft]   = useState('')

  useEffect(() => {
    supabase
      .from('project_team_kpis')
      .select('*')
      .eq('project_id', projectId)
      .in('month_year', months)
      .then(({ data }) => {
        const map = {}
        ;(data ?? []).forEach(r => { map[r.month_year] = r })
        setAllKpis(map)
      })
  }, [projectId])  // eslint-disable-line react-hooks/exhaustive-deps

  const t = SR[lang] ?? SR.es
  const TEAM_KPI_FIELDS = getTeamKpiFields(lang)
  const currentKpis = allKpis[thisMonth] ?? EMPTY_KPIS

  async function save(key, value) {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) { setEditing(null); return }
    const updated = { ...currentKpis, [key]: num }
    setAllKpis(prev => ({ ...prev, [thisMonth]: updated }))
    setEditing(null)
    const { error } = await supabase
      .from('project_team_kpis')
      .upsert({ project_id: projectId, month_year: thisMonth, ...updated },
               { onConflict: 'project_id,month_year' })
    if (error) toast.error('Error al guardar')
  }

  function donutFor(kpis) {
    const data = [
      { name: 'Tareas cerradas', value: kpis.tasks_closed ?? 0, color: '#30d158' },
      { name: 'Bugs cerrados',   value: kpis.bugs_closed  ?? 0, color: '#ff9f0a' },
      { name: 'En progreso',     value: kpis.in_progress  ?? 0, color: '#64d2ff' },
    ].filter(d => d.value > 0)
    if (data.length === 0) data.push({ name: 'Sin datos', value: 1, color: '#2a2a2a' })
    return data
  }

  const spCommitted = currentKpis.points_committed ?? 0
  const spCompleted = currentKpis.points_completed ?? 0
  const spRate      = spCommitted > 0 ? Math.round(spCompleted / spCommitted * 100) : 0
  const spColor     = spRate >= 80 ? '#30d158' : spRate >= 50 ? '#ff9f0a' : '#ff453a'

  return (
    <div className="mb-2">
      {/* Editable KPI cards — current month */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {TEAM_KPI_FIELDS.slice(0, 3).map(f => (
          <div key={f.key} style={{ ...CARD, cursor: 'pointer' }}
            onClick={() => { setEditing(f.key); setDraft(String(currentKpis[f.key] ?? 0)) }}>
            <p className="text-xs mb-1" style={{ color: '#6e6e73' }}>{f.label}</p>
            {editing === f.key ? (
              <input
                autoFocus type="number" min="0"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => save(f.key, draft)}
                onKeyDown={e => { if (e.key === 'Enter') save(f.key, draft); if (e.key === 'Escape') setEditing(null) }}
                style={{ ...INPUT, fontSize: 22, fontWeight: 700, padding: '2px 0', backgroundColor: 'transparent',
                         border: 'none', borderBottom: `1px solid ${f.color}`, borderRadius: 0, width: '100%', color: f.color }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <p className="text-2xl font-bold mt-1" style={{ color: f.color }}>
                {currentKpis[f.key] ?? 0}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Story Points */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>{t.spRate}</p>
        <div className="grid grid-cols-3 gap-4 mb-3">
          {TEAM_KPI_FIELDS.slice(3).map(f => (
            <div key={f.key} style={{ cursor: 'pointer' }}
              onClick={() => { setEditing(f.key); setDraft(String(currentKpis[f.key] ?? 0)) }}>
              <p className="text-xs mb-1" style={{ color: '#6e6e73' }}>{f.label}</p>
              {editing === f.key ? (
                <input
                  autoFocus type="number" min="0"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => save(f.key, draft)}
                  onKeyDown={e => { if (e.key === 'Enter') save(f.key, draft); if (e.key === 'Escape') setEditing(null) }}
                  style={{ ...INPUT, fontSize: 22, fontWeight: 700, padding: '2px 0', backgroundColor: 'transparent',
                           border: 'none', borderBottom: `1px solid ${f.color}`, borderRadius: 0, width: '100%', color: f.color }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <p className="text-2xl font-bold mt-1" style={{ color: f.color }}>{currentKpis[f.key] ?? 0}</p>
              )}
            </div>
          ))}
          <div>
            <p className="text-xs mb-1" style={{ color: '#6e6e73' }}>{t.spRate}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: spColor }}>{spCommitted > 0 ? `${spRate}%` : '—'}</p>
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(spRate, 100)}%`, borderRadius: 4, backgroundColor: spColor, opacity: 0.8, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Bar chart — distribución por mes */}
      <div style={CARD}>
        <p className="text-xs font-medium mb-1" style={{ color: '#6e6e73' }}>{t.workDistribution}</p>
        <div className="flex items-center gap-4 mb-4">
          {[{ color: '#30d158', label: t.tasksClosed }, { color: '#ff9f0a', label: t.bugsClosed }, { color: '#64d2ff', label: t.inProgress }].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-xs" style={{ color: '#6e6e73' }}>{l.label}</span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={months.map(m => ({ month: monthLabel(m, t.locale), tareas: allKpis[m]?.tasks_closed ?? 0, bugs: allKpis[m]?.bugs_closed ?? 0, progreso: allKpis[m]?.in_progress ?? 0 }))} barSize={10} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="tareas"   fill="#30d158" radius={[3,3,0,0]} name={t.tasksClosed} />
            <Bar dataKey="bugs"     fill="#ff9f0a" radius={[3,3,0,0]} name={t.bugsClosed} />
            <Bar dataKey="progreso" fill="#64d2ff" radius={[3,3,0,0]} name={t.inProgress} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Helpers (shared with ProjectFinances) ─────────────────────────────────────
function fmtMoney(n, cur = '€') {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1000000) return `${sign}${cur}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1000)    return `${sign}${cur}${(abs / 1000).toFixed(1)}k`
  return `${sign}${cur}${abs.toFixed(0)}`
}
function profitHealth(margin, target, lang = 'es') {
  const t = SR[lang] ?? SR.es
  if (margin >= target)      return { color: '#30d158', label: t.onTarget }
  if (margin >= target / 2)  return { color: '#ff9f0a', label: t.phaseAtRisk }
  return                            { color: '#ff453a', label: t.critical }
}

// ── Section 5: Profitability ──────────────────────────────────────────────────
function ProfitabilitySection({ projectId, lang = 'es' }) {
  const [fin,       setFin]       = useState(null)
  const [resources, setResources] = useState([])
  const [actual,    setActual]    = useState({})
  const [planned,   setPlanned]   = useState({})
  const [invoices,  setInvoices]  = useState([])

  useEffect(() => {
    async function load() {
      const { data: resData } = await supabase
        .from('project_resources').select('*').eq('project_id', projectId)
      const ids = (resData ?? []).map(r => r.id)

      const [{ data: finData }, { data: allocData }, { data: invData }] = await Promise.all([
        supabase.from('project_financials').select('*').eq('project_id', projectId).maybeSingle(),
        ids.length > 0
          ? supabase.from('resource_allocations').select('resource_id,week_start,hours,actual_hours').in('resource_id', ids)
          : { data: [] },
        supabase.from('project_invoices').select('amount,invoice_date,description').eq('project_id', projectId).order('invoice_date'),
      ])

      setFin(finData)
      setResources(resData ?? [])
      setInvoices(invData ?? [])
      const aMap = {}, pMap = {}
      ;(allocData ?? []).forEach(a => {
        if (a.actual_hours) aMap[`${a.resource_id}_${a.week_start}`] = a.actual_hours
        if (a.hours)        pMap[`${a.resource_id}_${a.week_start}`] = a.hours
      })
      setActual(aMap)
      setPlanned(pMap)
    }
    load()
  }, [projectId])

  const t = SR[lang] ?? SR.es
  if (!fin && resources.length === 0) return (
    <div style={CARD}>
      <p className="text-sm" style={{ color: '#6e6e73' }}>{t.noFinancialData}</p>
    </div>
  )

  const cur      = fin?.currency ?? '€'
  const contract = fin?.contract_value ?? 0
  const target   = fin?.target_margin  ?? 20
  const etdBase  = fin?.effort_to_date != null ? Number(fin.effort_to_date) : 0
  const today    = new Date().toISOString().slice(0, 10)

  // Actual ETD cost (actual hours logged to date)
  const etd = etdBase + resources.reduce((sum, r) => {
    const hours = Object.keys(actual)
      .filter(k => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= today)
      .reduce((s, k) => s + (actual[k] || 0), 0)
    return sum + (hours + (r.hours_to_date || 0)) * (r.hourly_rate || 0)
  }, 0)

  // Estimated total cost (from planned allocation hours — forward-looking)
  const hasPlanned = Object.keys(planned).length > 0
  const estimatedCost = hasPlanned
    ? etdBase + resources.reduce((sum, r) => {
        const hours = Object.keys(planned)
          .filter(k => k.startsWith(r.id + '_'))
          .reduce((s, k) => s + (planned[k] || 0), 0) + (r.hours_to_date || 0)
        return sum + hours * (r.hourly_rate || 0)
      }, 0)
    : etd

  const billed = invoices.length > 0
    ? invoices.reduce((s, i) => s + i.amount, 0)
    : (fin?.invoiced_to_date ?? 0)

  const currentProfit      = billed - etd
  const currentMargin      = billed > 0 ? (currentProfit / billed) * 100 : 0
  const remainingBudget    = contract - etd
  const estimatedProfit    = contract - estimatedCost
  const estimatedMarginPct = contract > 0 ? (estimatedProfit / contract) * 100 : 0
  const budgetConsumedPct  = contract > 0 ? Math.min(100, (etd / contract) * 100) : 0
  const estConsumedPct     = contract > 0 ? Math.min(100, (estimatedCost / contract) * 100) : 0

  const heroColor = estConsumedPct < 75 ? '#30d158' : estConsumedPct < 95 ? '#ff9f0a' : '#ff453a'
  const heroLabel = estConsumedPct < 75 ? t.healthGood : estConsumedPct < 95 ? t.healthWarning : t.healthRisk
  const h = profitHealth(currentMargin, target, lang)

  return (
    <div className="mb-2">
      {/* ── Hero health card ── */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        {/* Badge row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: heroColor,
              boxShadow: `0 0 7px ${heroColor}` }} />
            <span className="text-xs font-semibold tracking-wide" style={{ color: heroColor }}>
              {heroLabel}
            </span>
          </div>
          <span className="text-xs" style={{ color: '#6e6e73' }}>{t.budgetHealth}</span>
        </div>

        {/* Large % + right info */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: heroColor }}>
              {budgetConsumedPct.toFixed(0)}<span style={{ fontSize: 28, fontWeight: 600 }}>%</span>
            </div>
            <div className="text-xs mt-1" style={{ color: '#6e6e73' }}>{t.budgetConsumed}</div>
          </div>
          {hasPlanned && (
            <div className="text-right pb-1">
              <div className="text-xs mb-0.5" style={{ color: '#6e6e73' }}>{t.estimatedCostLabel}</div>
              <div className="text-sm font-semibold" style={{ color: estConsumedPct > 100 ? '#ff453a' : '#f5f5f7' }}>
                {fmtMoney(estimatedCost, cur)}
              </div>
              <div className="text-xs" style={{ color: estConsumedPct > 95 ? '#ff453a' : '#6e6e73' }}>
                {estConsumedPct.toFixed(0)}% {lang === 'en' ? 'of contract' : 'del contrato'}
              </div>
            </div>
          )}
        </div>

        {/* Budget bars */}
        <div className="mb-1">
          {/* Estimated bar (dim, behind) */}
          {hasPlanned && (
            <div style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)',
              marginBottom: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${estConsumedPct}%`, borderRadius: 3,
                backgroundColor: `${heroColor}45`, transition: 'width 0.7s ease' }} />
            </div>
          )}
          {/* ETD actual bar */}
          <div style={{ height: 10, borderRadius: 5,
            backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${budgetConsumedPct}%`, borderRadius: 5,
              backgroundColor: heroColor, transition: 'width 0.7s ease' }} />
          </div>
        </div>
        <div className="flex justify-between text-xs mb-5" style={{ color: '#6e6e73' }}>
          <span>{cur}0</span>
          <span>{fmtMoney(contract, cur)}</span>
        </div>

        {/* 4-col metric row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            { label: t.budget,               value: fmtMoney(contract, cur),  color: '#f5f5f7' },
            { label: t.etdCost,              value: fmtMoney(etd, cur),        color: '#64d2ff' },
            { label: t.remainingBudget,      value: fmtMoney(remainingBudget, cur),
              color: remainingBudget >= 0 ? '#f5f5f7' : '#ff453a' },
            { label: t.estimatedMarginLabel,
              value: contract > 0 ? `${estimatedMarginPct.toFixed(1)}%` : '—',
              color: estimatedMarginPct >= target ? '#30d158' : estimatedMarginPct >= 0 ? '#ff9f0a' : '#ff453a' },
          ].map(m => (
            <div key={m.label}>
              <p className="text-xs mb-1" style={{ color: '#6e6e73' }}>{m.label}</p>
              <p className="text-base font-semibold" style={{ color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Billed + current margin */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <KpiCard label={t.billed}        value={fmtMoney(billed, cur)}    color="#30d158" />
        <KpiCard label={t.currentMargin} value={billed > 0 ? `${currentMargin.toFixed(1)}%` : '—'} color={h.color} />
      </div>

      {/* Resource breakdown */}
      {resources.length > 0 && (() => {
        const rows = resources.map(r => {
          const actualHours = Object.keys(actual)
            .filter(k => k.startsWith(r.id + '_'))
            .reduce((s, k) => s + (actual[k] || 0), 0) + (r.hours_to_date || 0)
          const plannedHours = Object.keys(planned)
            .filter(k => k.startsWith(r.id + '_'))
            .reduce((s, k) => s + (planned[k] || 0), 0) + (r.hours_to_date || 0)
          const remHours = plannedHours - actualHours
          return {
            ...r,
            totalHours: actualHours,
            cost: actualHours * (r.hourly_rate || 0),
            plannedHours,
            remHours,
            remCost: remHours * (r.hourly_rate || 0),
          }
        }).filter(r => r.totalHours > 0 || r.plannedHours > 0 || r.hourly_rate > 0)
        if (!rows.length) return null
        const totalCost    = rows.reduce((s, r) => s + r.cost, 0)
        const totalHours   = rows.reduce((s, r) => s + r.totalHours, 0)
        const totalRemH    = rows.reduce((s, r) => s + r.remHours, 0)
        const totalRemCost = rows.reduce((s, r) => s + r.remCost, 0)
        const remColor = n => n < 0 ? '#ff453a' : n > 0 ? '#ff9f0a' : '#6e6e73'
        const headers = hasPlanned
          ? [t.resName, t.resRole, t.resHours, t.resRate, t.resCost, t.resRemH, t.resRemCost]
          : [t.resName, t.resRole, t.resHours, t.resRate, t.resCost]
        return (
          <div style={{ ...CARD, marginTop: 12, overflowX: 'auto' }}>
            <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>{t.resourceBreakdown}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {headers.map(h => (
                    <th key={h} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 16, color: '#6e6e73', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 16px 8px 0', color: '#f5f5f7', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '8px 16px 8px 0', color: '#6e6e73' }}>{r.role || '—'}</td>
                    <td style={{ padding: '8px 16px 8px 0', color: '#f5f5f7' }}>{r.totalHours.toFixed(1)}h</td>
                    <td style={{ padding: '8px 16px 8px 0', color: '#6e6e73' }}>{r.hourly_rate ? `${cur}${r.hourly_rate}/h` : '—'}</td>
                    <td style={{ padding: '8px 16px 8px 0', color: '#64d2ff', fontWeight: 500 }}>{fmtMoney(r.cost, cur)}</td>
                    {hasPlanned && <>
                      <td style={{ padding: '8px 16px 8px 0', color: remColor(r.remHours), fontWeight: 500 }}>
                        {r.remHours >= 0 ? '' : '−'}{Math.abs(r.remHours).toFixed(1)}h
                      </td>
                      <td style={{ padding: '8px 0 8px 0', color: remColor(r.remCost), fontWeight: 500 }}>
                        {r.remCost < 0 ? '−' : ''}{fmtMoney(Math.abs(r.remCost), cur)}
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td colSpan={2} style={{ paddingTop: 8, color: '#6e6e73', fontWeight: 600 }}>{t.resTotal}</td>
                  <td style={{ paddingTop: 8, color: '#f5f5f7', fontWeight: 600 }}>{totalHours.toFixed(1)}h</td>
                  <td />
                  <td style={{ paddingTop: 8, color: '#64d2ff', fontWeight: 600 }}>{fmtMoney(totalCost, cur)}</td>
                  {hasPlanned && <>
                    <td style={{ paddingTop: 8, fontWeight: 600, color: remColor(totalRemH) }}>
                      {totalRemH >= 0 ? '' : '−'}{Math.abs(totalRemH).toFixed(1)}h
                    </td>
                    <td style={{ paddingTop: 8, fontWeight: 600, color: remColor(totalRemCost) }}>
                      {totalRemCost < 0 ? '−' : ''}{fmtMoney(Math.abs(totalRemCost), cur)}
                    </td>
                  </>}
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })()}

      {/* Monthly cost evolution */}
      {(() => {
        const monthMap = {}
        resources.forEach(r => {
          Object.keys(actual).filter(k => k.startsWith(r.id + '_')).forEach(k => {
            const month = k.slice(r.id.length + 1, r.id.length + 8) // YYYY-MM
            monthMap[month] = (monthMap[month] || 0) + (actual[k] || 0) * (r.hourly_rate || 0)
          })
        })
        const invByMonth = {}
        invoices.forEach(inv => {
          if (!inv.invoice_date) return
          const month = inv.invoice_date.slice(0, 7)
          invByMonth[month] = (invByMonth[month] || 0) + inv.amount
        })
        const allMonths = [...new Set([...Object.keys(monthMap), ...Object.keys(invByMonth)])].sort()
        if (!allMonths.length) return null
        const chartData = allMonths.map(m => ({
          month: m.slice(0, 7),
          [t.evoCost]: Math.round(monthMap[m] || 0),
          [t.evoBilled]: Math.round(invByMonth[m] || 0),
        }))
        return (
          <div style={{ ...CARD, marginTop: 12 }}>
            <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>{t.costEvolution}</p>
            <div className="flex items-center gap-4 mb-3">
              {[{ color: '#64d2ff', label: t.evoCost }, { color: '#30d158', label: t.evoBilled }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-xs" style={{ color: '#6e6e73' }}>{l.label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={14} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoney(v, cur)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={v => fmtMoney(v, cur)} />
                <Bar dataKey={t.evoCost}   fill="#64d2ff" radius={[3,3,0,0]} />
                <Bar dataKey={t.evoBilled} fill="#30d158" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* Invoice list */}
      {invoices.length > 0 && (
        <div style={{ ...CARD, marginTop: 12, overflowX: 'auto' }}>
          <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>{t.invoiceList}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {[t.invDate, t.invDesc, t.invAmount].map(h => (
                  <th key={h} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 16, color: '#6e6e73', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 16px 8px 0', color: '#6e6e73', whiteSpace: 'nowrap' }}>{inv.invoice_date ? fmtDate(inv.invoice_date, lang === 'en' ? 'en-GB' : 'es-ES') : '—'}</td>
                  <td style={{ padding: '8px 16px 8px 0', color: '#d1d1d6' }}>{inv.description || t.invNoDesc}</td>
                  <td style={{ padding: '8px 0 8px 0', color: '#30d158', fontWeight: 500 }}>{fmtMoney(inv.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <td colSpan={2} style={{ paddingTop: 8, color: '#6e6e73', fontWeight: 600 }}>{t.resTotal}</td>
                <td style={{ paddingTop: 8, color: '#30d158', fontWeight: 600 }}>{fmtMoney(invoices.reduce((s, i) => s + i.amount, 0), cur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <LicensesCard projectId={projectId} lang={lang} />
    </div>
  )
}

// ── Licenses Card (independent of project finances) ──────────────────────────
function LicensesCard({ projectId, lang = 'es', readOnly = false, initialRows = null }) {
  const [rows, setRows] = useState(initialRows ?? [])
  const [editing, setEditing] = useState({}) // { id: { name, count, unit_price, currency } }
  const t = SR[lang] ?? SR.es

  useEffect(() => {
    if (initialRows !== null) return
    supabase.from('project_licenses').select('*').eq('project_id', projectId).order('created_at')
      .then(({ data }) => setRows(data ?? []))
  }, [projectId])

  async function addRow() {
    const { data, error } = await supabase.from('project_licenses')
      .insert({ project_id: projectId, name: '', count: 0, unit_price: 0, currency: '€' })
      .select().single()
    if (error) { toast.error('Error al guardar'); return }
    setRows(prev => [...prev, data])
    setEditing(prev => ({ ...prev, [data.id]: { name: '', count: '0', unit_price: '0', currency: '€' } }))
  }

  async function saveRow(id) {
    const e = editing[id]
    if (!e) return
    const count = parseInt(e.count, 10) || 0
    const unit_price = parseFloat(e.unit_price) || 0
    const { error } = await supabase.from('project_licenses')
      .update({ name: e.name, count, unit_price, currency: e.currency || '€' }).eq('id', id)
    if (error) { toast.error('Error al guardar'); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, name: e.name, count, unit_price, currency: e.currency || '€' } : r))
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function deleteRow(id) {
    await supabase.from('project_licenses').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function startEdit(row) {
    setEditing(prev => ({ ...prev, [row.id]: { name: row.name, count: String(row.count), unit_price: String(row.unit_price), currency: row.currency } }))
  }

  const grandTotal = rows.reduce((s, r) => s + (r.count || 0) * (r.unit_price || 0), 0)
  const currency = rows[0]?.currency ?? '€'

  if (rows.length === 0 && readOnly) return null

  return (
    <div style={{ ...CARD, marginTop: 12 }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold" style={{ color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.licensesTitle}</p>
        {grandTotal > 0 && (
          <span className="text-sm font-bold" style={{ color: '#bf5af2' }}>{fmtMoney(grandTotal, currency)}</span>
        )}
      </div>

      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[t.licName, t.licCount, t.licPrice, t.licTotal].map(h => (
                <th key={h} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 12, color: '#6e6e73', fontWeight: 500 }}>{h}</th>
              ))}
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const e = editing[row.id]
              const total = (row.count || 0) * (row.unit_price || 0)
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {e ? (
                    <>
                      <td style={{ padding: '6px 12px 6px 0' }}>
                        <input style={{ ...INPUT, padding: '4px 8px', fontSize: 12 }} value={e.name}
                          placeholder={t.licNamePlaceholder}
                          onChange={ev => setEditing(p => ({ ...p, [row.id]: { ...p[row.id], name: ev.target.value } }))}
                          onKeyDown={ev => ev.key === 'Enter' && saveRow(row.id)} onFocus={fi} />
                      </td>
                      <td style={{ padding: '6px 12px 6px 0' }}>
                        <input style={{ ...INPUT, padding: '4px 8px', fontSize: 12, width: 72, textAlign: 'right' }} type="number" min="0" value={e.count}
                          onChange={ev => setEditing(p => ({ ...p, [row.id]: { ...p[row.id], count: ev.target.value } }))}
                          onKeyDown={ev => ev.key === 'Enter' && saveRow(row.id)} onFocus={fi} />
                      </td>
                      <td style={{ padding: '6px 12px 6px 0' }}>
                        <div className="flex items-center gap-1">
                          <input style={{ ...INPUT, padding: '4px 6px', fontSize: 12, width: 32, textAlign: 'center' }} value={e.currency}
                            maxLength={3}
                            onChange={ev => setEditing(p => ({ ...p, [row.id]: { ...p[row.id], currency: ev.target.value } }))}
                            onFocus={fi} />
                          <input style={{ ...INPUT, padding: '4px 8px', fontSize: 12, width: 80, textAlign: 'right' }} type="number" min="0" value={e.unit_price}
                            onChange={ev => setEditing(p => ({ ...p, [row.id]: { ...p[row.id], unit_price: ev.target.value } }))}
                            onKeyDown={ev => ev.key === 'Enter' && saveRow(row.id)} onFocus={fi} />
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px 6px 0', color: '#bf5af2', fontWeight: 500 }}>
                        {fmtMoney((parseInt(e.count) || 0) * (parseFloat(e.unit_price) || 0), e.currency || '€')}
                      </td>
                      <td style={{ padding: '6px 0', whiteSpace: 'nowrap' }}>
                        <button onClick={() => saveRow(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#30d158', fontSize: 12, marginRight: 6 }}>✓</button>
                        <button onClick={() => setEditing(p => { const n = { ...p }; delete n[row.id]; return n })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', fontSize: 12 }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '8px 12px 8px 0', color: row.name ? '#f5f5f7' : '#3a3a3a', fontStyle: row.name ? 'normal' : 'italic' }}>
                        {row.name || t.licNamePlaceholder}
                      </td>
                      <td style={{ padding: '8px 12px 8px 0', color: '#f5f5f7', textAlign: 'right', paddingRight: 24 }}>{row.count}</td>
                      <td style={{ padding: '8px 12px 8px 0', color: '#6e6e73' }}>{fmtMoney(row.unit_price, row.currency)}</td>
                      <td style={{ padding: '8px 12px 8px 0', color: '#bf5af2', fontWeight: 600 }}>{fmtMoney(total, row.currency)}</td>
                      {!readOnly && (
                        <td style={{ padding: '8px 0', whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEdit(row)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', fontSize: 12, marginRight: 6 }}>✎</button>
                          <button onClick={() => deleteRow(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff453a', fontSize: 12 }}>✕</button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <td colSpan={3} style={{ paddingTop: 8, color: '#6e6e73', fontWeight: 600 }}>{t.licGrandTotal}</td>
                <td style={{ paddingTop: 8, color: '#bf5af2', fontWeight: 700, fontSize: 15 }}>{fmtMoney(grandTotal, currency)}</td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {!readOnly && (
        <button onClick={addRow} style={{
          background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8,
          cursor: 'pointer', color: '#6e6e73', fontSize: 12, padding: '6px 14px',
          transition: 'color 0.15s, border-color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
          {t.licAddRow}
        </button>
      )}
    </div>
  )
}

// ── Section 6: Opportunities & Challenges ────────────────────────────────────
function OpportunitiesSection({ project, onSave, lang = 'es' }) {
  const [opps, setOpps] = useState(project.opportunities ?? '')
  const [chals, setChals] = useState(project.challenges ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({ opportunities: opps, challenges: chals })
      .eq('id', project.id)
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    setDirty(false)
    onSave({ opportunities: opps, challenges: chals })
    toast.success('Guardado')
  }

  const t = SR[lang] ?? SR.es
  const taStyle = {
    ...INPUT,
    minHeight: 160,
    resize: 'vertical',
    fontFamily: 'inherit',
    fontSize: 14,
    lineHeight: 1.6,
  }

  return (
    <div className="mb-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={CARD}>
          <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>What are the new business opportunities?</p>
          <textarea
            style={taStyle}
            placeholder={t.oppPlaceholder}
            value={opps}
            onChange={e => { setOpps(e.target.value); setDirty(true) }}
            onFocus={fi} onBlur={fo}
          />
        </div>
        <div style={CARD}>
          <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>What are the challenges?</p>
          <textarea
            style={taStyle}
            placeholder={t.chalPlaceholder}
            value={chals}
            onChange={e => { setChals(e.target.value); setDirty(true) }}
            onFocus={fi} onBlur={fo}
          />
        </div>
      </div>
      {dirty && (
        <div className="flex justify-end mt-3">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: '#f5f5f7', color: '#000', border: 'none', cursor: 'pointer' }}>
            {saving ? t.saving : t.saveChanges}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Snapshot read-only view ───────────────────────────────────────────────────
function SnapshotView({ snapshot, lang = 'es' }) {
  const t = SR[lang] ?? SR.es
  const locale = t.locale
  const proj        = snapshot.project ?? {}
  const resources   = snapshot.resources ?? []
  const bugStats    = snapshot.bug_stats ?? []
  const snapPlan    = snapshot.plan ?? null
  const allSnapPhases = snapshot.phases ?? []
  const phases      = allSnapPhases.filter(p => !p.is_milestone)
  const teamKpis    = snapshot.team_kpis ?? []
  const effort      = snapshot.effort ?? []
  const financial   = snapshot.financial ?? null
  const invoices    = snapshot.invoices ?? []
  const allocations    = snapshot.allocations ?? []
  const snapDeliverables = snapshot.deliverables ?? []
  const snapLicenses = snapshot.licenses ?? []
  const snapComments   = proj.section_comments ?? {}
  const snapDate       = snapshot.date ?? new Date().toISOString().slice(0, 10)

  function phaseMetAt(phase) {
    const ref   = new Date(snapDate + 'T00:00:00')
    const start = new Date(phase.start_date + 'T00:00:00')
    const end   = new Date(phase.end_date   + 'T00:00:00')
    const totalDays = Math.max(1, Math.round((end - start) / 86400000))
    const elapsed   = Math.round((ref - start) / 86400000)
    const timePct   = Math.min(100, Math.max(0, elapsed / totalDays * 100))
    const progress  = phase.progress ?? 0
    const isCompleted = progress >= 100
    const isUpcoming  = ref < start
    const isOverdue   = ref > end && !isCompleted
    let color, label
    if (isCompleted)              { color = '#30d158'; label = t.phaseCompleted }
    else if (isUpcoming)          { color = '#6e6e73'; label = t.phasePending }
    else if (isOverdue)           { color = '#ff453a'; label = t.phaseOverdue }
    else if (timePct - progress > 25) { color = '#ff9f0a'; label = t.phaseAtRisk }
    else                          { color = '#64d2ff'; label = t.phaseOnTrack }
    return { timePct, progress, color, label, isUpcoming, isCompleted }
  }

  const months6    = lastNMonthsFrom(6, snapDate)
  const months4    = lastNMonthsFrom(4, snapDate)
  const snapMonth  = snapDate.slice(0, 7)

  // Bug stats
  const bugMap     = Object.fromEntries(bugStats.map(b => [b.month_year, b]))
  const snapBugs   = bugMap[snapMonth]
  const bugChartData = months6.map(m => ({ month: monthLabel(m, locale), abiertos: bugMap[m]?.open_count ?? 0, en_progreso: bugMap[m]?.in_progress_count ?? 0, cerrados: bugMap[m]?.closed_count ?? 0 }))
  const totalBugOpen       = bugStats.reduce((s, b) => s + (b.open_count        ?? 0), 0)
  const totalBugInProgress = bugStats.reduce((s, b) => s + (b.in_progress_count ?? 0), 0)
  const totalBugClosed     = bugStats.reduce((s, b) => s + (b.closed_count      ?? 0), 0)
  const bugBacklog = Math.max(0, totalBugOpen + totalBugInProgress - totalBugClosed)
  const bugDonut = [
    { name: t.open,       value: totalBugOpen,       color: '#ff453a' },
    { name: t.inProgress, value: totalBugInProgress, color: '#ff9f0a' },
    { name: t.closed,     value: totalBugClosed,     color: '#30d158' },
  ].filter(d => d.value > 0)
  const noDataLabel = lang === 'en' ? 'No data' : 'Sin datos'
  if (!bugDonut.length) bugDonut.push({ name: noDataLabel, value: 1, color: '#2a2a2a' })

  // Phases
  const phasesWithMet   = phases.map(p => ({ ...p, met: phaseMetAt(p) }))
  const overallPct      = phases.length ? Math.round(phases.reduce((s, p) => s + (p.progress ?? 0), 0) / phases.length) : 0
  const completedPhases = phasesWithMet.filter(p => p.met.isCompleted).length
  const totalHoursSnap  = phases.reduce((s, p) => s + (p.hours ?? 0), 0)

  // Team KPIs
  const kpiMap      = Object.fromEntries(teamKpis.map(k => [k.month_year, k]))
  const currentKpis = kpiMap[snapMonth] ?? { tasks_closed: 0, bugs_closed: 0, in_progress: 0 }
  const effortMap  = Object.fromEntries(effort.map(e => [e.month_year, e.hours]))
  const effortData = months4.map(m => ({ month: monthLabel(m, locale), horas: effortMap[m] ?? 0 }))

  // Profitability
  const cur      = financial?.currency ?? '€'
  const contract = financial?.contract_value ?? 0
  const target   = financial?.target_margin ?? 20
  const etdBase  = financial?.effort_to_date ?? 0
  const etd = etdBase + resources.reduce((sum, r) => {
    const h = allocations
      .filter(a => a.resource_id === r.id && a.week_start <= snapDate)
      .reduce((s, a) => s + (a.actual_hours || 0), 0)
    return sum + (h + (r.hours_to_date || 0)) * (r.hourly_rate || 0)
  }, 0)
  const snapHasPlanned = allocations.some(a => a.hours)
  const estimatedCostSnap = snapHasPlanned
    ? etdBase + resources.reduce((sum, r) => {
        const h = allocations.filter(a => a.resource_id === r.id)
          .reduce((s, a) => s + (a.hours || 0), 0) + (r.hours_to_date || 0)
        return sum + h * (r.hourly_rate || 0)
      }, 0)
    : etd
  const billed  = invoices.length ? invoices.reduce((s, i) => s + i.amount, 0) : (financial?.invoiced_to_date ?? 0)
  const profit  = billed - etd
  const margin  = billed > 0 ? (profit / billed) * 100 : 0
  const maxVal  = Math.max(contract, etd, billed, 1)
  const ph      = profitHealth(margin, target, lang)
  const snapBudgetConsumedPct  = contract > 0 ? Math.min(100, (etd / contract) * 100) : 0
  const snapEstConsumedPct     = contract > 0 ? Math.min(100, (estimatedCostSnap / contract) * 100) : 0
  const snapHeroColor = snapEstConsumedPct < 75 ? '#30d158' : snapEstConsumedPct < 95 ? '#ff9f0a' : '#ff453a'
  const snapHeroLabel = snapEstConsumedPct < 75 ? t.healthGood : snapEstConsumedPct < 95 ? t.healthWarning : t.healthRisk
  const snapEstMarginPct = contract > 0 ? ((contract - estimatedCostSnap) / contract) * 100 : 0
  const snapRemainingBudget = contract - etd

  const TYPE_LABELS   = { implementation: t.typeImpl, maintenance: t.typeMaint }
  const STATUS_LABELS = { on_track: 'On track', at_risk: 'At risk', blocked: 'Blocked' }
  const STATUS_COLORS = { on_track: '#30d158', at_risk: '#ff9f0a', blocked: '#ff453a' }
  const CSAT_STATES   = [
    { value: 'good',    color: '#30d158', shadow: 'rgba(48,209,88,0.5)' },
    { value: 'regular', color: '#ff9f0a', shadow: 'rgba(255,159,10,0.5)' },
    { value: 'bad',     color: '#ff453a', shadow: 'rgba(255,69,58,0.5)' },
  ]
  const isImpl = proj.type === 'implementation'

  const snapSectionStatuses = proj.status_report_section_statuses ?? {}
  const sections = [
    { number: '01', title: 'What is the status of my project?',   subtitle: t.sub01 },
    { number: '02', title: 'Is my system stable?',                subtitle: t.sub02 },
    { number: '03', title: 'Are we delivering value?',            subtitle: t.sub03 },
    { number: '04', title: 'Is my team working well?',            subtitle: t.sub04 },
    { number: '05', title: 'Is the project profitable?',          subtitle: t.sub05 },
    { number: '06', title: 'Opportunities & Challenges',          subtitle: t.sub06 },
  ]

  return (
    <div className="sr-print-container" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 64px' }}>
      {[
        ...sections.slice(0, 1),
        { number: 'gantt', isGantt: true },
        ...sections.slice(1),
      ].map((sec, i, arr) => (
        <div key={sec.number} className={`sr-slide${sec.isGantt ? ' sr-gantt-slide' : ''}`} style={{ marginBottom: i < arr.length - 1 ? 48 : 0 }}>
          {sec.isGantt ? (
            snapPlan && allSnapPhases.length > 0
              ? <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, backgroundColor: '#111111', overflow: 'hidden', margin: '0 -24px' }}>
                  <GanttChart plan={snapPlan} phases={allSnapPhases} isEditable={false} />
                </div>
              : null
          ) : (
          <><SectionHeader number={sec.number} title={sec.title} subtitle={sec.subtitle}
            status={snapSectionStatuses[sec.number]} />

          {snapComments[sec.number] && snapComments[sec.number].replace(/<[^>]*>/g, '').trim() && (
            <div style={{
              marginBottom: 24, borderRadius: 12, padding: '10px 14px',
              border: '1px solid rgba(100,210,255,0.12)',
              backgroundColor: 'rgba(100,210,255,0.03)',
              fontSize: 13, lineHeight: 1.65, color: '#d1d1d6',
            }}
              dangerouslySetInnerHTML={{ __html: snapComments[sec.number] }}
            />
          )}

          {sec.number === '01' && (
            <div className="flex flex-col gap-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={CARD}>
                  <p className="text-xs mb-3" style={{ color: '#6e6e73' }}>{t.projectType}</p>
                  <span className="text-sm font-semibold px-3 py-1 rounded-full"
                    style={{ backgroundColor: isImpl ? 'rgba(100,210,255,0.12)' : 'rgba(191,90,242,0.12)', color: isImpl ? '#64d2ff' : '#bf5af2' }}>
                    {TYPE_LABELS[proj.type] ?? proj.type}
                  </span>
                  {!isImpl && proj.renewal_date && <div className="mt-3"><p className="text-xs" style={{ color: '#6e6e73' }}>{t.renewalDate}</p><p className="text-sm font-medium mt-0.5" style={{ color: '#f5f5f7' }}>{fmtDate(proj.renewal_date, locale)}</p></div>}
                  {isImpl  && proj.deadline      && <div className="mt-3"><p className="text-xs" style={{ color: '#6e6e73' }}>{t.deadline}</p><p className="text-sm font-medium mt-0.5" style={{ color: '#f5f5f7' }}>{fmtDate(proj.deadline, locale)}</p></div>}
                  <div className="mt-3">
                    <p className="text-xs" style={{ color: '#6e6e73' }}>{t.status}</p>
                    <span className="text-sm font-medium mt-0.5 inline-block" style={{ color: STATUS_COLORS[proj.status] ?? '#f5f5f7' }}>
                      {STATUS_LABELS[proj.status] ?? proj.status}
                    </span>
                  </div>
                </div>
                <div style={CARD}>
                  <p className="text-xs mb-3" style={{ color: '#6e6e73' }}>{t.teamAlloc} ({resources.length} {resources.length !== 1 ? t.resources : t.resource})</p>
                  {resources.length === 0 ? <p className="text-xs" style={{ color: '#6e6e73' }}>{t.noResources}</p> : (
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-2 text-xs" style={{ color: '#6e6e73', gridTemplateColumns: '1fr auto auto' }}>
                        <span>{t.nameRole}</span><span style={{ textAlign: 'right' }}>€/h</span><span style={{ textAlign: 'right', minWidth: 64 }}>{t.dedication}</span>
                      </div>
                      {resources.map((r, ri) => (
                        <div key={ri} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr auto auto' }}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#f5f5f7' }}>{r.name}</p>
                            {r.role && <p className="text-xs truncate" style={{ color: '#6e6e73' }}>{r.role}</p>}
                          </div>
                          <span className="text-xs font-mono" style={{ color: '#6e6e73', textAlign: 'right' }}>{r.hourly_rate != null ? `${r.hourly_rate}€` : '—'}</span>
                          <span className="text-xs font-medium" style={{ color: '#f5f5f7', textAlign: 'right', minWidth: 56 }}>{r.dedication_pct != null ? `${r.dedication_pct}%` : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={CARD}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium" style={{ color: '#6e6e73' }}>Customer satisfaction</p>
                  <div className="flex items-center gap-2.5">
                    {CSAT_STATES.map(cs => (
                      <div key={cs.value} style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: cs.color,
                        boxShadow: proj.customer_satisfaction_status === cs.value ? `0 0 8px 3px ${cs.shadow}` : 'none',
                        opacity: proj.customer_satisfaction_status && proj.customer_satisfaction_status !== cs.value ? 0.25 : 1 }} />
                    ))}
                  </div>
                </div>
                {proj.customer_satisfaction_text
                  ? <div style={{ fontSize: 15, lineHeight: 1.7, color: '#f5f5f7' }} dangerouslySetInnerHTML={{ __html: proj.customer_satisfaction_text }} />
                  : <p style={{ color: '#3a3a3a', fontStyle: 'italic', fontSize: 13 }}>{lang === 'en' ? 'No text' : 'Sin texto'}</p>}
              </div>
            </div>
          )}

          {sec.number === '02' && (
            <div className="mb-2">
              {/* Verdict banner (snapshot read-only) */}
              {proj.stability_verdict && (() => {
                const sv = t.stabilityVerdicts.find(v => v.key === proj.stability_verdict)
                if (!sv) return null
                return (
                  <div style={{
                    borderRadius: 14, padding: '20px 28px', marginBottom: 16,
                    backgroundColor: `${sv.color}10`, border: `1px solid ${sv.color}30`,
                  }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: sv.color, lineHeight: 1.2, letterSpacing: '-0.01em', margin: 0 }}>
                      {sv.label}
                    </p>
                  </div>
                )
              })()}
              {/* Este mes — principal */}
              <div style={{ ...CARD, padding: '28px 32px', marginBottom: 12, background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-xs font-semibold mb-6" style={{ color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.thisMonth}</p>
                <div className="flex gap-12">
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: '#ff453a' }}>{t.open}</p>
                    <p style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: (snapBugs?.open_count ?? 0) > 0 ? '#ff453a' : '#f5f5f7', letterSpacing: '-0.04em' }}>{snapBugs?.open_count ?? 0}</p>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: '#ff9f0a' }}>{t.inProgress}</p>
                    <p style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: (snapBugs?.in_progress_count ?? 0) > 0 ? '#ff9f0a' : '#f5f5f7', letterSpacing: '-0.04em' }}>{snapBugs?.in_progress_count ?? 0}</p>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: '#30d158' }}>{t.closed}</p>
                    <p style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: '#30d158', letterSpacing: '-0.04em' }}>{snapBugs?.closed_count ?? 0}</p>
                  </div>
                </div>
              </div>
              {/* Este año — secundario */}
              <div style={{ ...CARD, padding: '14px 20px', marginBottom: 16 }}>
                <p className="text-xs font-semibold mb-3" style={{ color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.totalAccumulated}</p>
                <div className="flex gap-5">
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#ff453a' }}>{t.open}</p>
                    <p className="text-xl font-bold" style={{ color: totalBugOpen > 0 ? '#ff453a' : '#f5f5f7' }}>{totalBugOpen}</p>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#ff9f0a' }}>{t.inProgress}</p>
                    <p className="text-xl font-bold" style={{ color: totalBugInProgress > 0 ? '#ff9f0a' : '#f5f5f7' }}>{totalBugInProgress}</p>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#30d158' }}>{t.closed}</p>
                    <p className="text-xl font-bold" style={{ color: '#30d158' }}>{totalBugClosed}</p>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#6e6e73' }}>{t.backlog}</p>
                    <p className="text-xl font-bold" style={{ color: bugBacklog > 0 ? '#ff453a' : '#30d158' }}>{bugBacklog}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
                <div style={CARD}>
                  <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>{t.bugEvolution}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={bugChartData} barSize={8} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="abiertos"    fill="#ff453a" radius={[3,3,0,0]} name={t.open} />
                      <Bar dataKey="en_progreso" fill="#ff9f0a" radius={[3,3,0,0]} name={t.inProgress} />
                      <Bar dataKey="cerrados"    fill="#30d158" radius={[3,3,0,0]} name={t.closed} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={CARD} className="flex flex-col items-center justify-center">
                  <p className="text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>{t.totalAccumulated}</p>
                  <PieChart width={140} height={140}>
                    <Pie data={bugDonut} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" paddingAngle={2}>
                      {bugDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                  <div className="flex flex-col gap-1 mt-1">
                    {bugDonut.filter(d => d.name !== noDataLabel).map(d => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs" style={{ color: '#6e6e73' }}>{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {sec.number === '03' && (
            <div className="mb-2">
              {phases.length === 0
                ? <div style={CARD}><p className="text-sm" style={{ color: '#6e6e73' }}>{t.noPlan}</p></div>
                : <>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <KpiCard label={t.globalProgress} value={`${overallPct}%`} color={overallPct >= 75 ? '#30d158' : overallPct >= 40 ? '#64d2ff' : '#ff9f0a'} />
                      <KpiCard label={t.phasesCompleted} value={`${completedPhases}/${phases.length}`} color="#f5f5f7" />
                      <KpiCard label={t.plannedHours} value={totalHoursSnap > 0 ? `${totalHoursSnap}h` : '—'} color="#64d2ff" />
                    </div>
                    <div style={{ ...CARD, marginBottom: 16 }}>
                      <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>{t.allPhases}</p>
                      <div className="flex flex-col gap-4">
                        {phasesWithMet.map(phase => {
                          const m = phase.met
                          return (
                            <div key={phase.id} style={{ opacity: m.isUpcoming ? 0.5 : 1 }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                                  <span className="text-sm font-medium truncate" style={{ color: '#f5f5f7' }}>{phase.name}</span>
                                </div>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-3"
                                  style={{ backgroundColor: `${m.color}15`, color: m.color }}>{m.label}</span>
                              </div>
                              <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${m.timePct}%`, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                                <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${m.progress}%`, backgroundColor: phase.color }} />
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-xs" style={{ color: '#3a3a3a' }}>
                                  {new Date(phase.start_date + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                                  {' → '}
                                  {new Date(phase.end_date + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="text-xs font-semibold" style={{ color: phase.color }}>{m.progress}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {snapDeliverables.length > 0 && (
                      <div style={CARD}>
                        <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>{t.otherDeliverables}</p>
                        <div className="flex flex-col gap-2">
                          {snapDeliverables.map(d => {
                            const meta = d.status === 'done'
                              ? { color: '#30d158', label: t.statusDone }
                              : d.status === 'in_progress'
                              ? { color: '#64d2ff', label: t.statusInProgress }
                              : { color: '#3a3a3a', label: t.statusPending }
                            return (
                              <div key={d.id} className="flex items-center justify-between gap-3">
                                <span className="text-sm" style={{ color: '#f5f5f7' }}>{d.name}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${meta.color}30`, backgroundColor: `${meta.color}14`, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
              }
            </div>
          )}

          {sec.number === '04' && (
            <div className="mb-2">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <KpiCard label={t.tasksClosedMonth} value={currentKpis.tasks_closed ?? 0} color="#30d158" />
                <KpiCard label={t.bugsClosedMonth}  value={currentKpis.bugs_closed  ?? 0} color="#ff9f0a" />
                <KpiCard label={t.inProgress}        value={currentKpis.in_progress  ?? 0} color="#64d2ff" />
              </div>
              {(() => {
                const sc = currentKpis.points_committed ?? 0
                const sd = currentKpis.points_completed ?? 0
                const sr = sc > 0 ? Math.round(sd / sc * 100) : 0
                const srColor = sr >= 80 ? '#30d158' : sr >= 50 ? '#ff9f0a' : '#ff453a'
                return (
                  <div style={{ ...CARD, marginBottom: 16 }}>
                    <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>{t.spRate}</p>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <KpiCard label={t.spCommitted} value={sc} color="#bf5af2" />
                      <KpiCard label={t.spCompleted} value={sd} color="#5e5ce6" />
                      <KpiCard label={t.spRate} value={sc > 0 ? `${sr}%` : '—'} color={srColor} />
                    </div>
                    <div style={{ height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(sr, 100)}%`, borderRadius: 4, backgroundColor: srColor, opacity: 0.8 }} />
                    </div>
                  </div>
                )
              })()}
              <div style={CARD} className="mb-4">
                <p className="text-xs font-medium mb-1" style={{ color: '#6e6e73' }}>{t.workDistribution}</p>
                <div className="flex items-center gap-4 mb-4">
                  {[{ color: '#30d158', label: t.tasksClosed }, { color: '#ff9f0a', label: t.bugsClosed }, { color: '#64d2ff', label: t.inProgress }].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="text-xs" style={{ color: '#6e6e73' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={months4.map(m => ({ month: monthLabel(m, locale), tareas: kpiMap[m]?.tasks_closed ?? 0, bugs: kpiMap[m]?.bugs_closed ?? 0, progreso: kpiMap[m]?.in_progress ?? 0 }))} barSize={10} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="tareas"   fill="#30d158" radius={[3,3,0,0]} name={t.tasksClosed} />
                    <Bar dataKey="bugs"     fill="#ff9f0a" radius={[3,3,0,0]} name={t.bugsClosed} />
                    <Bar dataKey="progreso" fill="#64d2ff" radius={[3,3,0,0]} name={t.inProgress} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={CARD}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium" style={{ color: '#6e6e73' }}>{t.effortEvolution}</p>
                  {proj.effort_target_hours != null && (
                    <span className="text-xs" style={{ color: '#ff9f0a' }}>— {t.effortTarget}: {proj.effort_target_hours}h</span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={effortData} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="horas" fill="#64d2ff" radius={[4,4,0,0]} name={t.hoursBar} />
                    {proj.effort_target_hours != null
                      ? <ReferenceLine y={Number(proj.effort_target_hours)} stroke="#ff9f0a" strokeWidth={2}
                          label={{ value: `${proj.effort_target_hours}h`, position: 'insideTopRight', fill: '#ff9f0a', fontSize: 11, fontWeight: 600, dy: -6 }} />
                      : null}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {sec.number === '05' && (
            <div className="mb-2">
              {!financial && resources.length === 0
                ? <div style={CARD}><p className="text-sm" style={{ color: '#6e6e73' }}>{t.noFinancialData}</p></div>
                : <>
                    {/* Hero health card (snapshot) */}
                    <div style={{ ...CARD, marginBottom: 16 }}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: snapHeroColor,
                            boxShadow: `0 0 7px ${snapHeroColor}` }} />
                          <span className="text-xs font-semibold tracking-wide" style={{ color: snapHeroColor }}>
                            {snapHeroLabel}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: '#6e6e73' }}>{t.budgetHealth}</span>
                      </div>
                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: snapHeroColor }}>
                            {snapBudgetConsumedPct.toFixed(0)}<span style={{ fontSize: 28, fontWeight: 600 }}>%</span>
                          </div>
                          <div className="text-xs mt-1" style={{ color: '#6e6e73' }}>{t.budgetConsumed}</div>
                        </div>
                        {snapHasPlanned && (
                          <div className="text-right pb-1">
                            <div className="text-xs mb-0.5" style={{ color: '#6e6e73' }}>{t.estimatedCostLabel}</div>
                            <div className="text-sm font-semibold" style={{ color: snapEstConsumedPct > 100 ? '#ff453a' : '#f5f5f7' }}>
                              {fmtMoney(estimatedCostSnap, cur)}
                            </div>
                            <div className="text-xs" style={{ color: snapEstConsumedPct > 95 ? '#ff453a' : '#6e6e73' }}>
                              {snapEstConsumedPct.toFixed(0)}% {lang === 'en' ? 'of contract' : 'del contrato'}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mb-1">
                        {snapHasPlanned && (
                          <div style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)',
                            marginBottom: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${snapEstConsumedPct}%`, borderRadius: 3,
                              backgroundColor: `${snapHeroColor}45` }} />
                          </div>
                        )}
                        <div style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${snapBudgetConsumedPct}%`, borderRadius: 5, backgroundColor: snapHeroColor }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mb-5" style={{ color: '#6e6e73' }}>
                        <span>{cur}0</span><span>{fmtMoney(contract, cur)}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {[
                          { label: t.budget,               value: fmtMoney(contract, cur),  color: '#f5f5f7' },
                          { label: t.etdCost,              value: fmtMoney(etd, cur),        color: '#64d2ff' },
                          { label: t.remainingBudget,      value: fmtMoney(snapRemainingBudget, cur),
                            color: snapRemainingBudget >= 0 ? '#f5f5f7' : '#ff453a' },
                          { label: t.estimatedMarginLabel,
                            value: contract > 0 ? `${snapEstMarginPct.toFixed(1)}%` : '—',
                            color: snapEstMarginPct >= target ? '#30d158' : snapEstMarginPct >= 0 ? '#ff9f0a' : '#ff453a' },
                        ].map(m => (
                          <div key={m.label}>
                            <p className="text-xs mb-1" style={{ color: '#6e6e73' }}>{m.label}</p>
                            <p className="text-base font-semibold" style={{ color: m.color }}>{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <KpiCard label={t.billed}        value={fmtMoney(billed, cur)}   color="#30d158" />
                      <KpiCard label={t.currentMargin} value={billed > 0 ? `${margin.toFixed(1)}%` : '—'} color={ph.color} />
                    </div>

                    {/* Resource breakdown (snapshot) */}
                    {resources.length > 0 && (() => {
                      const allocActMap = {}, allocPlanMap = {}
                      allocations.forEach(a => {
                        if (a.actual_hours) allocActMap[`${a.resource_id}_${a.week_start}`] = a.actual_hours
                        if (a.hours)        allocPlanMap[`${a.resource_id}_${a.week_start}`] = a.hours
                      })
                      const rows = resources.map(r => {
                        const actualHours  = Object.keys(allocActMap).filter(k => k.startsWith(r.id + '_')).reduce((s, k) => s + (allocActMap[k] || 0), 0) + (r.hours_to_date || 0)
                        const plannedHours = Object.keys(allocPlanMap).filter(k => k.startsWith(r.id + '_')).reduce((s, k) => s + (allocPlanMap[k] || 0), 0) + (r.hours_to_date || 0)
                        const remHours = plannedHours - actualHours
                        return { ...r, totalHours: actualHours, cost: actualHours * (r.hourly_rate || 0),
                          plannedHours, remHours, remCost: remHours * (r.hourly_rate || 0) }
                      }).filter(r => r.totalHours > 0 || r.plannedHours > 0 || r.hourly_rate > 0)
                      if (!rows.length) return null
                      const totalCost    = rows.reduce((s, r) => s + r.cost, 0)
                      const totalHours   = rows.reduce((s, r) => s + r.totalHours, 0)
                      const totalRemH    = rows.reduce((s, r) => s + r.remHours, 0)
                      const totalRemCost = rows.reduce((s, r) => s + r.remCost, 0)
                      const remColor = n => n < 0 ? '#ff453a' : n > 0 ? '#ff9f0a' : '#6e6e73'
                      const headers = snapHasPlanned
                        ? [t.resName, t.resRole, t.resHours, t.resRate, t.resCost, t.resRemH, t.resRemCost]
                        : [t.resName, t.resRole, t.resHours, t.resRate, t.resCost]
                      return (
                        <div style={{ ...CARD, marginTop: 12, overflowX: 'auto' }}>
                          <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>{t.resourceBreakdown}</p>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              {headers.map(h => (
                                <th key={h} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 16, color: '#6e6e73', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {rows.map(r => (
                                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '8px 16px 8px 0', color: '#f5f5f7', fontWeight: 500 }}>{r.name}</td>
                                  <td style={{ padding: '8px 16px 8px 0', color: '#6e6e73' }}>{r.role || '—'}</td>
                                  <td style={{ padding: '8px 16px 8px 0', color: '#f5f5f7' }}>{r.totalHours.toFixed(1)}h</td>
                                  <td style={{ padding: '8px 16px 8px 0', color: '#6e6e73' }}>{r.hourly_rate ? `${cur}${r.hourly_rate}/h` : '—'}</td>
                                  <td style={{ padding: '8px 16px 8px 0', color: '#64d2ff', fontWeight: 500 }}>{fmtMoney(r.cost, cur)}</td>
                                  {snapHasPlanned && <>
                                    <td style={{ padding: '8px 16px 8px 0', color: remColor(r.remHours), fontWeight: 500 }}>
                                      {r.remHours >= 0 ? '' : '−'}{Math.abs(r.remHours).toFixed(1)}h
                                    </td>
                                    <td style={{ padding: '8px 0 8px 0', color: remColor(r.remCost), fontWeight: 500 }}>
                                      {r.remCost < 0 ? '−' : ''}{fmtMoney(Math.abs(r.remCost), cur)}
                                    </td>
                                  </>}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot><tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                              <td colSpan={2} style={{ paddingTop: 8, color: '#6e6e73', fontWeight: 600 }}>{t.resTotal}</td>
                              <td style={{ paddingTop: 8, color: '#f5f5f7', fontWeight: 600 }}>{totalHours.toFixed(1)}h</td>
                              <td />
                              <td style={{ paddingTop: 8, color: '#64d2ff', fontWeight: 600 }}>{fmtMoney(totalCost, cur)}</td>
                              {snapHasPlanned && <>
                                <td style={{ paddingTop: 8, fontWeight: 600, color: remColor(totalRemH) }}>
                                  {totalRemH >= 0 ? '' : '−'}{Math.abs(totalRemH).toFixed(1)}h
                                </td>
                                <td style={{ paddingTop: 8, fontWeight: 600, color: remColor(totalRemCost) }}>
                                  {totalRemCost < 0 ? '−' : ''}{fmtMoney(Math.abs(totalRemCost), cur)}
                                </td>
                              </>}
                            </tr></tfoot>
                          </table>
                        </div>
                      )
                    })()}

                    {/* Monthly evolution (snapshot) */}
                    {(() => {
                      const allocMap = {}
                      allocations.forEach(a => { if (a.actual_hours) allocMap[`${a.resource_id}_${a.week_start}`] = a.actual_hours })
                      const monthMap = {}
                      resources.forEach(r => {
                        Object.keys(allocMap).filter(k => k.startsWith(r.id + '_')).forEach(k => {
                          const month = k.slice(r.id.length + 1, r.id.length + 8)
                          monthMap[month] = (monthMap[month] || 0) + (allocMap[k] || 0) * (r.hourly_rate || 0)
                        })
                      })
                      const invByMonth = {}
                      invoices.forEach(inv => {
                        if (!inv.invoice_date) return
                        const month = inv.invoice_date.slice(0, 7)
                        invByMonth[month] = (invByMonth[month] || 0) + inv.amount
                      })
                      const allMonths = [...new Set([...Object.keys(monthMap), ...Object.keys(invByMonth)])].sort()
                      if (!allMonths.length) return null
                      const chartData = allMonths.map(m => ({
                        month: m,
                        [t.evoCost]: Math.round(monthMap[m] || 0),
                        [t.evoBilled]: Math.round(invByMonth[m] || 0),
                      }))
                      return (
                        <div style={{ ...CARD, marginTop: 12 }}>
                          <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>{t.costEvolution}</p>
                          <div className="flex items-center gap-4 mb-3">
                            {[{ color: '#64d2ff', label: t.evoCost }, { color: '#30d158', label: t.evoBilled }].map(l => (
                              <div key={l.label} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                                <span className="text-xs" style={{ color: '#6e6e73' }}>{l.label}</span>
                              </div>
                            ))}
                          </div>
                          <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={chartData} barSize={14} barGap={3}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                              <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoney(v, cur)} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={v => fmtMoney(v, cur)} />
                              <Bar dataKey={t.evoCost}   fill="#64d2ff" radius={[3,3,0,0]} />
                              <Bar dataKey={t.evoBilled} fill="#30d158" radius={[3,3,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )
                    })()}

                    {/* Invoice list (snapshot) */}
                    {invoices.length > 0 && (
                      <div style={{ ...CARD, marginTop: 12, overflowX: 'auto' }}>
                        <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>{t.invoiceList}</p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {[t.invDate, t.invDesc, t.invAmount].map(h => (
                              <th key={h} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 16, color: '#6e6e73', fontWeight: 500 }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {invoices.map((inv, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '8px 16px 8px 0', color: '#6e6e73', whiteSpace: 'nowrap' }}>{inv.invoice_date ? fmtDate(inv.invoice_date, locale) : '—'}</td>
                                <td style={{ padding: '8px 16px 8px 0', color: '#d1d1d6' }}>{inv.description || t.invNoDesc}</td>
                                <td style={{ padding: '8px 0 8px 0', color: '#30d158', fontWeight: 500 }}>{fmtMoney(inv.amount, cur)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td colSpan={2} style={{ paddingTop: 8, color: '#6e6e73', fontWeight: 600 }}>{t.resTotal}</td>
                            <td style={{ paddingTop: 8, color: '#30d158', fontWeight: 600 }}>{fmtMoney(invoices.reduce((s, i) => s + i.amount, 0), cur)}</td>
                          </tr></tfoot>
                        </table>
                      </div>
                    )}

                    {/* Licenses (snapshot) */}
                    {snapLicenses.length > 0 && (
                      <LicensesCard projectId={null} lang={lang} readOnly initialRows={snapLicenses} />
                    )}
                  </>
              }
            </div>
          )}

          {sec.number === '06' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div style={CARD}>
                <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>What are the new business opportunities?</p>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: proj.opportunities ? '#d1d1d6' : '#3a3a3a', fontStyle: proj.opportunities ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
                  {proj.opportunities || (lang === 'en' ? 'No content' : 'Sin contenido')}
                </p>
              </div>
              <div style={CARD}>
                <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>What are the challenges?</p>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: proj.challenges ? '#d1d1d6' : '#3a3a3a', fontStyle: proj.challenges ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
                  {proj.challenges || (lang === 'en' ? 'No content' : 'Sin contenido')}
                </p>
              </div>
            </div>
          )}

          </>
          )}
          {i < arr.length - 1 && <div className="sr-no-print" style={{ marginTop: 48, borderTop: '1px solid rgba(255,255,255,0.05)' }} />}
        </div>
      ))}
    </div>
  )
}

// ── Placeholder style injection (once) ───────────────────────────────────────
const CSAT_STYLE_ID = 'csat-editor-style'
if (typeof document !== 'undefined' && !document.getElementById(CSAT_STYLE_ID)) {
  const s = document.createElement('style')
  s.id = CSAT_STYLE_ID
  s.textContent = `
    .csat-editor:empty:before {
      content: attr(data-placeholder);
      color: #3a3a3a;
      pointer-events: none;
    }
    .csat-editor b, .csat-editor strong { color: #ffffff; }
    .section-comment-editor:empty:before {
      content: attr(data-placeholder);
      color: #3a3a3a;
      pointer-events: none;
    }
    .section-comment-editor ul { list-style: disc; padding-left: 1.25em; }
    .section-comment-editor li { margin-bottom: 2px; }
  `
  document.head.appendChild(s)
}

function buildPresentationHtml(slides) {
  // Inline all CSS rules — eliminates async stylesheet loading race
  let allCSS = ''
  Array.from(document.styleSheets).forEach(sheet => {
    try { Array.from(sheet.cssRules).forEach(r => { allCSS += r.cssText + '\n' }) } catch (_) {}
  })

  const slidesHTML = slides.map(el =>
    `<div class="pres-slide"><div class="pres-inner">${el.innerHTML}</div></div>`
  ).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${allCSS}
@page { size: A4 landscape; margin: 0; }
*, *::before, *::after {
  print-color-adjust: exact !important;
  -webkit-print-color-adjust: exact !important;
  box-sizing: border-box;
}
html, body { margin: 0; padding: 0; background: #111111;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif; }
.sr-no-print { display: none !important; }
/* pres-slide: fixed page dimensions, clips anything that overflows */
.pres-slide {
  position: relative !important;
  width: 297mm !important;
  height: 210mm !important;
  background-color: #111111 !important;
  overflow: hidden !important;
  page-break-after: always !important;
  break-after: page !important;
}
.pres-slide:last-child { page-break-after: auto !important; break-after: auto !important; }
/* pres-inner: absolute so its offsetHeight = true content height,
   unaffected by the parent's 210mm constraint.
   transform: scale() is applied in JS before printing. */
.pres-inner {
  position: absolute !important;
  top: 0 !important; left: 0 !important; right: 0 !important;
  padding: 36px 56px !important;
  box-sizing: border-box !important;
  transform-origin: top center !important;
}
</style>
</head>
<body>${slidesHTML}</body>
</html>`
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function StatusReport({ project: initialProject, members, tasks }) {
  const { lang } = useLang()
  const sr = SR[lang] ?? SR.es
  const [project, setProject] = useState(initialProject)
  useEffect(() => { setProject(initialProject) }, [initialProject])

  // ── Presentation export ───────────────────────────────────────
  function exportPresentation() {
    const slides = Array.from(document.querySelectorAll('.sr-slide:not(.sr-gantt-slide)'))
    if (!slides.length) { toast.error('Sin secciones para exportar'); return }

    const html = buildPresentationHtml(slides)

    const existing = document.getElementById('sr-print-frame')
    if (existing) existing.remove()

    const frame = document.createElement('iframe')
    frame.id = 'sr-print-frame'
    // Full-size but invisible — needed for accurate scrollHeight measurements
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;visibility:hidden;pointer-events:none;z-index:-1;'
    document.body.appendChild(frame)

    frame.contentDocument.write(html)
    frame.contentDocument.close()

    const cleanup = () => { if (document.body.contains(frame)) document.body.removeChild(frame) }

    setTimeout(() => {
      const fDoc = frame.contentDocument

      fDoc.querySelectorAll('.pres-slide').forEach(slide => {
        const inner = slide.querySelector('.pres-inner')
        if (!inner) return
        // offsetHeight on absolute-positioned element = true content height,
        // independent of parent's 210mm. No reflow when we apply transform.
        const slideH = slide.offsetHeight
        const innerH = inner.offsetHeight
        if (innerH > slideH && innerH > 0) {
          inner.style.transform = `scale(${(slideH / innerH).toFixed(4)})`
        }
      })

      frame.contentWindow.focus()
      frame.contentWindow.print()
      frame.contentWindow.addEventListener('afterprint', cleanup, { once: true })
      setTimeout(cleanup, 60000)
    }, 700)
  }

  // ── Version management ────────────────────────────────────────
  const [versions,         setVersions]         = useState([])
  const [selectedVersion,  setSelectedVersion]  = useState(null)
  const [showVersionList,  setShowVersionList]  = useState(false)
  const [showSaveForm,     setShowSaveForm]     = useState(false)
  const [newVersionName,   setNewVersionName]   = useState('')
  const [savingVersion,    setSavingVersion]    = useState(false)
  const versionListRef = useRef(null)

  useEffect(() => {
    supabase.from('status_report_versions')
      .select('id, name, created_at')
      .eq('project_id', initialProject.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setVersions(data ?? []))
  }, [initialProject.id])

  useEffect(() => {
    if (!showVersionList) return
    function handler(e) { if (versionListRef.current && !versionListRef.current.contains(e.target)) setShowVersionList(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showVersionList])

  async function saveVersion() {
    if (!newVersionName.trim()) { toast.error('Escribe un nombre'); return }
    setSavingVersion(true)
    try {
      const [
        { data: resources },
        { data: bugStats },
        { data: plans },
        { data: teamKpis },
        { data: effort },
        { data: financial },
        { data: invoices },
        { data: deliverables },
      ] = await Promise.all([
        supabase.from('project_resources').select('*').eq('project_id', project.id),
        supabase.from('project_bug_stats').select('*').eq('project_id', project.id),
        supabase.from('project_plans').select('id').eq('project_id', project.id).limit(1),
        supabase.from('project_team_kpis').select('*').eq('project_id', project.id),
        supabase.from('project_effort').select('*').eq('project_id', project.id),
        supabase.from('project_financials').select('*').eq('project_id', project.id).maybeSingle(),
        supabase.from('project_invoices').select('amount,invoice_date,description').eq('project_id', project.id).order('invoice_date'),
        supabase.from('project_deliverables').select('id, name, status').eq('project_id', project.id).order('created_at'),
      ])
      let snapPlan = null
      let phases = []
      if (plans?.length) {
        snapPlan = plans[0]
        const { data: ph } = await supabase.from('plan_phases')
          .select('*, plan_tasks(*)')
          .eq('plan_id', plans[0].id).order('order_index')
        phases = (ph ?? []).map(phase => ({
          ...phase,
          plan_tasks: (phase.plan_tasks || []).sort((a, b) => a.order_index - b.order_index),
        }))
      }
      const resourceIds = (resources ?? []).map(r => r.id)
      let allocations = []
      if (resourceIds.length) {
        const { data: allocs } = await supabase.from('resource_allocations')
          .select('resource_id, week_start, hours, actual_hours').in('resource_id', resourceIds)
        allocations = allocs ?? []
      }
      const snapshot = {
        date: new Date().toISOString().slice(0, 10),
        project: {
          type: project.type, status: project.status,
          deadline: project.deadline, renewal_date: project.renewal_date,
          customer_satisfaction_status: project.customer_satisfaction_status,
          customer_satisfaction_text: project.customer_satisfaction_text,
          opportunities: project.opportunities, challenges: project.challenges,
          stability_verdict: project.stability_verdict ?? null,
          effort_target_hours: project.effort_target_hours ?? null,
          status_report_section_statuses: project.status_report_section_statuses ?? {},
          section_comments: project.section_comments ?? {},
        },
        resources: resources ?? [], bug_stats: bugStats ?? [], plan: snapPlan, phases,
        team_kpis: teamKpis ?? [], effort: effort ?? [],
        financial: financial ?? null, invoices: invoices ?? [], allocations,
        deliverables: deliverables ?? [],
        licenses: (await supabase.from('project_licenses').select('*').eq('project_id', project.id).order('created_at')).data ?? [],
      }
      const { data: saved, error } = await supabase.from('status_report_versions')
        .insert({ project_id: project.id, name: newVersionName.trim(), snapshot })
        .select('id, name, created_at').single()
      if (error) { toast.error('Error al guardar'); return }
      setVersions(prev => [saved, ...prev])
      setNewVersionName('')
      setShowSaveForm(false)
      toast.success(`Versión "${saved.name}" guardada`)
    } finally {
      setSavingVersion(false)
    }
  }

  async function loadVersion(versionId) {
    const { data, error } = await supabase.from('status_report_versions')
      .select('id, name, created_at, snapshot').eq('id', versionId).single()
    if (error || !data) { toast.error('Error al cargar'); return }
    setSelectedVersion(data)
    setShowVersionList(false)
  }

  function handleProjectUpdate(updates) {
    setProject(p => ({ ...p, ...updates }))
  }

  // ── Section status dots ───────────────────────────────────────
  const sectionStatuses = project.status_report_section_statuses ?? {}
  async function updateSectionStatus(number, value) {
    const updated = { ...sectionStatuses }
    if (value === null) delete updated[number]
    else updated[number] = value
    handleProjectUpdate({ status_report_section_statuses: updated })
    await supabase.from('projects').update({ status_report_section_statuses: updated }).eq('id', project.id)
  }

  // ── Section comments ──────────────────────────────────────────
  const sectionComments = project.section_comments ?? {}
  const [commentsExpanded, setCommentsExpanded] = useState({})
  function toggleComment(number) {
    setCommentsExpanded(prev => ({ ...prev, [number]: !prev[number] }))
  }

  // ── Auto-detect section statuses ──────────────────────────────
  const [analyzing, setAnalyzing] = useState(false)

  async function analyzeStatuses() {
    setAnalyzing(true)
    try {
      const suggestions = {}
      const months3 = lastNMonths(3)
      const months2 = lastNMonths(2)

      const [
        { data: bugData },
        { data: plans },
        { data: kpiData },
        { data: fin },
        { data: invoices },
      ] = await Promise.all([
        supabase.from('project_bug_stats').select('*').eq('project_id', project.id).in('month_year', months3),
        supabase.from('project_plans').select('id').eq('project_id', project.id).limit(1),
        supabase.from('project_team_kpis').select('*').eq('project_id', project.id).in('month_year', months2),
        supabase.from('project_financials').select('*').eq('project_id', project.id).maybeSingle(),
        supabase.from('project_invoices').select('amount,invoice_date,description').eq('project_id', project.id).order('invoice_date'),
      ])

      // 01 — project status field
      if (project.status === 'blocked') suggestions['01'] = 'bad'
      else if (project.status === 'at_risk') suggestions['01'] = 'regular'
      else if (project.status === 'on_track') suggestions['01'] = 'good'

      // 02 — bug backlog trend over last 3 months
      if (bugData?.length) {
        const backlog = months3.map(m => {
          const b = bugData.find(x => x.month_year === m) ?? {}
          return Math.max(0, (b.open_count ?? 0) + (b.in_progress_count ?? 0) - (b.closed_count ?? 0))
        })
        const growing = backlog[2] > backlog[1] && backlog[1] > backlog[0]
        const shrinking = backlog[2] < backlog[1] || backlog[2] === 0
        suggestions['02'] = growing ? 'bad' : shrinking ? 'good' : 'regular'
      }

      // 03 — plan phases: overdue count + overall progress vs time
      if (plans?.length) {
        const { data: phases } = await supabase
          .from('plan_phases')
          .select('start_date, end_date, progress, is_milestone')
          .eq('plan_id', plans[0].id)
        const real = (phases ?? []).filter(p => !p.is_milestone && p.start_date && p.end_date)
        if (real.length) {
          const now = new Date()
          const overdue = real.filter(p => new Date(p.end_date) < now && (p.progress ?? 0) < 100).length
          const avgProgress = real.reduce((s, p) => s + (p.progress ?? 0), 0) / real.length
          if (overdue > 0) suggestions['03'] = overdue >= real.length / 2 ? 'bad' : 'regular'
          else suggestions['03'] = avgProgress >= 70 ? 'good' : 'regular'
        }
      }

      // 04 — team KPIs: tasks + bugs closed trend (last 2 months)
      if (kpiData?.length === 2) {
        const [prev, curr] = months2.map(m => kpiData.find(k => k.month_year === m) ?? {})
        const tasksDelta = (curr.tasks_closed ?? 0) - (prev.tasks_closed ?? 0)
        const bugsDelta  = (curr.bugs_closed  ?? 0) - (prev.bugs_closed  ?? 0)
        const score = tasksDelta + bugsDelta
        suggestions['04'] = score > 0 ? 'good' : score < -2 ? 'bad' : 'regular'
      }

      // 05 — profitability: actual margin vs target
      if (fin) {
        const target  = fin.target_margin ?? 20
        const etd     = fin.effort_to_date ?? 0
        const billed  = invoices?.length
          ? invoices.reduce((s, i) => s + i.amount, 0)
          : (fin.invoiced_to_date ?? 0)
        const margin  = billed > 0 ? ((billed - etd) / billed) * 100 : null
        if (margin !== null) {
          suggestions['05'] = margin < 0 ? 'bad' : margin < target * 0.85 ? 'regular' : 'good'
        }
      }

      // 06 — has active blockers in challenges text
      const hasChallenge = project.challenges && project.challenges.replace(/<[^>]*>/g, '').trim()
      const hasOpps      = project.opportunities && project.opportunities.replace(/<[^>]*>/g, '').trim()
      if (hasChallenge) suggestions['06'] = 'regular'
      else if (hasOpps) suggestions['06'] = 'good'

      const count = Object.keys(suggestions).length
      if (!count) { toast(lang === 'en' ? 'No data to analyze' : 'Sin datos suficientes para analizar'); return }

      const updated = { ...sectionStatuses, ...suggestions }
      handleProjectUpdate({ status_report_section_statuses: updated })
      await supabase.from('projects').update({ status_report_section_statuses: updated }).eq('id', project.id)
      toast.success(sr.autoDetectDone(count))
    } finally {
      setAnalyzing(false)
    }
  }

  const sections = [
    {
      number: '01',
      title: 'What is the status of my project?',
      subtitle: sr.sub01,
      content: <ProjectStatusSection project={project} onSave={handleProjectUpdate} lang={lang} />,
    },
    {
      number: '02',
      title: 'Is my system stable?',
      subtitle: sr.sub02,
      content: <SystemStabilitySection projectId={project.id} project={project} onSave={handleProjectUpdate} lang={lang} />,
    },
    {
      number: '03',
      title: 'Are we delivering value?',
      subtitle: sr.sub03,
      content: <DeliveringValueSection projectId={project.id} project={project} onSave={handleProjectUpdate} lang={lang} />,
    },
    {
      number: '04',
      title: 'Is my team working well?',
      subtitle: sr.sub04,
      content: <TeamPerformanceSection projectId={project.id} lang={lang} />,
    },
    {
      number: '05',
      title: 'Is the project profitable?',
      subtitle: sr.sub05,
      content: <ProfitabilitySection projectId={project.id} lang={lang} />,
    },
    {
      number: '06',
      title: 'Opportunities & Challenges',
      subtitle: sr.sub06,
      content: <OpportunitiesSection project={project} onSave={handleProjectUpdate} lang={lang} />,
    },
  ]

  const autoName = new Date().toLocaleDateString(sr.locale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="sr-print-container" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px' }}>

      {/* ── Version bar ── */}
      <div className="sr-no-print flex items-center justify-between mb-8 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Selector */}
        <div ref={versionListRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowVersionList(v => !v)}
            className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-xl"
            style={{
              backgroundColor: selectedVersion ? 'rgba(191,90,242,0.1)' : 'rgba(255,255,255,0.06)',
              color: selectedVersion ? '#bf5af2' : '#f5f5f7',
              border: `1px solid ${selectedVersion ? 'rgba(191,90,242,0.2)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer',
            }}
          >
            <Clock className="w-3.5 h-3.5" />
            {selectedVersion ? selectedVersion.name : sr.currentVersion}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showVersionList && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
              backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 240, overflow: 'hidden',
            }}>
              <button
                onClick={() => { setSelectedVersion(null); setShowVersionList(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                style={{ background: !selectedVersion ? 'rgba(255,255,255,0.06)' : 'none', border: 'none', cursor: 'pointer', color: '#f5f5f7', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = !selectedVersion ? 'rgba(255,255,255,0.06)' : 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#30d158', flexShrink: 0 }} />
                {sr.currentVersionLive}
              </button>
              {versions.map(v => (
                <button key={v.id}
                  onClick={() => loadVersion(v.id)}
                  className="w-full flex flex-col px-4 py-2.5 text-left"
                  style={{ background: selectedVersion?.id === v.id ? 'rgba(255,255,255,0.06)' : 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = selectedVersion?.id === v.id ? 'rgba(255,255,255,0.06)' : 'transparent'}
                >
                  <span className="text-sm font-medium" style={{ color: '#f5f5f7' }}>{v.name}</span>
                  <span className="text-xs" style={{ color: '#6e6e73' }}>
                    {new Date(v.created_at).toLocaleDateString(sr.locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </button>
              ))}
              {versions.length === 0 && <p className="px-4 py-3 text-xs" style={{ color: '#3a3a3a' }}>{sr.noVersionsSaved}</p>}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {!selectedVersion && (
            <button
              onClick={analyzeStatuses}
              disabled={analyzing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
              style={{ backgroundColor: analyzing ? 'rgba(255,159,10,0.1)' : 'rgba(255,255,255,0.06)', color: analyzing ? '#ff9f0a' : '#6e6e73', border: `1px solid ${analyzing ? 'rgba(255,159,10,0.2)' : 'rgba(255,255,255,0.08)'}`, cursor: analyzing ? 'default' : 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!analyzing) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f5f5f7' } }}
              onMouseLeave={e => { if (!analyzing) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#6e6e73' } }}
            >
              <Zap className="w-3 h-3" />
              {analyzing ? sr.autoDetecting : sr.autoDetect}
            </button>
          )}
          <button
            onClick={exportPresentation}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f5f5f7' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#6e6e73' }}
          >
            <GalleryHorizontal className="w-3 h-3" />
            {sr.exportPresentation}
          </button>

          {!selectedVersion && (showSaveForm ? (
            <>
              <input
                autoFocus
                value={newVersionName}
                onChange={e => setNewVersionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveVersion(); if (e.key === 'Escape') setShowSaveForm(false) }}
                placeholder={autoName}
                style={{ ...INPUT, width: 210, padding: '5px 10px', fontSize: 12 }}
              />
              <button onClick={saveVersion} disabled={savingVersion}
                className="text-xs px-3 py-1.5 rounded-xl font-semibold"
                style={{ backgroundColor: '#f5f5f7', color: '#000', border: 'none', cursor: 'pointer' }}>
                {savingVersion ? sr.saving : sr.save}
              </button>
              <button onClick={() => setShowSaveForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', fontSize: 16, lineHeight: 1 }}>×</button>
            </>
          ) : (
            <button
              onClick={() => { setNewVersionName(autoName); setShowSaveForm(true) }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f5f5f7' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#6e6e73' }}
            >
              <Save className="w-3 h-3" />
              {sr.saveVersion}
            </button>
          ))}

          {selectedVersion && (
            <>
              <span className="text-xs" style={{ color: '#6e6e73' }}>
                {new Date(selectedVersion.created_at).toLocaleDateString(sr.locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setSelectedVersion(null)}
                className="text-xs px-3 py-1.5 rounded-xl font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#f5f5f7', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                {sr.backToCurrent}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {selectedVersion ? (
        <SnapshotView snapshot={selectedVersion.snapshot} lang={lang} />
      ) : (
        [
          ...sections.slice(0, 1),
          { number: 'gantt', isGantt: true },
          ...sections.slice(1),
        ].map((s, i, arr) => (
          <div key={s.number} className={`sr-slide${s.isGantt ? ' sr-gantt-slide' : ''}`} style={{ marginBottom: i < arr.length - 1 ? 48 : 0 }}>
            {s.isGantt ? (
              <PlanGanttSection projectId={project.id} />
            ) : (
              <>
                <SectionHeader
                  number={s.number} title={s.title} subtitle={s.subtitle}
                  status={sectionStatuses[s.number]}
                  onStatusChange={val => updateSectionStatus(s.number, val)}
                  hasComment={!!(sectionComments[s.number] && sectionComments[s.number].replace(/<[^>]*>/g, '').trim())}
                  commentExpanded={!!commentsExpanded[s.number]}
                  onCommentToggle={() => toggleComment(s.number)}
                />
                {commentsExpanded[s.number] && (
                  <SectionCommentEditor
                    key={`comment-${s.number}`}
                    sectionNumber={s.number}
                    initialHtml={sectionComments[s.number] ?? ''}
                    projectId={project.id}
                    onSave={handleProjectUpdate}
                    lang={lang}
                  />
                )}
                {s.content}
              </>
            )}
            {i < arr.length - 1 && (
              <div className="sr-no-print" style={{ marginTop: 48, borderTop: '1px solid rgba(255,255,255,0.05)' }} />
            )}
          </div>
        ))
      )}
    </div>
  )
}
