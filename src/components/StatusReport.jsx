import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts'
import { Pencil, ChevronDown, ChevronUp } from 'lucide-react'

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
function monthLabel(iso) {
  // iso = 'YYYY-MM'
  const [y, m] = iso.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
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
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}>
          {number}
        </span>
        <h2 className="text-base font-semibold" style={{ color: '#f5f5f7' }}>{title}</h2>
      </div>
      {subtitle && <p className="text-xs ml-9" style={{ color: '#6e6e73' }}>{subtitle}</p>}
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
function ProjectStatusSection({ project, onSave }) {
  const isImpl = project.type === 'implementation'

  // Customer satisfaction — rich text + status indicator
  const [satStatus, setSatStatus] = useState(project.customer_satisfaction_status ?? null)
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

  const CSAT_STATES = [
    { value: 'good',    color: '#30d158', shadow: 'rgba(48,209,88,0.5)',    label: 'Bien' },
    { value: 'regular', color: '#ff9f0a', shadow: 'rgba(255,159,10,0.5)',   label: 'Regular' },
    { value: 'bad',     color: '#ff453a', shadow: 'rgba(255,69,58,0.5)',    label: 'Mal' },
  ]

  async function saveSatStatus(val) {
    const next = satStatus === val ? null : val
    setSatStatus(next)
    await supabase.from('projects').update({ customer_satisfaction_status: next }).eq('id', project.id)
    onSave({ customer_satisfaction_status: next })
  }

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

  const TYPE_LABELS = { implementation: 'Implementación', maintenance: 'Mantenimiento' }
  const STATUS_LABELS = { on_track: 'On track', at_risk: 'At risk', blocked: 'Blocked' }
  const STATUS_COLORS = { on_track: '#30d158', at_risk: '#ff9f0a', blocked: '#ff453a' }

  return (
    <div className="flex flex-col gap-4 mb-4">
      {/* Row 1: Tipo + Team allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type + date */}
        <div style={CARD}>
          <p className="text-xs mb-3" style={{ color: '#6e6e73' }}>Tipo de proyecto</p>
          <span className="text-sm font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: isImpl ? 'rgba(100,210,255,0.12)' : 'rgba(191,90,242,0.12)',
                     color: isImpl ? '#64d2ff' : '#bf5af2' }}>
            {TYPE_LABELS[project.type] ?? project.type}
          </span>
          {!isImpl && project.renewal_date && (
            <div className="mt-3">
              <p className="text-xs" style={{ color: '#6e6e73' }}>Fecha de renovación</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: '#f5f5f7' }}>{fmtDate(project.renewal_date)}</p>
            </div>
          )}
          {isImpl && project.deadline && (
            <div className="mt-3">
              <p className="text-xs" style={{ color: '#6e6e73' }}>Deadline</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: '#f5f5f7' }}>{fmtDate(project.deadline)}</p>
            </div>
          )}
          <div className="mt-3">
            <p className="text-xs" style={{ color: '#6e6e73' }}>Estado</p>
            <span className="text-sm font-medium mt-0.5 inline-block"
              style={{ color: STATUS_COLORS[project.status] ?? '#f5f5f7' }}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
        </div>

        {/* Team allocation */}
        <div style={CARD}>
          <p className="text-xs mb-3" style={{ color: '#6e6e73' }}>
            Team allocation ({resources.length} recurso{resources.length !== 1 ? 's' : ''})
          </p>
          {resources.length === 0 ? (
            <p className="text-xs" style={{ color: '#6e6e73' }}>
              Sin recursos. Añádelos en la tab Recursos &amp; Finanzas.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 text-xs" style={{ color: '#6e6e73', gridTemplateColumns: '1fr auto auto' }}>
                <span>Nombre / Rol</span>
                <span style={{ textAlign: 'right' }}>€/h</span>
                <span style={{ textAlign: 'right', minWidth: 64 }}>Dedicación</span>
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
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
            <span style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
            <p className="text-xs" style={{ color: '#6e6e73' }}>Customer satisfaction</p>
          </div>
          <div className="flex items-center gap-2.5">
            {CSAT_STATES.map(s => (
              <button key={s.value} onClick={() => saveSatStatus(s.value)} title={s.label}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  backgroundColor: s.color,
                  border: 'none', cursor: 'pointer', padding: 0,
                  boxShadow: satStatus === s.value ? `0 0 8px 3px ${s.shadow}` : 'none',
                  opacity: satStatus && satStatus !== s.value ? 0.25 : 1,
                  transition: 'box-shadow 0.2s, opacity 0.2s',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
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
          data-placeholder="Describe la satisfacción del cliente…"
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
            {satSaving ? 'Guardando…' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Section 2: System Stability ───────────────────────────────────────────────
function SystemStabilitySection({ projectId }) {
  const [stats, setStats] = useState([])   // [{month_year, open_count, closed_count}]
  const [editing, setEditing] = useState({}) // { 'YYYY-MM_open' | 'YYYY-MM_closed' → string }

  const months = lastNMonths(6)

  useEffect(() => {
    supabase
      .from('project_bug_stats')
      .select('*')
      .eq('project_id', projectId)
      .in('month_year', months)
      .then(({ data }) => setStats(data ?? []))
  }, [projectId])

  const statsMap = Object.fromEntries(stats.map(s => [s.month_year, s]))

  async function saveCell(monthYear, field, rawVal) {
    const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10))
    if (isNaN(val)) { toast.error('Valor inválido'); return }

    const existing = statsMap[monthYear]
    const payload = {
      project_id:   projectId,
      month_year:   monthYear,
      open_count:   field === 'open'   ? val : (existing?.open_count   ?? 0),
      closed_count: field === 'closed' ? val : (existing?.closed_count ?? 0),
    }

    const { error } = await supabase
      .from('project_bug_stats')
      .upsert(payload, { onConflict: 'project_id,month_year' })
    if (error) { toast.error('Error al guardar'); return }

    setStats(prev => {
      const idx = prev.findIndex(s => s.month_year === monthYear)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...payload }
        return next
      }
      return [...prev, payload]
    })
    setEditing(prev => { const n = { ...prev }; delete n[`${monthYear}_${field}`]; return n })
  }

  function startEdit(monthYear, field) {
    const existing = statsMap[monthYear]
    const current = field === 'open' ? (existing?.open_count ?? '') : (existing?.closed_count ?? '')
    setEditing(prev => ({ ...prev, [`${monthYear}_${field}`]: String(current === 0 ? '' : current) }))
  }

  // KPIs
  const now = new Date()
  const thisMonth = isoMonth(now)
  const thisMonthStats = statsMap[thisMonth]
  const totalOpenThisMonth = thisMonthStats?.open_count ?? 0
  const totalClosedThisMonth = thisMonthStats?.closed_count ?? 0
  const totalOpenYear = stats.filter(s => s.month_year.startsWith(String(now.getFullYear())))
    .reduce((sum, s) => sum + (s.open_count ?? 0), 0)

  // Chart data
  const chartData = months.map(m => ({
    month: monthLabel(m),
    abiertos: statsMap[m]?.open_count ?? 0,
    cerrados: statsMap[m]?.closed_count ?? 0,
  }))

  // Donut: totals across all loaded months
  const totalOpen   = stats.reduce((s, r) => s + (r.open_count ?? 0), 0)
  const totalClosed = stats.reduce((s, r) => s + (r.closed_count ?? 0), 0)
  const donutData = [
    { name: 'Abiertos', value: totalOpen,   color: '#ff453a' },
    { name: 'Cerrados', value: totalClosed, color: '#30d158' },
  ].filter(d => d.value > 0)
  if (donutData.length === 0) donutData.push({ name: 'Sin datos', value: 1, color: '#2a2a2a' })

  function CellBtn({ monthYear, field }) {
    const key = `${monthYear}_${field}`
    const isEditing = editing[key] !== undefined
    const val = field === 'open' ? statsMap[monthYear]?.open_count : statsMap[monthYear]?.closed_count
    const color = field === 'open' ? '#ff453a' : '#30d158'

    if (isEditing) return (
      <input
        autoFocus
        type="number" min="0"
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
          backgroundColor: val ? (field === 'open' ? 'rgba(255,69,58,0.06)' : 'rgba(48,209,88,0.06)') : 'rgba(255,255,255,0.02)',
          transition: 'background 0.15s',
        }}>
        {val ?? '—'}
      </button>
    )
  }

  return (
    <div className="mb-2">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <KpiCard label="Bugs abiertos este mes"  value={totalOpenThisMonth}  color={totalOpenThisMonth  > 0 ? '#ff453a' : '#30d158'} />
        <KpiCard label="Bugs cerrados este mes"  value={totalClosedThisMonth} color="#30d158" />
        <KpiCard label="Total abiertos este año" value={totalOpenYear}        color="#f5f5f7" />
      </div>

      {/* Monthly input table */}
      <div style={CARD} className="mb-4">
        <p className="text-xs font-medium mb-1" style={{ color: '#6e6e73' }}>Bugs por mes — haz click en cualquier celda para editar</p>
        <p className="text-xs mb-4" style={{ color: '#3a3a3a' }}>Introduce directamente el número de bugs abiertos y cerrados cada mes</p>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ color: '#6e6e73', fontWeight: 500, textAlign: 'left', paddingBottom: 8, whiteSpace: 'nowrap', width: 72 }}>
                  Mes
                </th>
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
                { field: 'open',   label: 'Abiertos', color: '#ff453a' },
                { field: 'closed', label: 'Cerrados', color: '#30d158' },
              ].map(row => (
                <tr key={row.field}>
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
          <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>Evolución de bugs (últimos 12 meses)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={8} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="abiertos" fill="#ff453a" radius={[3,3,0,0]} name="Abiertos" />
              <Bar dataKey="cerrados" fill="#30d158" radius={[3,3,0,0]} name="Cerrados" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={CARD} className="flex flex-col items-center justify-center">
          <p className="text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Total acumulado</p>
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
function phaseMetrics(phase) {
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
  if (isCompleted)          { scheduleStatus = 'done';    scheduleColor = '#30d158'; scheduleLabel = 'Completada' }
  else if (isUpcoming)      { scheduleStatus = 'upcoming';scheduleColor = '#6e6e73'; scheduleLabel = 'Pendiente' }
  else if (isOverdue)       { scheduleStatus = 'overdue'; scheduleColor = '#ff453a'; scheduleLabel = 'Retrasada' }
  else if (timePct - progress > 25) { scheduleStatus = 'risk';   scheduleColor = '#ff9f0a'; scheduleLabel = 'En riesgo' }
  else if (delta > 8)       { scheduleStatus = 'ahead';   scheduleColor = '#30d158'; scheduleLabel = `+${Math.round(delta)}% adelantado` }
  else if (delta < -8)      { scheduleStatus = 'behind';  scheduleColor = '#ff9f0a'; scheduleLabel = `${Math.round(delta)}% retrasado` }
  else                      { scheduleStatus = 'ontrack'; scheduleColor = '#64d2ff'; scheduleLabel = 'En plazo' }

  return { timePct, progress, delta, daysRemaining, totalDays, elapsedDays,
           isCompleted, isUpcoming, isActive, isOverdue,
           scheduleStatus, scheduleColor, scheduleLabel }
}

function DeliveringValueSection({ projectId }) {
  const [phases, setPhases] = useState([])
  const [hasPlan, setHasPlan] = useState(null)
  const [showAllPhases, setShowAllPhases] = useState(false)
  const PHASES_VISIBLE = 4

  useEffect(() => {
    async function load() {
      const { data: plans } = await supabase
        .from('project_plans')
        .select('id')
        .eq('project_id', projectId)
        .limit(1)

      if (plans?.length) {
        setHasPlan(true)
        const { data: ph } = await supabase
          .from('plan_phases')
          .select('id, name, color, start_date, end_date, hours, is_milestone, progress')
          .eq('plan_id', plans[0].id)
          .order('order_index')

        setPhases((ph ?? []).filter(p => !p.is_milestone))
      } else {
        setHasPlan(false)
      }
    }
    load()
  }, [projectId])

  // Derived plan stats
  const phasesWithMetrics = phases.map(p => ({ ...p, metrics: phaseMetrics(p) }))
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
          <p className="text-sm" style={{ color: '#6e6e73' }}>Sin plan vinculado a este proyecto. Crea uno en la tab Plan para ver métricas de progreso.</p>
        </div>
      )}

      {phases.length > 0 && (<>
        {/* Overall plan summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <KpiCard label="Progreso global" value={`${overallPct}%`}
            color={overallPct >= 75 ? '#30d158' : overallPct >= 40 ? '#64d2ff' : '#ff9f0a'} />
          <KpiCard label="Fases completadas" value={`${completedPhases}/${phases.length}`}
            color="#f5f5f7" />
          <KpiCard label="Horas planificadas" value={totalHours > 0 ? `${totalHours}h` : '—'}
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
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: activePhase.color }}>Fase activa</span>
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
                  <span>Tiempo transcurrido</span>
                  <span style={{ color: '#f5f5f7' }}>{Math.round(m.timePct)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${m.timePct}%`, backgroundColor: '#6e6e73' }} />
                </div>
                <p className="text-xs mt-1" style={{ color: '#6e6e73' }}>
                  {m.daysRemaining > 0 ? `${m.daysRemaining} días restantes` : `${Math.abs(m.daysRemaining)} días de retraso`}
                </p>
              </div>

              {/* Progreso */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5" style={{ color: '#6e6e73' }}>
                  <span>Progreso</span>
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
                  {m.scheduleStatus === 'ahead'   && `Vais ${Math.round(m.delta)}% por delante del tiempo transcurrido`}
                  {m.scheduleStatus === 'behind'  && `Vais ${Math.abs(Math.round(m.delta))}% por detrás del tiempo transcurrido`}
                  {m.scheduleStatus === 'ontrack' && 'El ritmo está alineado con el tiempo transcurrido'}
                </p>
              </div>
            </div>
          )
        })()}

        {/* All phases */}
        <div style={CARD} className="mb-4">
          <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>Todas las fases</p>
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
                          style={{ backgroundColor: `${phase.color}20`, color: phase.color }}>activa</span>
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
                      {new Date(phase.start_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(phase.end_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
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
                ? <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</>
                : <><ChevronDown className="w-3.5 h-3.5" /> Ver {hiddenCount} fase{hiddenCount > 1 ? 's' : ''} más</>
              }
            </button>
          )}
        </div>
      </>)}

      {/* Effort table + chart (global view) */}
      <EffortOverview projectId={projectId} />
    </div>
  )
}

