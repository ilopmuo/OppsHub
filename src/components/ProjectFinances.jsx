import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
function weekMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}
function isoDate(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function weekLabel(monday) {
  const sun = new Date(monday); sun.setDate(sun.getDate() + 6)
  const f = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${f(monday)} – ${f(sun)}`
}
function fmt(n, cur = '€') {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1000000) return `${sign}${cur}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1000)    return `${sign}${cur}${(abs / 1000).toFixed(1)}k`
  return `${sign}${cur}${abs.toFixed(0)}`
}
function fmtFull(n, cur = '€') {
  const abs = Math.abs(n)
  return `${n < 0 ? '-' : ''}${cur}${abs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function health(margin, target) {
  if (margin >= target)       return { color: '#30d158', bg: 'rgba(48,209,88,0.1)',  label: 'En objetivo', icon: '●' }
  if (margin >= target / 2)   return { color: '#ff9f0a', bg: 'rgba(255,159,10,0.1)', label: 'En riesgo',   icon: '▲' }
  return                             { color: '#ff453a', bg: 'rgba(255,69,58,0.1)',  label: 'Crítico',     icon: '✕' }
}

// ── Semicircle gauge ──────────────────────────────────────────────────────────
function GaugeArc({ pct: rawPct, color, size = 180 }) {
  const cx = size / 2, cy = size * 0.58, r = size * 0.38
  const clamped = Math.min(99.9, Math.max(0.1, rawPct || 0.1))
  const theta = Math.PI - (clamped / 100) * Math.PI
  const ex = cx + r * Math.cos(theta)
  const ey = cy - r * Math.sin(theta)
  const sw = size * 0.072
  const bgPath = `M ${(cx - r).toFixed(1)} ${cy} A ${r} ${r} 0 0 1 ${(cx + r).toFixed(1)} ${cy}`
  const fgPath = `M ${(cx - r).toFixed(1)} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`
  const id = `glow-${color.replace('#', '')}`
  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} strokeLinecap="round" />
      <path d={fgPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" filter={`url(#${id})`} />
    </svg>
  )
}

