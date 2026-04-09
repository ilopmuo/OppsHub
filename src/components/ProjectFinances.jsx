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
  if (abs >= 1000) return `${sign}${cur}${(abs / 1000).toFixed(1)}k`
  return `${sign}${cur}${abs.toFixed(0)}`
}
function fmtFull(n, cur = '€') {
  const abs = Math.abs(n)
  return `${n < 0 ? '-' : ''}${cur}${abs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function pct(n) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }

// ── Health thresholds ─────────────────────────────────────────────────────────
function health(forecastMargin, target) {
  if (forecastMargin >= target)           return { color: '#30d158', bg: 'rgba(48,209,88,0.1)',   label: 'En objetivo',   icon: '●' }
  if (forecastMargin >= target / 2)       return { color: '#ff9f0a', bg: 'rgba(255,159,10,0.1)',  label: 'En riesgo',     icon: '▲' }
  return                                         { color: '#ff453a', bg: 'rgba(255,69,58,0.1)',   label: 'Crítico',       icon: '✕' }
}

// ── Tiny SVG sparkline (cost vs billed over weeks) ────────────────────────────
function EvolutionChart({ weeks, etdFn, contract, cur }) {
  if (weeks.length < 2) return null
  const data = weeks.map(w => ({ etd: etdFn(w) }))
  const maxV = Math.max(contract || 1, ...data.map(d => d.etd), 1)
  const W = 600, H = 72
  const PL = 0, PR = 0, PT = 8, PB = 8
  const cw = W - PL - PR, ch = H - PT - PB
  const x = i => PL + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw)
  const y = v => PT + ch - (v / maxV) * ch

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.etd).toFixed(1)}`).join(' ')
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(PT + ch).toFixed(1)} L${x(0).toFixed(1)},${(PT + ch).toFixed(1)} Z`
  const contractY = y(contract || maxV)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* contract line */}
      {contract > 0 && (
        <line x1={0} y1={contractY} x2={W} y2={contractY}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="6,3" />
      )}
      {/* cost area */}
      <path d={area} fill="rgba(100,210,255,0.07)" />
      <path d={line} stroke="#64d2ff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      {/* last dot */}
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].etd)} r="3" fill="#64d2ff" />
    </svg>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function Bar({ value, max, color, label, sublabel, bg = 'rgba(255,255,255,0.05)' }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#6e6e73' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#f5f5f7' }}>{sublabel}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, backgroundColor: bg, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pctVal}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── Shared input styles ───────────────────────────────────────────────────────
const INPUT_S = {
  backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#f5f5f7',
  outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}
const CELL = { fontSize: 12, color: '#f5f5f7', padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
const TH = { fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '9px 10px' }

// ─────────────────────────────────────────────────────────────────────────────
export default function ProjectFinances({ projectId, startDate, endDate }) {
  const [resources,     setResources]     = useState([])
  const [planned,       setPlanned]       = useState({})   // `${rid}_${weekIso}` → h
  const [actual,        setActual]        = useState({})   // `${rid}_${weekIso}` → h
  const [financials,    setFinancials]    = useState({ currency: '€', contract_value: 0, invoiced_to_date: 0, effort_to_date: null, target_margin: 20 })
  const [week,          setWeek]          = useState(() => weekMonday())
  const [loading,       setLoading]       = useState(true)
  const [editFin,       setEditFin]       = useState(false)
  const [finForm,       setFinForm]       = useState({})
  const [editingId,     setEditingId]     = useState(null)
  const [resForm,       setResForm]       = useState({ name: '', role: '', hourly_rate: '' })
  const [plannedBuf,    setPlannedBuf]    = useState({})
  const [actualBuf,     setActualBuf]     = useState({})

  const weekIso = isoDate(week)
  const today   = isoDate(weekMonday())

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: resIds } = await supabase.from('project_resources').select('id').eq('project_id', projectId)
    const ids = resIds?.map(r => r.id) || []
    const [{ data: res }, { data: alloc }, { data: fin }] = await Promise.all([
      supabase.from('project_resources').select('*').eq('project_id', projectId).order('created_at'),
      ids.length > 0
        ? supabase.from('resource_allocations').select('resource_id, week_start, hours, actual_hours').in('resource_id', ids)
        : { data: [] },
      supabase.from('project_financials').select('*').eq('project_id', projectId).maybeSingle(),
    ])
    setResources(res || [])
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

  // ── Allocation saves ──────────────────────────────────────────────────────
  async function savePlanned(rid, weekStr, val) {
    const hours = parseFloat(val) || 0
    const key = `${rid}_${weekStr}`
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
    const key = `${rid}_${weekStr}`
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
    const rate = parseFloat(resForm.hourly_rate) || 0
    if (editingId === 'new') {
      const { data, error } = await supabase.from('project_resources')
        .insert({ project_id: projectId, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate })
        .select().single()
      if (error) { toast.error('Error'); return }
      setResources(p => [...p, data])
    } else {
      await supabase.from('project_resources').update({ name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate }).eq('id', editingId)
      setResources(p => p.map(r => r.id === editingId ? { ...r, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate } : r))
    }
    setEditingId(null); setResForm({ name: '', role: '', hourly_rate: '' })
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
  const contract = financials.contract_value   || 0
  const billed   = financials.invoiced_to_date || 0
  const etdBase  = financials.effort_to_date != null ? Number(financials.effort_to_date) : 0
  const target   = financials.target_margin   || 20

  // ETD = etdBase + ALL actual hours × rates (cumulative today)
  const etd = etdBase + resources.reduce((sum, r) =>
    sum + Object.keys(actual)
      .filter(k => k.startsWith(r.id + '_'))
      .reduce((s, k) => s + (actual[k] || 0) * r.hourly_rate, 0)
  , 0)

  // ETC = planned hours × rates for future weeks until endDate
  const etcWeeks = useMemo(() => {
    if (!endDate) return 0
    const endIso = isoDate(weekMonday(new Date(endDate + 'T12:00:00')))
    let total = 0
    let cur2 = new Date(today + 'T12:00:00'); cur2.setDate(cur2.getDate() + 7)
    while (isoDate(cur2) <= endIso) {
      const wIso = isoDate(cur2)
      for (const r of resources) total += (planned[`${r.id}_${wIso}`] || 0) * r.hourly_rate
      cur2 = new Date(cur2); cur2.setDate(cur2.getDate() + 7)
    }
    return total
  }, [planned, resources, today, endDate])

  // Current metrics
  const currentProfit = billed - etd
  const currentMargin = billed > 0 ? (currentProfit / billed) * 100 : 0

  // Forecast metrics
  const totalCost     = etd + etcWeeks
  const finalProfit   = contract - totalCost
  const finalMargin   = contract > 0 ? (finalProfit / contract) * 100 : 0
  const h             = health(finalMargin, target)

  // Temporal progress
  const startMon    = startDate ? weekMonday(new Date(startDate + 'T12:00:00')) : null
  const endMon      = endDate   ? weekMonday(new Date(endDate   + 'T12:00:00')) : null
  const totalWeeks  = (startMon && endMon) ? Math.max(1, Math.round((endMon - startMon) / (7 * 24 * 60 * 60 * 1000))) : 0
  const elapsed     = startMon ? Math.max(0, Math.round((weekMonday() - startMon) / (7 * 24 * 60 * 60 * 1000))) : 0
  const timePct     = totalWeeks > 0 ? Math.min(100, elapsed / totalWeeks * 100) : 0
  const remaining   = endMon ? Math.max(0, Math.round((endMon - weekMonday()) / (7 * 24 * 60 * 60 * 1000))) : 0

  // Weekly ETD for chart
  const chartWeeks = useMemo(() => {
    const s = new Set([today])
    Object.keys(actual).forEach(k => s.add(k.slice(-10)))
    const sorted = [...s].sort()
    const result = []
    let cur3 = weekMonday(new Date(sorted[0] + 'T12:00:00'))
    const end3 = weekMonday(new Date(today + 'T12:00:00'))
    while (isoDate(cur3) <= isoDate(end3)) {
      result.push(isoDate(cur3))
      cur3 = new Date(cur3); cur3.setDate(cur3.getDate() + 7)
    }
    return result
  }, [actual, today])

  function etdAt(weekStr) {
    return etdBase + resources.reduce((sum, r) =>
      sum + Object.keys(actual)
        .filter(k => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= weekStr)
        .reduce((s, k) => s + (actual[k] || 0) * r.hourly_rate, 0)
    , 0)
  }

  if (loading) return <div style={{ height: 300, borderRadius: 16, backgroundColor: '#111' }} />

  // ── KPI card ──────────────────────────────────────────────────────────────
  const Kpi = ({ label, value, sub, subColor = '#6e6e73', valueColor = '#f5f5f7', size = 'md' }) => (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: size === 'lg' ? 28 : 20, fontWeight: 700, color: valueColor, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor }}>{sub}</div>}
    </div>
  )

  const divider = <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ══ FINANCIAL HEALTH CARD ═══════════════════════════════════════════ */}
      <div style={{ backgroundColor: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Finanzas del proyecto</span>
            {contract > 0 && (
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
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { k: 'contract_value',   l: 'Contrato (ingresos)',      ph: '0'  },
              { k: 'invoiced_to_date', l: 'Facturado hasta hoy',      ph: '0'  },
              { k: 'effort_to_date',   l: 'ETD base histórica',       ph: '0'  },
              { k: 'target_margin',    l: 'Margen objetivo (%)',       ph: '20' },
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

        {/* Main KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', padding: '20px 24px', gap: 0 }}>
          {/* TODAY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Situación actual</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
              <Kpi label="Coste acumulado (ETD)" value={fmt(etd, cur)} sub={contract > 0 ? `${((etd/contract)*100).toFixed(0)}% del contrato` : undefined} valueColor="#64d2ff" />
              <Kpi label="Facturado" value={fmt(billed, cur)} sub={contract > 0 ? `${((billed/contract)*100).toFixed(0)}% del contrato` : undefined} />
              <Kpi label="Beneficio actual" value={fmt(currentProfit, cur)} valueColor={currentProfit >= 0 ? '#30d158' : '#ff453a'} sub={billed > 0 ? `${currentMargin.toFixed(1)}% margen` : undefined} subColor={currentProfit >= 0 ? '#30d158' : '#ff453a'} />
              <Kpi label="Contrato" value={fmt(contract, cur)} sub="ingresos acordados" />
            </div>
          </div>

          {divider}

          {/* FORECAST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 24px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Previsión final</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
              <Kpi label="ETC estimado" value={etcWeeks > 0 ? fmt(etcWeeks, cur) : '—'} sub="coste restante" valueColor="#ff9f0a" />
              <Kpi label="Coste total estimado" value={totalCost > 0 ? fmt(totalCost, cur) : '—'} sub={contract > 0 ? `${((totalCost/contract)*100).toFixed(0)}% del contrato` : undefined} valueColor="#f5f5f7" />
              <Kpi label="Beneficio final est." value={contract > 0 ? fmt(finalProfit, cur) : '—'} valueColor={finalProfit >= 0 ? '#30d158' : '#ff453a'} size="lg" />
              <Kpi label="Margen final est." value={contract > 0 ? `${finalMargin.toFixed(1)}%` : '—'} valueColor={h.color} sub={`objetivo ${target}%`} subColor={finalMargin >= target ? '#30d158' : '#ff453a'} size="lg" />
            </div>
          </div>

          {divider}

          {/* PROGRESS BARS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 0 24px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Distribución del presupuesto</div>
            <Bar label="Tiempo transcurrido" sublabel={totalWeeks > 0 ? `${elapsed}/${totalWeeks} sem` : '—'} value={timePct} max={100} color={timePct > 80 ? '#ff453a' : '#ff9f0a'} />
            <Bar label="Coste acumulado (ETD)" sublabel={`${fmt(etd, cur)} / ${fmt(contract, cur)}`} value={etd} max={contract || etd || 1} color="#64d2ff" />
            <Bar label="Facturado" sublabel={`${fmt(billed, cur)} / ${fmt(contract, cur)}`} value={billed} max={contract || billed || 1} color="#30d158" />
            <Bar label={`Margen acum. vs obj. ${target}%`} sublabel={billed > 0 ? `${currentMargin.toFixed(1)}%` : '—'} value={Math.max(0, currentMargin)} max={Math.max(target, currentMargin, 1)} color={currentMargin >= target ? '#30d158' : currentMargin >= target / 2 ? '#ff9f0a' : '#ff453a'} />
          </div>
        </div>

        {/* Evolution chart */}
        {chartWeeks.length >= 2 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 18px 12px' }}>
            <div style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Evolución del coste — <span style={{ color: '#64d2ff' }}>azul = ETD</span>
              {contract > 0 && <span style={{ color: 'rgba(255,255,255,0.15)' }}> · línea = contrato</span>}
            </div>
            <EvolutionChart weeks={chartWeeks} etdFn={etdAt} contract={contract} cur={cur} />
          </div>
        )}

        {/* Warning banners */}
        {contract > 0 && (() => {
          const warns = []
          if (totalCost > contract)                      warns.push({ c: '#ff453a', t: `El coste total estimado (${fmt(totalCost, cur)}) supera el contrato (${fmt(contract, cur)}).` })
          else if (finalMargin < target / 2)             warns.push({ c: '#ff453a', t: `Margen final estimado ${finalMargin.toFixed(1)}% — muy por debajo del objetivo ${target}%.` })
          else if (finalMargin < target)                 warns.push({ c: '#ff9f0a', t: `Margen final estimado ${finalMargin.toFixed(1)}% — por debajo del objetivo ${target}%. Revisa las estimaciones.` })
          if (etcWeeks === 0 && endDate)                 warns.push({ c: '#ff9f0a', t: 'Sin horas planificadas para semanas futuras. ETC = 0 puede dar margen irreal.' })
          return warns.map((w, i) => (
            <div key={i} style={{ margin: '0 18px', marginBottom: 12, padding: '8px 12px', borderRadius: 10, backgroundColor: w.c + '15', border: `1px solid ${w.c}30` }}>
              <span style={{ fontSize: 11, color: w.c }}>{w.t}</span>
            </div>
          ))
        })()}
      </div>

      {/* ══ RESOURCE TABLE ══════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Recursos &amp; dedicación</span>
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
            <col style={{ width: '22%' }} /><col style={{ width: '18%' }} /><col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ ...TH, textAlign: 'left' }}>Nombre</th>
              <th style={{ ...TH, textAlign: 'left' }}>Rol</th>
              <th style={{ ...TH, textAlign: 'right' }}>€/h</th>
              <th style={{ ...TH, textAlign: 'right' }}><span style={{ color: '#64d2ff' }}>Plan h</span></th>
              <th style={{ ...TH, textAlign: 'right' }}><span style={{ color: '#30d158' }}>Real h</span></th>
              <th style={{ ...TH, textAlign: 'right' }}>Δ Coste</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {resources.map(r => {
              const key    = `${r.id}_${weekIso}`
              const planH  = key in plannedBuf ? parseFloat(plannedBuf[key]) || 0 : (planned[key] || 0)
              const realH  = key in actualBuf  ? parseFloat(actualBuf[key])  || 0 : (actual[key]  || 0)
              const delta  = (realH - planH) * r.hourly_rate
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
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}><input style={INPUT_S} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus /></td>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}><input style={INPUT_S} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" /></td>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}><input style={{ ...INPUT_S, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="0" /></td>
                  <td colSpan={3} />
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                      <button onClick={saveResource} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', border: 'none', cursor: 'pointer', color: '#000' }}><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              )

              return (
                <tr key={r.id} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} style={{ transition: 'background-color 0.1s' }}>
                  <td style={CELL}><span style={{ fontWeight: 500 }}>{r.name}</span></td>
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
                  <td style={{ ...CELL, textAlign: 'right', color: (planH > 0 || realH > 0) ? (delta > 0 ? '#ff9f0a' : delta < 0 ? '#30d158' : '#6e6e73') : '#3a3a3a', fontSize: 11 }}>
                    {(planH > 0 || realH > 0) ? `${delta >= 0 ? '+' : ''}${fmt(delta, cur)}` : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditingId(r.id); setResForm({ name: r.name, role: r.role || '', hourly_rate: r.hourly_rate }) }}
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

            {editingId === 'new' && (
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}><input style={INPUT_S} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus /></td>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}><input style={INPUT_S} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" /></td>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}><input style={{ ...INPUT_S, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="€/h" /></td>
                <td colSpan={3} />
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
          <div style={{ padding: '10px 18px', borderTop: resources.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <button onClick={() => { setEditingId('new'); setResForm({ name: '', role: '', hourly_rate: '' }) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><Plus size={13} /> Añadir recurso</button>
          </div>
        )}
        {resources.length === 0 && editingId !== 'new' && (
          <div style={{ padding: '24px 18px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#3a3a3a' }}>Sin recursos añadidos todavía</p>
          </div>
        )}
      </div>
    </div>
  )
}