// ── Effort Overview (monthly table + chart) — used in Global ─────────────────
function EffortOverview({ projectId }) {
  const [effort, setEffort] = useState([])
  const [editingEffort, setEditingEffort] = useState({})
  const months = lastNMonths(4)
  const thisMonth = isoMonth()

  useEffect(() => {
    supabase.from('project_effort').select('*').eq('project_id', projectId)
      .then(({ data }) => setEffort(data ?? []))
  }, [projectId])

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

  const effortMap = Object.fromEntries(effort.map(e => [e.month_year, e.hours]))
  const chartData  = months.map(m => ({ month: monthLabel(m), horas: effortMap[m] ?? 0 }))

  return (<>
    <div style={CARD} className="mb-4 mt-4">
      <p className="text-xs font-medium mb-1" style={{ color: '#6e6e73' }}>Horas de esfuerzo del equipo por mes</p>
      <p className="text-xs mb-4" style={{ color: '#3a3a3a' }}>Haz click en una celda para editar</p>
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
      <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>Evolución del esfuerzo (horas)</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="horas" fill="#64d2ff" radius={[4,4,0,0]} name="Horas" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </>)
}

// ── Team Effort This Month ────────────────────────────────────────────────────
function TeamEffortMonth({ projectId }) {
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
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
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
const TEAM_KPI_FIELDS = [
  { key: 'tasks_closed', label: 'Tareas cerradas este mes', color: '#30d158' },
  { key: 'bugs_closed',  label: 'Bugs cerrados este mes',  color: '#ff9f0a' },
  { key: 'in_progress',  label: 'En progreso',             color: '#64d2ff' },
]

const EMPTY_KPIS = { tasks_closed: 0, bugs_closed: 0, in_progress: 0 }

function TeamPerformanceSection({ projectId }) {
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

  return (
    <div className="mb-2">
      {/* Editable KPI cards — current month */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {TEAM_KPI_FIELDS.map(f => (
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

      {/* Donut charts — one per month */}
      <div style={CARD}>
        <p className="text-xs font-medium mb-4" style={{ color: '#6e6e73' }}>Distribución del trabajo por mes</p>
        <div className="flex gap-4 overflow-x-auto">
          {months.map(m => {
            const kpis = allKpis[m] ?? EMPTY_KPIS
            const data  = donutFor(kpis)
            const isCurrent = m === thisMonth
            return (
              <div key={m} className="flex flex-col items-center shrink-0" style={{ minWidth: 130 }}>
                <span className="text-xs font-medium mb-1" style={{ color: isCurrent ? '#f5f5f7' : '#6e6e73' }}>
                  {monthLabel(m)}{isCurrent ? ' ·  actual' : ''}
                </span>
                <PieChart width={120} height={120}>
                  <Pie data={data} cx={55} cy={55} innerRadius={34} outerRadius={50} dataKey="value" paddingAngle={2}>
                    {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
                <div className="flex flex-col gap-0.5 mt-1 w-full">
                  {data.filter(d => d.name !== 'Sin datos').map(d => (
                    <div key={d.name} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs truncate" style={{ color: '#6e6e73', fontSize: 10 }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
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
function profitHealth(margin, target) {
  if (margin >= target)      return { color: '#30d158', label: 'En objetivo' }
  if (margin >= target / 2)  return { color: '#ff9f0a', label: 'En riesgo' }
  return                            { color: '#ff453a', label: 'Crítico' }
}

// ── Section 5: Profitability ──────────────────────────────────────────────────
function ProfitabilitySection({ projectId }) {
  const [fin,       setFin]       = useState(null)
  const [resources, setResources] = useState([])
  const [actual,    setActual]    = useState({})
  const [invoices,  setInvoices]  = useState([])

  useEffect(() => {
    async function load() {
      const { data: resData } = await supabase
        .from('project_resources').select('*').eq('project_id', projectId)
      const ids = (resData ?? []).map(r => r.id)

      const [{ data: finData }, { data: allocData }, { data: invData }] = await Promise.all([
        supabase.from('project_financials').select('*').eq('project_id', projectId).maybeSingle(),
        ids.length > 0
          ? supabase.from('resource_allocations').select('resource_id,week_start,actual_hours').in('resource_id', ids)
          : { data: [] },
        supabase.from('project_invoices').select('amount').eq('project_id', projectId),
      ])

      setFin(finData)
      setResources(resData ?? [])
      setInvoices(invData ?? [])
      const aMap = {}
      ;(allocData ?? []).forEach(a => {
        if (a.actual_hours) aMap[`${a.resource_id}_${a.week_start}`] = a.actual_hours
      })
      setActual(aMap)
    }
    load()
  }, [projectId])

  if (!fin && resources.length === 0) return (
    <div style={CARD}>
      <p className="text-sm" style={{ color: '#6e6e73' }}>Sin datos financieros. Configúralos en la pestaña Recursos &amp; Finanzas.</p>
    </div>
  )

  const cur      = fin?.currency ?? '€'
  const contract = fin?.contract_value ?? 0
  const target   = fin?.target_margin  ?? 20
  const etdBase  = fin?.effort_to_date != null ? Number(fin.effort_to_date) : 0
  const today    = new Date().toISOString().slice(0, 10)

  const etd = etdBase + resources.reduce((sum, r) => {
    const hours = Object.keys(actual)
      .filter(k => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= today)
      .reduce((s, k) => s + (actual[k] || 0), 0)
    return sum + (hours + (r.hours_to_date || 0)) * (r.hourly_rate || 0)
  }, 0)

  const billed = invoices.length > 0
    ? invoices.reduce((s, i) => s + i.amount, 0)
    : (fin?.invoiced_to_date ?? 0)

  const currentProfit = billed - etd
  const currentMargin = billed > 0 ? (currentProfit / billed) * 100 : 0
  const remainingBudget = contract - etd
  const h = profitHealth(currentMargin, target)

  // Bar widths (relative to contract)
  const maxVal = Math.max(contract, etd, billed, 1)
  const etdPct    = Math.min(100, (etd    / maxVal) * 100)
  const billedPct = Math.min(100, (billed / maxVal) * 100)

  return (
    <div className="mb-2">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard label="Presupuesto" value={fmtMoney(contract, cur)} color="#f5f5f7" />
        <KpiCard label="Coste ETD" value={fmtMoney(etd, cur)} color="#64d2ff" />
        <KpiCard label="Facturado" value={fmtMoney(billed, cur)} color="#30d158" />
        <KpiCard label="Margen actual" value={billed > 0 ? `${currentMargin.toFixed(1)}%` : '—'}
          color={h.color} />
      </div>

      {/* Status + bars */}
      <div style={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium" style={{ color: '#6e6e73' }}>Estado financiero</p>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ backgroundColor: `${h.color}18`, color: h.color }}>
            {h.label}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {/* Budget bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#6e6e73' }}>
              <span>Presupuesto</span>
              <span style={{ color: '#f5f5f7' }}>{fmtMoney(contract, cur)}</span>
            </div>
            <div className="h-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.12)' }} />
            </div>
          </div>

          {/* ETD bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#6e6e73' }}>
              <span>Coste real (ETD)</span>
              <span style={{ color: '#64d2ff' }}>{fmtMoney(etd, cur)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${etdPct}%`, backgroundColor: '#64d2ff' }} />
            </div>
          </div>

          {/* Billed bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#6e6e73' }}>
              <span>Facturado</span>
              <span style={{ color: '#30d158' }}>{fmtMoney(billed, cur)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${billedPct}%`, backgroundColor: '#30d158' }} />
            </div>
          </div>
        </div>

        {/* Summary row */}
        <div className="flex gap-6 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#6e6e73' }}>Margen objetivo</p>
            <p className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>{target}%</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#6e6e73' }}>Beneficio actual</p>
            <p className="text-sm font-semibold" style={{ color: currentProfit >= 0 ? '#30d158' : '#ff453a' }}>
              {fmtMoney(currentProfit, cur)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#6e6e73' }}>Presupuesto restante</p>
            <p className="text-sm font-semibold" style={{ color: remainingBudget >= 0 ? '#f5f5f7' : '#ff453a' }}>
              {fmtMoney(remainingBudget, cur)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section 6: Opportunities & Challenges ────────────────────────────────────
function OpportunitiesSection({ project, onSave }) {
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

  const taStyle = {
    ...INPUT,
    minHeight: 100,
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  }

  return (
    <div className="mb-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={CARD}>
          <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>What are the new business opportunities?</p>
          <textarea
            style={taStyle}
            placeholder="Describe las oportunidades de negocio identificadas…"
            value={opps}
            onChange={e => { setOpps(e.target.value); setDirty(true) }}
            onFocus={fi} onBlur={fo}
          />
        </div>
        <div style={CARD}>
          <p className="text-xs font-medium mb-3" style={{ color: '#6e6e73' }}>What are the challenges?</p>
          <textarea
            style={taStyle}
            placeholder="Describe los retos o bloqueos actuales…"
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
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}
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
  `
  document.head.appendChild(s)
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function StatusReport({ project: initialProject, members, tasks }) {
  const [project, setProject] = useState(initialProject)

  // Sync if parent updates project
  useEffect(() => { setProject(initialProject) }, [initialProject])

  function handleProjectUpdate(updates) {
    setProject(p => ({ ...p, ...updates }))
  }

  const sections = [
    {
      number: '01',
      title: 'What is the status of my project?',
      subtitle: 'Tipo de proyecto, satisfacción del cliente y asignación del equipo',
      content: (
        <ProjectStatusSection
          project={project}
          onSave={handleProjectUpdate}
        />
      ),
    },
    {
      number: '02',
      title: 'Is my system stable?',
      subtitle: 'Bugs registrados, estado y evolución mensual',
      content: <SystemStabilitySection projectId={project.id} />,
    },
    {
      number: '03',
      title: 'Are we delivering value?',
      subtitle: 'Progreso del plan, fases y estado del proyecto',
      content: <DeliveringValueSection projectId={project.id} />,
    },
    {
      number: '04',
      title: 'Is my team working well?',
      subtitle: 'Tareas cerradas, bugs resueltos, trabajo en progreso y esfuerzo del equipo este mes',
      content: <TeamPerformanceSection projectId={project.id} />,
    },
    {
      number: '05',
      title: 'Is the project profitable?',
      subtitle: 'Snapshots semanales de presupuesto, costes y facturación',
      content: <ProfitabilitySection projectId={project.id} />,
    },
    {
      number: '06',
      title: 'Opportunities & Challenges',
      subtitle: 'Nuevas oportunidades de negocio y retos actuales',
      content: (
        <OpportunitiesSection
          project={project}
          onSave={handleProjectUpdate}
        />
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 64px' }}>
      {sections.map((s, i) => (
        <div key={s.number} style={{ marginBottom: i < sections.length - 1 ? 48 : 0 }}>
          <SectionHeader number={s.number} title={s.title} subtitle={s.subtitle} />
          {s.content}
          {i < sections.length - 1 && (
            <div style={{ marginTop: 48, borderTop: '1px solid rgba(255,255,255,0.05)' }} />
          )}
        </div>
      ))}
    </div>
  )
}