// ── Timeline chart ────────────────────────────────────────────────────────────
function TimelineChart({ pastWeeks, etdFn, forecastPoints, contract, invoices, cur }) {
  const hasPast     = pastWeeks.length > 0
  const hasForecast = forecastPoints.length > 0
  if (!hasPast && !hasForecast) return null

  const W = 820, H = 150
  const PL = 50, PR = 16, PT = 12, PB = 30
  const cw = W - PL - PR, ch = H - PT - PB

  const pastData  = pastWeeks.map(w => ({ week: w, cost: etdFn(w) }))
  const allPoints = [...pastData, ...forecastPoints]
  const n         = allPoints.length

  // Compute billed step function per week from invoices
  const sortedInvoices = [...invoices].sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))
  function billedAt(weekStr) {
    // sum all invoices whose date falls on or before the end of this week
    const weekEnd = weekStr.slice(0, 10)
    return sortedInvoices.filter(i => i.invoice_date <= weekEnd).reduce((s, i) => s + i.amount, 0)
  }

  const maxBilled = sortedInvoices.reduce((s, i) => s + i.amount, 0)
  const maxVal    = Math.max(contract || 0, maxBilled, ...allPoints.map(p => p.cost), 1) * 1.08

  const xOf = i => PL + (n <= 1 ? cw / 2 : (i / (n - 1)) * cw)
  const yOf = v => PT + ch - (v / maxVal) * ch

  const pLine = pastData.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.cost).toFixed(1)}`).join(' ')
  const pArea = hasPast
    ? `${pLine} L${xOf(pastData.length - 1).toFixed(1)},${(PT + ch).toFixed(1)} L${xOf(0).toFixed(1)},${(PT + ch).toFixed(1)} Z`
    : ''

  const fcStart = hasPast ? pastData.length - 1 : 0
  const fcPts   = hasPast ? [pastData[pastData.length - 1], ...forecastPoints] : forecastPoints
  const fcLine  = fcPts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xOf(fcStart + i).toFixed(1)},${yOf(p.cost).toFixed(1)}`
  ).join(' ')

  // Billed step function path
  const billedPath = (() => {
    if (allPoints.length === 0) return ''
    const pts = allPoints.map((p, i) => ({ x: xOf(i), y: yOf(billedAt(p.week)) }))
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      // step: go horizontal first, then vertical
      d += ` H ${pts[i].x.toFixed(1)} V ${pts[i].y.toFixed(1)}`
    }
    return d
  })()

  const yTicks   = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: maxVal * t, y: yOf(maxVal * t) }))
  const step     = Math.max(1, Math.floor(n / 6))
  const xLabels  = allPoints
    .map((p, i) => ({ ...p, i }))
    .filter(({ i }) => i % step === 0 || i === n - 1)
    .map(({ week, i }) => ({
      x: xOf(i), isForecast: i >= pastData.length,
      label: new Date(week + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    }))

  const todayX    = hasPast ? xOf(pastData.length - 1) : null
  const contractY = contract > 0 ? yOf(contract) : null

  // Invoice markers
  const invoiceMarkers = sortedInvoices.map(inv => {
    // find closest week index
    const weekStr = isoDate(weekMonday(new Date(inv.invoice_date + 'T12:00:00')))
    const idx     = allPoints.findIndex(p => p.week >= weekStr)
    if (idx < 0) return null
    return { x: xOf(idx), y: yOf(billedAt(weekStr)), amount: inv.amount, label: inv.description || '' }
  }).filter(Boolean)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* Grid */}
      {yTicks.map((t, i) => (
        <line key={i} x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {/* Y labels */}
      {yTicks.filter(t => t.v > 0).map((t, i) => (
        <text key={i} x={PL - 6} y={t.y + 4} textAnchor="end"
          style={{ fontSize: 10, fill: '#3a3a3a', fontFamily: 'Inter,system-ui,sans-serif' }}>
          {fmt(t.v, cur)}
        </text>
      ))}
      {/* Contract line */}
      {contractY != null && (
        <>
          <line x1={PL} y1={contractY} x2={W - PR} y2={contractY}
            stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="6,3" />
          <text x={W - PR - 4} y={contractY - 4} textAnchor="end"
            style={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)', fontFamily: 'Inter,system-ui,sans-serif' }}>contrato</text>
        </>
      )}
      {/* Today divider */}
      {todayX != null && hasForecast && (
        <>
          <line x1={todayX} y1={PT} x2={todayX} y2={PT + ch} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <text x={todayX + 4} y={PT + 10}
            style={{ fontSize: 9, fill: 'rgba(255,255,255,0.18)', fontFamily: 'Inter,system-ui,sans-serif' }}>hoy</text>
        </>
      )}
      {/* Past ETD area + line */}
      {pArea && <path d={pArea} fill="rgba(100,210,255,0.07)" />}
      {pLine && <path d={pLine} stroke="#64d2ff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />}
      {/* Forecast line */}
      {hasForecast && (
        <path d={fcLine} stroke="rgba(255,159,10,0.7)" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeDasharray="6,3" />
      )}
      {/* Billed step line */}
      {billedPath && maxBilled > 0 && (
        <path d={billedPath} stroke="rgba(48,209,88,0.6)" strokeWidth="1.5" fill="none" />
      )}
      {/* Invoice markers */}
      {invoiceMarkers.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r="3.5" fill="#30d158" />
          <line x1={m.x} y1={m.y - 4} x2={m.x} y2={PT} stroke="rgba(48,209,88,0.15)" strokeWidth="1" strokeDasharray="3,3" />
        </g>
      ))}
      {/* Last ETD dot */}
      {hasPast && (
        <circle cx={xOf(pastData.length - 1)} cy={yOf(pastData[pastData.length - 1].cost)} r="3.5" fill="#64d2ff" />
      )}
      {/* X axis */}
      <line x1={PL} y1={PT + ch} x2={W - PR} y2={PT + ch} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H - 6} textAnchor="middle"
          style={{ fontSize: 9, fill: l.isForecast ? '#3a3a3a' : '#4a4a4f', fontFamily: 'Inter,system-ui,sans-serif' }}>
          {l.label}
        </text>
      ))}
      {/* Legend */}
      <circle cx={PL + 8} cy={PT + 6} r="3" fill="#64d2ff" />
      <text x={PL + 15} y={PT + 10} style={{ fontSize: 9, fill: '#64d2ff', fontFamily: 'Inter,system-ui,sans-serif' }}>ETD</text>
      {hasForecast && (
        <>
          <line x1={PL + 48} y1={PT + 6} x2={PL + 60} y2={PT + 6} stroke="rgba(255,159,10,0.7)" strokeWidth="1.5" strokeDasharray="4,2" />
          <text x={PL + 65} y={PT + 10} style={{ fontSize: 9, fill: 'rgba(255,159,10,0.7)', fontFamily: 'Inter,system-ui,sans-serif' }}>proyección</text>
        </>
      )}
      {maxBilled > 0 && (
        <>
          <line x1={PL + 122} y1={PT + 6} x2={PL + 134} y2={PT + 6} stroke="rgba(48,209,88,0.6)" strokeWidth="1.5" />
          <text x={PL + 139} y={PT + 10} style={{ fontSize: 9, fill: 'rgba(48,209,88,0.6)', fontFamily: 'Inter,system-ui,sans-serif' }}>facturado</text>
        </>
      )}
    </svg>
  )
}

// ── Resource cost breakdown ───────────────────────────────────────────────────
function ResourceBreakdown({ resources, resourceETD, resourceETC, totalCost, cur }) {
  if (resources.length === 0) return null
  const sorted = [...resources]
    .map(r => ({ ...r, etd: resourceETD[r.id] || 0, etc: resourceETC[r.id] || 0 }))
    .sort((a, b) => (b.etd + b.etc) - (a.etd + a.etc))
  const maxTotal = Math.max(...sorted.map(r => r.etd + r.etc), 1)
  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
        Distribución de coste por recurso
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map(r => {
          const total    = r.etd + r.etc
          const etdPct   = (r.etd / maxTotal) * 100
          const etcPct   = (r.etc / maxTotal) * 100
          const sharePct = totalCost > 0 ? (total / totalCost) * 100 : 0
          return (
            <div key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 12, color: '#f5f5f7', fontWeight: 500 }}>{r.name}</span>
                  {r.role && <span style={{ fontSize: 10, color: '#3a3a3a', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 6px' }}>{r.role}</span>}
                  {(r.hours_to_date || 0) > 0 && (
                    <span style={{ fontSize: 10, color: '#ff9f0a', backgroundColor: 'rgba(255,159,10,0.08)', borderRadius: 4, padding: '1px 6px' }}>
                      {r.hours_to_date}h acum.
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {r.etd > 0 && <span style={{ fontSize: 10, color: '#64d2ff' }}>{fmt(r.etd, cur)}</span>}
                  {r.etc > 0 && <span style={{ fontSize: 10, color: 'rgba(255,159,10,0.7)' }}>+{fmt(r.etc, cur)}</span>}
                  <span style={{ fontSize: 10, color: '#3a3a3a', minWidth: 28, textAlign: 'right' }}>{sharePct.toFixed(0)}%</span>
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex', gap: 1 }}>
                <div style={{ height: '100%', width: `${etdPct}%`, backgroundColor: '#64d2ff', borderRadius: 3, transition: 'width 0.4s' }} />
                <div style={{ height: '100%', width: `${etcPct}%`, backgroundColor: 'rgba(255,159,10,0.35)', transition: 'width 0.4s' }} />
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#64d2ff' }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: '#64d2ff', display: 'inline-block' }} /> Coste real (ETD)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,159,10,0.65)' }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,159,10,0.4)', display: 'inline-block' }} /> Estimado restante (ETC)
        </span>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function Bar({ value, max, color, label, sublabel }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#6e6e73' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#f5f5f7', fontVariantNumeric: 'tabular-nums' }}>{sublabel}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pctVal}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const INPUT_S = {
  backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#f5f5f7',
  outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}
const CELL = { fontSize: 12, color: '#f5f5f7', padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
const TH   = { fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '9px 10px' }

// ─────────────────────────────────────────────────────────────────────────────
export default function ProjectFinances({ projectId, startDate, endDate }) {
  const [resources,      setResources]      = useState([])
  const [planned,        setPlanned]        = useState({})
  const [actual,         setActual]         = useState({})
  const [financials,     setFinancials]     = useState({ currency: '€', contract_value: 0, invoiced_to_date: 0, effort_to_date: null, target_margin: 20 })
  const [invoices,       setInvoices]       = useState([])
  const [week,           setWeek]           = useState(() => weekMonday())
  const [loading,        setLoading]        = useState(true)
  const [editFin,        setEditFin]        = useState(false)
  const [finForm,        setFinForm]        = useState({})
  const [editingId,      setEditingId]      = useState(null)
  const [resForm,        setResForm]        = useState({ name: '', role: '', hourly_rate: '', hours_to_date: '' })
  const [plannedBuf,     setPlannedBuf]     = useState({})
  const [actualBuf,      setActualBuf]      = useState({})
  const [showAddInvoice, setShowAddInvoice] = useState(false)
  const [invoiceForm,    setInvoiceForm]    = useState({ amount: '', invoice_date: '', description: '' })

  const weekIso = isoDate(week)
  const today   = isoDate(weekMonday())

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: resIds } = await supabase.from('project_resources').select('id').eq('project_id', projectId)
    const ids = resIds?.map(r => r.id) || []
    const [{ data: res }, { data: alloc }, { data: fin }, { data: inv }] = await Promise.all([
      supabase.from('project_resources').select('*').eq('project_id', projectId).order('created_at'),
      ids.length > 0
        ? supabase.from('resource_allocations').select('resource_id, week_start, hours, actual_hours').in('resource_id', ids)
        : { data: [] },
      supabase.from('project_financials').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_invoices').select('*').eq('project_id', projectId).order('invoice_date'),
    ])
    setResources(res || [])
    setInvoices(inv || [])
    const pMap = {}, aMap = {}
    for (const a of alloc || []) {
      if (a.hours)        pMap[`${a.resource_id}_${a.week_start}`] = a.hours
      if (a.actual_hours) aMap[`${a.resource_id}_${a.week_start}`] = a.actual_hours
    }
    setPlanned(pMap); setActual(aMap)
    if (fin) setFinancials(prev => ({ ...prev, ...fin }))
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Save financials ───────────────────────────────────────────────────────
  async function saveFinancials() {
    const payload = {
      project_id:       projectId,
      currency:         finForm.currency || '€',
      contract_value:   parseFloat(finForm.contract_value)   || 0,
      invoiced_to_date: parseFloat(finForm.invoiced_to_date) || 0,
      effort_to_date:   finForm.effort_to_date !== '' && finForm.effort_to_date != null ? parseFloat(finForm.effort_to_date) : null,
      target_margin:    parseFloat(finForm.target_margin)    || 20,
      updated_at:       new Date().toISOString(),
    }
    const { error } = await supabase.from('project_financials').upsert(payload, { onConflict: 'project_id' })
    if (error) { toast.error('Error al guardar'); return }
    setFinancials(payload); setEditFin(false); toast.success('Guardado')
  }

  // ── Invoice CRUD ──────────────────────────────────────────────────────────
  async function addInvoice() {
    const amount = parseFloat(invoiceForm.amount)
    if (!amount || !invoiceForm.invoice_date) { toast.error('Importe y fecha son obligatorios'); return }
    const { data, error } = await supabase.from('project_invoices')
      .insert({ project_id: projectId, amount, invoice_date: invoiceForm.invoice_date, description: invoiceForm.description || null })
      .select().single()
    if (error) { toast.error('Error al guardar'); return }
    setInvoices(prev => [...prev, data].sort((a, b) => a.invoice_date.localeCompare(b.invoice_date)))
    setInvoiceForm({ amount: '', invoice_date: '', description: '' })
    setShowAddInvoice(false)
    toast.success('Factura añadida')
  }
  async function deleteInvoice(id) {
    if (!confirm('¿Eliminar esta factura?')) return
    const { error } = await supabase.from('project_invoices').delete().eq('id', id)
    if (error) { toast.error('Error'); return }
    setInvoices(prev => prev.filter(i => i.id !== id))
  }

  // ── Allocation saves ──────────────────────────────────────────────────────
  async function savePlanned(rid, weekStr, val) {
    const hours = parseFloat(val) || 0
    const key   = `${rid}_${weekStr}`
    setPlanned(p => ({ ...p, [key]: hours }))
    setPlannedBuf(p => { const n = { ...p }; delete n[key]; return n })
    const existActual = actual[key] || 0
    if (hours === 0 && existActual === 0) {
      await supabase.from('resource_allocations').delete().eq('resource_id', rid).eq('week_start', weekStr)
    } else {
      await supabase.from('resource_allocations').upsert({ resource_id: rid, week_start: weekStr, hours, actual_hours: existActual }, { onConflict: 'resource_id,week_start' })
    }
  }
  async function saveActual(rid, weekStr, val) {
    const actual_hours = parseFloat(val) || 0
    const key          = `${rid}_${weekStr}`
    setActual(p => ({ ...p, [key]: actual_hours }))
    setActualBuf(p => { const n = { ...p }; delete n[key]; return n })
    const existPlanned = planned[key] || 0
    if (actual_hours === 0 && existPlanned === 0) {
      await supabase.from('resource_allocations').delete().eq('resource_id', rid).eq('week_start', weekStr)
    } else {
      await supabase.from('resource_allocations').upsert({ resource_id: rid, week_start: weekStr, hours: existPlanned, actual_hours }, { onConflict: 'resource_id,week_start' })
    }
  }

  // ── Resource CRUD ─────────────────────────────────────────────────────────
  async function saveResource() {
    if (!resForm.name.trim()) { toast.error('Añade un nombre'); return }
    const rate        = parseFloat(resForm.hourly_rate)  || 0
    const hoursToDate = parseFloat(resForm.hours_to_date) || 0
    if (editingId === 'new') {
      const { data, error } = await supabase.from('project_resources')
        .insert({ project_id: projectId, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate, hours_to_date: hoursToDate })
        .select().single()
      if (error) { toast.error('Error'); return }
      setResources(p => [...p, data])
    } else {
      await supabase.from('project_resources')
        .update({ name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate, hours_to_date: hoursToDate })
        .eq('id', editingId)
      setResources(p => p.map(r => r.id === editingId
        ? { ...r, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate, hours_to_date: hoursToDate }
        : r))
    }
    setEditingId(null); setResForm({ name: '', role: '', hourly_rate: '', hours_to_date: '' })
  }
  async function deleteResource(r) {
    if (!confirm(`¿Eliminar a "${r.name}"?`)) return
    await supabase.from('resource_allocations').delete().eq('resource_id', r.id)
    await supabase.from('project_resources').delete().eq('id', r.id)
    setResources(p => p.filter(x => x.id !== r.id))
    setPlanned(p => { const n = { ...p }; Object.keys(n).filter(k => k.startsWith(r.id + '_')).forEach(k => delete n[k]); return n })
    setActual(p => { const n = { ...p }; Object.keys(n).filter(k => k.startsWith(r.id + '_')).forEach(k => delete n[k]); return n })
    toast.success('Recurso eliminado')
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const cur      = financials.currency || '€'
  const contract = financials.contract_value || 0
  const target   = financials.target_margin  || 20
  const etdBase  = financials.effort_to_date != null ? Number(financials.effort_to_date) : 0

  // billed = sum of invoices if any, otherwise manual field
  const billed = invoices.length > 0
    ? invoices.reduce((s, i) => s + i.amount, 0)
    : (financials.invoiced_to_date || 0)

  // ETD = etdBase + Σ resources × (hours_to_date + weekly_actuals_up_to_today) × rate
  const etd = etdBase + resources.reduce((sum, r) => {
    const weeklyActuals = Object.keys(actual)
      .filter(k => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= today)
      .reduce((s, k) => s + (actual[k] || 0), 0)
    return sum + (weeklyActuals + (r.hours_to_date || 0)) * r.hourly_rate
  }, 0)

  const etcWeeks = useMemo(() => {
    if (!endDate) return 0
    const endIso = isoDate(weekMonday(new Date(endDate + 'T12:00:00')))
    let total = 0
    let d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 7)
    while (isoDate(d) <= endIso) {
      const wIso = isoDate(d)
      for (const r of resources) {
        const act  = actual[`${r.id}_${wIso}`]  || 0
        const plan = planned[`${r.id}_${wIso}`] || 0
        total += (act > 0 ? act : plan) * r.hourly_rate
      }
      d = new Date(d); d.setDate(d.getDate() + 7)
    }
    return total
  }, [planned, actual, resources, today, endDate])

  const currentProfit = billed - etd
  const currentMargin = billed > 0 ? (currentProfit / billed) * 100 : 0
  // Margen a día de hoy: (contrato - ETD) / contrato — cuánto margen tengo con lo gastado hasta hoy
  const todayMargin   = contract > 0 ? ((contract - etd) / contract) * 100 : 0
  const totalCost     = etd + etcWeeks
  const finalProfit   = contract - totalCost
  const finalMargin   = contract > 0 ? (finalProfit / contract) * 100 : 0
  const h             = health(finalMargin, target)

  const startMon   = startDate ? weekMonday(new Date(startDate + 'T12:00:00')) : null
  const endMon     = endDate   ? weekMonday(new Date(endDate   + 'T12:00:00')) : null
  const totalWeeks = (startMon && endMon) ? Math.max(1, Math.round((endMon - startMon) / (7 * 864e5))) : 0
  const elapsed    = startMon ? Math.max(0, Math.round((weekMonday() - startMon) / (7 * 864e5))) : 0
  const timePct    = totalWeeks > 0 ? Math.min(100, elapsed / totalWeeks * 100) : 0
  const remaining  = endMon ? Math.max(0, Math.round((endMon - weekMonday()) / (7 * 864e5))) : 0

  // Chart: past weeks
  const chartWeeks = useMemo(() => {
    const s = new Set([today])
    Object.keys(actual).forEach(k => s.add(k.slice(-10)))
    const sorted = [...s].sort()
    const result = []
    let d = weekMonday(new Date(sorted[0] + 'T12:00:00'))
    while (isoDate(d) <= today) {
      result.push(isoDate(d))
      d = new Date(d); d.setDate(d.getDate() + 7)
    }
    return result
  }, [actual, today])

  function etdAt(weekStr) {
    const cap = weekStr <= today ? weekStr : today
    return etdBase + resources.reduce((sum, r) => {
      const weeklyActuals = Object.keys(actual)
        .filter(k => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= cap)
        .reduce((s, k) => s + (actual[k] || 0), 0)
      return sum + (weeklyActuals + (r.hours_to_date || 0)) * r.hourly_rate
    }, 0)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const forecastPoints = useMemo(() => {
    if (!endDate) return []
    const endIso = isoDate(weekMonday(new Date(endDate + 'T12:00:00')))
    const result = []
    let running = etd
    let d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 7)
    while (isoDate(d) <= endIso) {
      const wIso = isoDate(d)
      for (const r of resources) {
        const act  = actual[`${r.id}_${wIso}`]  || 0
        const plan = planned[`${r.id}_${wIso}`] || 0
        running += (act > 0 ? act : plan) * r.hourly_rate
      }
      result.push({ week: wIso, cost: running })
      d = new Date(d); d.setDate(d.getDate() + 7)
    }
    return result
  }, [etd, resources, actual, planned, today, endDate])

  const resourceETD = useMemo(() => {
    const map = {}
    for (const r of resources) {
      const weeklyActuals = Object.keys(actual)
        .filter(k => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= today)
        .reduce((s, k) => s + (actual[k] || 0), 0)
      map[r.id] = (weeklyActuals + (r.hours_to_date || 0)) * r.hourly_rate
    }
    return map
  }, [resources, actual, today])

  const resourceETC = useMemo(() => {
    const map = {}
    if (!endDate) return map
    const endIso = isoDate(weekMonday(new Date(endDate + 'T12:00:00')))
    for (const r of resources) {
      let total = 0
      let d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 7)
      while (isoDate(d) <= endIso) {
        const wIso = isoDate(d)
        const act  = actual[`${r.id}_${wIso}`]  || 0
        const plan = planned[`${r.id}_${wIso}`] || 0
        total += (act > 0 ? act : plan) * r.hourly_rate
        d = new Date(d); d.setDate(d.getDate() + 7)
      }
      map[r.id] = total
    }
    return map
  }, [resources, actual, planned, today, endDate])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ height: 340, borderRadius: 16, backgroundColor: '#111' }} />
      <div style={{ height: 200, borderRadius: 16, backgroundColor: '#111' }} />
    </div>
  )

  const hasBudget = contract > 0
  const gaugePct  = target > 0 ? Math.max(0, (finalMargin / target) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ══ FINANCIAL OVERVIEW ════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Control financiero</span>
            {hasBudget && (
              <span style={{ fontSize: 11, fontWeight: 600, color: h.color, backgroundColor: h.bg, borderRadius: 20, padding: '3px 10px' }}>
                {h.icon} {h.label}
              </span>
            )}
            {remaining > 0 && (
              <span style={{ fontSize: 10, color: '#3a3a3a', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 8px' }}>
                {remaining} sem. restantes
              </span>
            )}
          </div>
          {!editFin
            ? <button onClick={() => { setFinForm({ ...financials, effort_to_date: financials.effort_to_date ?? '', target_margin: financials.target_margin ?? 20 }); setEditFin(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
              ><Pencil size={11} /> Editar</button>
            : <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditFin(false)} style={{ fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button onClick={saveFinancials} style={{ fontSize: 11, fontWeight: 600, color: '#000', background: '#f5f5f7', border: 'none', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
              </div>
          }
        </div>

        {/* Edit form */}
        {editFin && (
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.015)' }}>
            {[
              { k: 'contract_value',  l: 'Contrato (ingresos)',  ph: '0'  },
              { k: 'effort_to_date',  l: 'ETD base (histórica)', ph: '0'  },
              { k: 'target_margin',   l: 'Margen objetivo (%)',  ph: '20' },
            ].map(({ k, l, ph }) => (
              <div key={k}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>{l}</label>
                <input style={INPUT_S} type="number" min="0" step={k === 'target_margin' ? '1' : '100'}
                  value={finForm[k] ?? ''} onChange={e => setFinForm(p => ({ ...p, [k]: e.target.value === '' ? null : e.target.value }))} placeholder={ph} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>Moneda</label>
              <select style={INPUT_S} value={finForm.currency || '€'} onChange={e => setFinForm(p => ({ ...p, currency: e.target.value }))}>
                <option>€</option><option>$</option><option>£</option>
              </select>
            </div>
          </div>
        )}

        {/* Main KPI section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0 }}>

          {/* LEFT */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Situación actual</div>
            <div>
              <div style={{ fontSize: 10, color: '#6e6e73', marginBottom: 4 }}>Contrato</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#f5f5f7', lineHeight: 1 }}>
                {hasBudget ? fmtFull(contract, cur) : '—'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              {[
                { label: 'ETD acumulado', value: fmt(etd, cur), sub: hasBudget ? `${((etd/contract)*100).toFixed(0)}% del contrato` : undefined, color: '#64d2ff' },
                { label: 'Facturado', value: fmt(billed, cur), sub: hasBudget ? `${((billed/contract)*100).toFixed(0)}% del contrato` : undefined, color: '#30d158' },
                { label: 'Beneficio actual', value: fmt(currentProfit, cur), sub: billed > 0 ? `${currentMargin.toFixed(1)}% margen` : undefined, color: currentProfit >= 0 ? '#30d158' : '#ff453a' },
                { label: 'ETC estimado', value: etcWeeks > 0 ? fmt(etcWeeks, cur) : '—', sub: 'coste restante', color: '#ff9f0a' },
              ].map(({ label, value, sub, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1, marginBottom: 3 }}>{value}</div>
                  {sub && <div style={{ fontSize: 10, color: '#4a4a4f' }}>{sub}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* CENTER — gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 28px', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', minWidth: 200 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Margen final est.</div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GaugeArc pct={gaugePct} color={h.color} size={170} />
              <div style={{ position: 'absolute', bottom: 2, textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: h.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {hasBudget ? `${finalMargin.toFixed(1)}%` : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#3a3a3a', marginTop: 3 }}>objetivo {target}%</div>
              </div>
            </div>
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6e6e73', marginBottom: 3 }}>Beneficio final est.</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: finalProfit >= 0 ? '#30d158' : '#ff453a' }}>
                {hasBudget ? fmtFull(finalProfit, cur) : '—'}
              </div>
            </div>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6e6e73', marginBottom: 3 }}>Coste total estimado</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f7' }}>
                {totalCost > 0 ? fmt(totalCost, cur) : '—'}
                {hasBudget && totalCost > 0 && (
                  <span style={{ fontSize: 10, color: '#3a3a3a', marginLeft: 5 }}>({((totalCost/contract)*100).toFixed(0)}%)</span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — progress bars */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Distribución del presupuesto</div>
            <Bar label="Tiempo transcurrido" sublabel={totalWeeks > 0 ? `${elapsed} / ${totalWeeks} sem` : '—'}
              value={timePct} max={100} color={timePct > 80 ? '#ff453a' : timePct > 60 ? '#ff9f0a' : '#6e6e73'} />
            <Bar label="ETD sobre contrato" sublabel={hasBudget ? `${fmt(etd, cur)} / ${fmt(contract, cur)}` : fmt(etd, cur)}
              value={etd} max={contract || etd || 1} color={hasBudget && etd > contract ? '#ff453a' : '#64d2ff'} />
            <Bar label="Facturado sobre contrato" sublabel={hasBudget ? `${fmt(billed, cur)} / ${fmt(contract, cur)}` : fmt(billed, cur)}
              value={billed} max={contract || billed || 1} color="#30d158" />
            <Bar label="Coste total est. / contrato" sublabel={hasBudget ? `${fmt(totalCost, cur)} / ${fmt(contract, cur)}` : '—'}
              value={totalCost} max={contract || totalCost || 1} color={totalCost > contract ? '#ff453a' : '#ff9f0a'} />
            <Bar label={`Margen a hoy vs objetivo ${target}%`} sublabel={hasBudget ? `${todayMargin.toFixed(1)}%` : '—'}
              value={Math.max(0, todayMargin)} max={Math.max(target, todayMargin, 1)}
              color={todayMargin >= target ? '#30d158' : todayMargin >= target / 2 ? '#ff9f0a' : '#ff453a'} />
          </div>
        </div>

        {/* Timeline chart */}
        {(chartWeeks.length >= 1 || forecastPoints.length > 0) && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '14px 20px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Evolución del coste
            </div>
            <TimelineChart
              pastWeeks={chartWeeks} etdFn={etdAt}
              forecastPoints={forecastPoints}
              contract={contract} invoices={invoices} cur={cur}
            />
          </div>
        )}

        {/* Resource cost breakdown */}
        {resources.length > 0 && (
          <ResourceBreakdown resources={resources} resourceETD={resourceETD} resourceETC={resourceETC} totalCost={totalCost} cur={cur} />
        )}

        {/* Warnings */}
        {hasBudget && (() => {
          const warns = []
          if (totalCost > contract)           warns.push({ c: '#ff453a', t: `El coste total estimado (${fmt(totalCost, cur)}) supera el contrato (${fmt(contract, cur)}).` })
          else if (finalMargin < target / 2)  warns.push({ c: '#ff453a', t: `Margen final estimado ${finalMargin.toFixed(1)}% — muy por debajo del objetivo ${target}%.` })
          else if (finalMargin < target)      warns.push({ c: '#ff9f0a', t: `Margen final estimado ${finalMargin.toFixed(1)}% — por debajo del objetivo ${target}%. Revisa las estimaciones.` })
          if (etcWeeks === 0 && endDate)      warns.push({ c: '#ff9f0a', t: 'Sin horas planificadas en semanas futuras. ETC = 0 puede dar un margen irreal.' })
          if (timePct > 80 && etd / contract > 0.7) warns.push({ c: '#ff9f0a', t: `Proyecto al ${timePct.toFixed(0)}% del tiempo con el ${((etd/contract)*100).toFixed(0)}% del presupuesto consumido.` })
          if (warns.length === 0) return null
          return (
            <div style={{ padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {warns.map((w, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 10, backgroundColor: w.c + '12', border: `1px solid ${w.c}28` }}>
                  <span style={{ fontSize: 11, color: w.c }}>{w.t}</span>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* ══ FACTURAS ══════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: invoices.length > 0 || showAddInvoice ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Facturas emitidas</span>
            {invoices.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#30d158' }}>
                {fmtFull(invoices.reduce((s, i) => s + i.amount, 0), cur)}
              </span>
            )}
            {invoices.length === 0 && financials.invoiced_to_date > 0 && (
              <span style={{ fontSize: 10, color: '#3a3a3a' }}>usando valor manual: {fmt(financials.invoiced_to_date, cur)}</span>
            )}
          </div>
          {!showAddInvoice && (
            <button onClick={() => setShowAddInvoice(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><Plus size={11} /> Añadir factura</button>
          )}
        </div>

        {/* Add invoice form */}
        {showAddInvoice && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.015)', display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>Importe</label>
              <input style={INPUT_S} type="number" min="0" step="100" placeholder="0"
                value={invoiceForm.amount} onChange={e => setInvoiceForm(p => ({ ...p, amount: e.target.value }))} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>Fecha</label>
              <input style={INPUT_S} type="date"
                value={invoiceForm.invoice_date} onChange={e => setInvoiceForm(p => ({ ...p, invoice_date: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>Concepto (opcional)</label>
              <input style={INPUT_S} type="text" placeholder="Anticipo, primer hito…"
                value={invoiceForm.description} onChange={e => setInvoiceForm(p => ({ ...p, description: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addInvoice()} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={addInvoice}
                style={{ height: 34, paddingInline: 14, borderRadius: 8, backgroundColor: '#f5f5f7', color: '#000', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                Añadir
              </button>
              <button onClick={() => { setShowAddInvoice(false); setInvoiceForm({ amount: '', invoice_date: '', description: '' }) }}
                style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Invoice list */}
        {invoices.length > 0 ? (
          <div>
            {invoices.map((inv, idx) => (
              <div key={inv.id}
                style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: idx < invoices.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#30d158', marginRight: 12, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#6e6e73', minWidth: 110 }}>{fmtDate(inv.invoice_date)}</span>
                <span style={{ fontSize: 12, color: '#f5f5f7', fontWeight: 600, minWidth: 100 }}>{fmtFull(inv.amount, cur)}</span>
                <span style={{ fontSize: 12, color: '#3a3a3a', flex: 1 }}>{inv.description || ''}</span>
                <button onClick={() => deleteInvoice(inv.id)}
                  style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ff453a'; e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                ><Trash2 size={11} /></button>
              </div>
            ))}
            {/* Total row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div style={{ width: 8, marginRight: 12 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.07em', minWidth: 110 }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#30d158' }}>{fmtFull(invoices.reduce((s, i) => s + i.amount, 0), cur)}</span>
              {hasBudget && (
                <span style={{ fontSize: 10, color: '#3a3a3a', marginLeft: 10 }}>
                  ({((invoices.reduce((s, i) => s + i.amount, 0) / contract) * 100).toFixed(0)}% del contrato)
                </span>
              )}
            </div>
          </div>
        ) : !showAddInvoice && (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#3a3a3a' }}>Sin facturas añadidas. El total facturado se toma del valor manual en "Editar".</p>
          </div>
        )}
      </div>

      {/* ══ RESOURCE TABLE ════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Recursos &amp; dedicación semanal</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setWeek(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d })}
              style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><ChevronLeft size={13} /></button>
            <span style={{ fontSize: 11, minWidth: 130, textAlign: 'center', color: weekIso === today ? '#f5f5f7' : '#6e6e73', fontWeight: weekIso === today ? 600 : 400 }}>
              {weekIso === today ? '● ' : ''}{weekLabel(week)}
            </span>
            <button onClick={() => setWeek(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d })}
              style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><ChevronRight size={13} /></button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '22%' }} /><col style={{ width: '14%' }} /><col style={{ width: '8%' }} />
            <col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} />
            <col style={{ width: '13%' }} /><col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ ...TH, textAlign: 'left' }}>Nombre</th>
              <th style={{ ...TH, textAlign: 'left' }}>Rol</th>
              <th style={{ ...TH, textAlign: 'right' }}>€/h</th>
              <th style={{ ...TH, textAlign: 'right' }}><span style={{ color: '#64d2ff' }}>Plan h</span></th>
              <th style={{ ...TH, textAlign: 'right' }}><span style={{ color: '#30d158' }}>Real h</span></th>
              <th style={{ ...TH, textAlign: 'right' }}>Δ Coste</th>
              <th style={{ ...TH, textAlign: 'right' }}>Coste total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {resources.map(r => {
              const key   = `${r.id}_${weekIso}`
              const planH = key in plannedBuf ? parseFloat(plannedBuf[key]) || 0 : (planned[key] || 0)
              const realH = key in actualBuf  ? parseFloat(actualBuf[key])  || 0 : (actual[key]  || 0)
              const delta = (realH - planH) * r.hourly_rate
              const rEtd  = resourceETD[r.id] || 0

              const inlineInput = (val, color, accent, bg, onChange, onBlur) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <input type="number" min="0" step="0.5" value={val || ''} placeholder="—" onChange={e => onChange(e.target.value)}
                    onBlur={onBlur} onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    style={{ width: 48, textAlign: 'right', fontSize: 12, fontFamily: 'inherit', backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: 5, padding: '2px 4px', color: val > 0 ? color : '#3a3a3a', outline: 'none', transition: 'all 0.15s' }}
                    onFocus={e => { e.target.style.borderColor = accent; e.target.style.backgroundColor = bg }}
                    onBlurCapture={e => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent' }}
                  />
                  <span style={{ fontSize: 10, color: '#3a3a3a' }}>h</span>
                </span>
              )

              if (editingId === r.id) return (
                <tr key={r.id} style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <input style={INPUT_S} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus />
                  </td>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <input style={INPUT_S} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" />
                  </td>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <input style={{ ...INPUT_S, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="0" />
                  </td>
                  {/* Bulk hours field spans 3 cols */}
                  <td colSpan={3} style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <div>
                      <label style={{ fontSize: 10, color: '#6e6e73', display: 'block', marginBottom: 4 }}>Horas trabajadas hasta hoy (acumuladas)</label>
                      <input style={{ ...INPUT_S, textAlign: 'right' }} type="number" min="0" step="1"
                        value={resForm.hours_to_date} onChange={e => setResForm(p => ({ ...p, hours_to_date: e.target.value }))} placeholder="0 h totales" />
                    </div>
                  </td>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }} />
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                      <button onClick={saveResource} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', border: 'none', cursor: 'pointer', color: '#000' }}><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              )

              return (
                <tr key={r.id}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  style={{ transition: 'background-color 0.1s' }}
                >
                  <td style={CELL}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>{r.name}</span>
                      {(r.hours_to_date || 0) > 0 && (
                        <span style={{ fontSize: 10, color: '#ff9f0a', backgroundColor: 'rgba(255,159,10,0.08)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                          {r.hours_to_date}h
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...CELL, color: '#6e6e73' }}>{r.role || <span style={{ color: '#3a3a3a' }}>—</span>}</td>
                  <td style={{ ...CELL, textAlign: 'right', color: '#6e6e73' }}>{r.hourly_rate}{cur}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    {inlineInput(key in plannedBuf ? plannedBuf[key] : (planned[key] || ''), '#64d2ff', 'rgba(100,210,255,0.25)', 'rgba(100,210,255,0.06)',
                      v => setPlannedBuf(p => ({ ...p, [key]: v })),
                      () => savePlanned(r.id, weekIso, plannedBuf[key] ?? planned[key] ?? 0))}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    {inlineInput(key in actualBuf ? actualBuf[key] : (actual[key] || ''), '#30d158', 'rgba(48,209,88,0.25)', 'rgba(48,209,88,0.06)',
                      v => setActualBuf(p => ({ ...p, [key]: v })),
                      () => saveActual(r.id, weekIso, actualBuf[key] ?? actual[key] ?? 0))}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', fontSize: 11, color: (planH > 0 || realH > 0) ? (delta > 0 ? '#ff9f0a' : delta < 0 ? '#30d158' : '#6e6e73') : '#3a3a3a' }}>
                    {(planH > 0 || realH > 0) ? `${delta >= 0 ? '+' : ''}${fmt(delta, cur)}` : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', fontSize: 11 }}>
                    {rEtd > 0 ? <span style={{ color: '#64d2ff' }}>{fmt(rEtd, cur)}</span> : <span style={{ color: '#3a3a3a' }}>—</span>}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditingId(r.id); setResForm({ name: r.name, role: r.role || '', hourly_rate: r.hourly_rate, hours_to_date: r.hours_to_date || '' }) }}
                        style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
                      ><Pencil size={11} /></button>
                      <button onClick={() => deleteResource(r)}
                        style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ff453a'; e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.12)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                      ><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {/* Totals row */}
            {resources.length > 1 && (() => {
              const totalPlanH  = resources.reduce((s, r) => s + (planned[`${r.id}_${weekIso}`] || 0), 0)
              const totalRealH  = resources.reduce((s, r) => s + (actual[`${r.id}_${weekIso}`]  || 0), 0)
              const totalDelta  = resources.reduce((s, r) => {
                const p = planned[`${r.id}_${weekIso}`] || 0
                const a = actual[`${r.id}_${weekIso}`]  || 0
                return s + (a - p) * r.hourly_rate
              }, 0)
              const totalAllETD = resources.reduce((s, r) => s + (resourceETD[r.id] || 0), 0)
              if (totalPlanH === 0 && totalRealH === 0 && totalAllETD === 0) return null
              return (
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ ...CELL, borderBottom: 'none', color: '#6e6e73', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }} colSpan={3}>Total semana</td>
                  <td style={{ ...CELL, borderBottom: 'none', textAlign: 'right', color: totalPlanH > 0 ? '#64d2ff' : '#3a3a3a', fontWeight: 600 }}>
                    {totalPlanH > 0 ? `${totalPlanH}h` : '—'}
                  </td>
                  <td style={{ ...CELL, borderBottom: 'none', textAlign: 'right', color: totalRealH > 0 ? '#30d158' : '#3a3a3a', fontWeight: 600 }}>
                    {totalRealH > 0 ? `${totalRealH}h` : '—'}
                  </td>
                  <td style={{ ...CELL, borderBottom: 'none', textAlign: 'right', fontSize: 11, fontWeight: 600, color: totalDelta !== 0 ? (totalDelta > 0 ? '#ff9f0a' : '#30d158') : '#6e6e73' }}>
                    {(totalPlanH > 0 || totalRealH > 0) ? `${totalDelta >= 0 ? '+' : ''}${fmt(totalDelta, cur)}` : '—'}
                  </td>
                  <td style={{ ...CELL, borderBottom: 'none', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64d2ff' }}>
                    {totalAllETD > 0 ? fmt(totalAllETD, cur) : '—'}
                  </td>
                  <td style={{ ...CELL, borderBottom: 'none' }} />
                </tr>
              )
            })()}

            {editingId === 'new' && (
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <input style={INPUT_S} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus />
                </td>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <input style={INPUT_S} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" />
                </td>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <input style={{ ...INPUT_S, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="€/h" />
                </td>
                <td colSpan={3} style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <div>
                    <label style={{ fontSize: 10, color: '#6e6e73', display: 'block', marginBottom: 4 }}>Horas trabajadas hasta hoy (acumuladas)</label>
                    <input style={{ ...INPUT_S, textAlign: 'right' }} type="number" min="0" step="1"
                      value={resForm.hours_to_date} onChange={e => setResForm(p => ({ ...p, hours_to_date: e.target.value }))} placeholder="0 h" />
                  </div>
                </td>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }} />
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={saveResource} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', border: 'none', cursor: 'pointer', color: '#000' }}><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}><X size={12} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {editingId !== 'new' && (
          <div style={{ padding: '10px 20px', borderTop: resources.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <button onClick={() => { setEditingId('new'); setResForm({ name: '', role: '', hourly_rate: '', hours_to_date: '' }) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><Plus size={13} /> Añadir recurso</button>
          </div>
        )}
        {resources.length === 0 && editingId !== 'new' && (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#3a3a3a' }}>Sin recursos añadidos todavía</p>
          </div>
        )}
      </div>
    </div>
  )
}
