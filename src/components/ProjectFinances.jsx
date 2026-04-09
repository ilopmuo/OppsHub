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
function shortDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtFull(n, cur = '€') {
  const abs = Math.abs(n)
  return `${n < 0 ? '-' : ''}${cur}${abs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtK(n, cur = '€') {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}${cur}${(abs / 1000).toFixed(1)}k`
  return `${sign}${cur}${abs.toFixed(0)}`
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CELL = { fontSize: 12, color: '#f5f5f7', padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
const TH   = { fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '9px 10px', whiteSpace: 'nowrap' }
const INPUT_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#f5f5f7',
  outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}
function InlineNum({ value, onChange, onBlur, color = '#f5f5f7', accent = 'rgba(255,255,255,0.15)', bg = 'rgba(255,255,255,0.06)' }) {
  return (
    <input
      type="number" min="0" step="0.5"
      value={value || ''}
      placeholder="—"
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      style={{
        width: 54, textAlign: 'right', fontSize: 12, fontFamily: 'inherit',
        backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: 5,
        padding: '2px 5px', color, outline: 'none', transition: 'all 0.15s',
      }}
      onFocus={e => { e.target.style.borderColor = accent; e.target.style.backgroundColor = bg }}
      onBlurCapture={e => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent' }}
    />
  )
}

export default function ProjectFinances({ projectId, endDate }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [resources,      setResources]      = useState([])
  // planned[`${rid}_${weekIso}`] = estimated hours
  // actual[`${rid}_${weekIso}`]  = actual hours
  const [planned,        setPlanned]        = useState({})
  const [actual,         setActual]         = useState({})
  // weeklyBilling[weekIso] = cumulative billed
  const [weeklyBilling,  setWeeklyBilling]  = useState({})
  const [financials,     setFinancials]     = useState({ currency: '€', contract_value: 0, effort_to_date: null })
  const [week,           setWeek]           = useState(() => weekMonday())
  const [loading,        setLoading]        = useState(true)
  const [editingId,      setEditingId]      = useState(null)
  const [resForm,        setResForm]        = useState({ name: '', role: '', hourly_rate: '' })
  const [editFin,        setEditFin]        = useState(false)
  const [finForm,        setFinForm]        = useState({})
  // local edit buffers (before blur-save)
  const [plannedBuf,     setPlannedBuf]     = useState({})
  const [actualBuf,      setActualBuf]      = useState({})
  // single billed cell being edited: { week: string, value: string } | null
  const [billedEdit,     setBilledEdit]     = useState(null)

  const weekIso = isoDate(week)
  const today   = isoDate(weekMonday())

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: resIds } = await supabase.from('project_resources').select('id').eq('project_id', projectId)
    const ids = resIds?.map(r => r.id) || []

    const [{ data: res }, { data: alloc }, { data: fin }, { data: wb }] = await Promise.all([
      supabase.from('project_resources').select('*').eq('project_id', projectId).order('created_at'),
      ids.length > 0
        ? supabase.from('resource_allocations').select('resource_id, week_start, hours, actual_hours').in('resource_id', ids)
        : { data: [] },
      supabase.from('project_financials').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_weekly_financials').select('week_start, billed_cumulative').eq('project_id', projectId),
    ])

    setResources(res || [])

    const pMap = {}, aMap = {}
    for (const a of alloc || []) {
      if (a.hours)       pMap[`${a.resource_id}_${a.week_start}`] = a.hours
      if (a.actual_hours) aMap[`${a.resource_id}_${a.week_start}`] = a.actual_hours
    }
    setPlanned(pMap)
    setActual(aMap)

    if (fin) setFinancials(fin)

    const bMap = {}
    for (const w of wb || []) bMap[w.week_start] = w.billed_cumulative
    setWeeklyBilling(bMap)

    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Save helpers ──────────────────────────────────────────────────────────
  async function savePlanned(resourceId, weekStr, val) {
    const hours = parseFloat(val) || 0
    const key = `${resourceId}_${weekStr}`
    setPlanned(p => ({ ...p, [key]: hours }))
    setPlannedBuf(p => { const n = { ...p }; delete n[key]; return n })
    const existingActual = actual[key] || 0
    if (hours === 0 && existingActual === 0) {
      await supabase.from('resource_allocations').delete().eq('resource_id', resourceId).eq('week_start', weekStr)
    } else {
      await supabase.from('resource_allocations').upsert(
        { resource_id: resourceId, week_start: weekStr, hours, actual_hours: existingActual },
        { onConflict: 'resource_id,week_start' }
      )
    }
  }

  async function saveActual(resourceId, weekStr, val) {
    const actual_hours = parseFloat(val) || 0
    const key = `${resourceId}_${weekStr}`
    setActual(p => ({ ...p, [key]: actual_hours }))
    setActualBuf(p => { const n = { ...p }; delete n[key]; return n })
    const existingPlanned = planned[key] || 0
    if (actual_hours === 0 && existingPlanned === 0) {
      await supabase.from('resource_allocations').delete().eq('resource_id', resourceId).eq('week_start', weekStr)
    } else {
      await supabase.from('resource_allocations').upsert(
        { resource_id: resourceId, week_start: weekStr, hours: existingPlanned, actual_hours },
        { onConflict: 'resource_id,week_start' }
      )
    }
  }

  async function saveBilled(weekStr, val) {
    const billed = parseFloat(val) || 0
    setWeeklyBilling(p => ({ ...p, [weekStr]: billed }))
    setBilledEdit(null)
    await supabase.from('project_weekly_financials').upsert(
      { project_id: projectId, week_start: weekStr, billed_cumulative: billed },
      { onConflict: 'project_id,week_start' }
    )
  }

  async function saveFinancials() {
    const payload = {
      project_id: projectId,
      currency: finForm.currency || '€',
      contract_value: parseFloat(finForm.contract_value) || 0,
      effort_to_date: finForm.effort_to_date !== '' && finForm.effort_to_date != null
        ? parseFloat(finForm.effort_to_date) : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('project_financials').upsert(payload, { onConflict: 'project_id' })
    if (error) { toast.error('Error al guardar'); return }
    setFinancials(payload)
    setEditFin(false)
    toast.success('Guardado')
  }

  // ── Resource CRUD ─────────────────────────────────────────────────────────
  async function saveResource() {
    if (!resForm.name.trim()) { toast.error('Añade un nombre'); return }
    const rate = parseFloat(resForm.hourly_rate) || 0
    if (editingId === 'new') {
      const { data, error } = await supabase.from('project_resources')
        .insert({ project_id: projectId, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate })
        .select().single()
      if (error) { toast.error('Error al añadir'); return }
      setResources(p => [...p, data])
    } else {
      await supabase.from('project_resources').update({ name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate }).eq('id', editingId)
      setResources(p => p.map(r => r.id === editingId ? { ...r, ...resForm, hourly_rate: rate } : r))
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
  }

  // ── Computed: all weeks to show in KPI table ──────────────────────────────
  const currency = financials.currency || '€'
  const etdBase  = financials.effort_to_date != null ? Number(financials.effort_to_date) : 0
  const tPresupuesto = financials.contract_value || 0

  const allWeeks = useMemo(() => {
    // Only allocations (plan/actual) determine which weeks appear — never weeklyBilling
    const s = new Set([today])
    Object.keys(planned).forEach(k => s.add(k.slice(-10)))
    Object.keys(actual).forEach(k => s.add(k.slice(-10)))
    const sorted = [...s].sort()
    // Fill contiguous weeks from earliest entry to today
    const result = []
    let cur = weekMonday(new Date(sorted[0] + 'T12:00:00'))
    const end = weekMonday(new Date(today + 'T12:00:00'))
    while (isoDate(cur) <= isoDate(end)) {
      result.push(isoDate(cur))
      cur = new Date(cur); cur.setDate(cur.getDate() + 7)
    }
    return result
  }, [planned, actual, today])

  // For a given weekStr: ETD = etdBase + cumulative ACTUAL costs up to that week
  function etdAt(weekStr) {
    return etdBase + resources.reduce((sum, r) => {
      return sum + Object.keys(actual)
        .filter(k => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= weekStr)
        .reduce((s, k) => s + (actual[k] || 0) * r.hourly_rate, 0)
    }, 0)
  }

  // For a given weekStr: ETC = sum of PLANNED costs for all weeks AFTER weekStr until endDate
  function etcAt(weekStr) {
    if (!endDate) return 0
    const endIso = isoDate(weekMonday(new Date(endDate + 'T12:00:00')))
    let total = 0
    let cur = new Date(weekStr + 'T12:00:00')
    cur.setDate(cur.getDate() + 7)
    while (isoDate(cur) <= endIso) {
      const wIso = isoDate(cur)
      for (const r of resources) {
        total += (planned[`${r.id}_${wIso}`] || 0) * r.hourly_rate
      }
      cur = new Date(cur); cur.setDate(cur.getDate() + 7)
    }
    return total
  }

  // ── Remaining weeks for header ────────────────────────────────────────────
  const endMon = endDate ? weekMonday(new Date(endDate + 'T12:00:00')) : null
  const remainingWeeks = endMon ? Math.max(0, Math.round((endMon - weekMonday()) / (7 * 24 * 60 * 60 * 1000))) : 0

  if (loading) return <div style={{ height: 300, borderRadius: 16, backgroundColor: '#111' }} />

  const cardStyle = { backgroundColor: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 0 }
  const sectionHeader = (title, right) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>{title}</span>
      {right}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ══ 1. KPI TABLE ══════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        {sectionHeader(
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Finanzas
            {remainingWeeks > 0 && <span style={{ fontSize: 10, color: '#3a3a3a', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 7px' }}>{remainingWeeks} sem. restantes</span>}
            {endDate && remainingWeeks === 0 && <span style={{ fontSize: 10, color: '#ff453a', background: 'rgba(255,69,58,0.08)', borderRadius: 6, padding: '2px 7px' }}>Finalizado</span>}
          </span>,
          !editFin
            ? <button onClick={() => { setFinForm({ ...financials, effort_to_date: financials.effort_to_date ?? '' }); setEditFin(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'} onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
              ><Pencil size={11} /> Editar</button>
            : <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditFin(false)} style={{ fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button onClick={saveFinancials} style={{ fontSize: 11, fontWeight: 600, color: '#000', background: '#f5f5f7', border: 'none', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
              </div>
        )}

        {editFin && (
          <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>T. Presupuesto (contrato)</label>
              <input style={INPUT_STYLE} type="number" min="0" step="100" value={finForm.contract_value ?? ''} onChange={e => setFinForm(p => ({ ...p, contract_value: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>ETD base histórica <span style={{ color: '#3a3a3a', fontWeight: 400 }}>(costes antes de registrar)</span></label>
              <input style={INPUT_STYLE} type="number" min="0" step="100"
                value={finForm.effort_to_date ?? ''}
                onChange={e => setFinForm(p => ({ ...p, effort_to_date: e.target.value === '' ? null : e.target.value }))}
                placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>Moneda</label>
              <select style={INPUT_STYLE} value={finForm.currency || '€'} onChange={e => setFinForm(p => ({ ...p, currency: e.target.value }))}>
                <option>€</option><option>$</option><option>£</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                {['Semana', 'T. Presupuesto', 'Billed ✎', 'Effort to date', 'B-E to date', '% Progress', 'ETC Effort', 'ETC Billing', 'Total Effort', 'Total Bill', 'Result ETC', '% OFF'].map((h, i) => (
                  <th key={h} style={{ ...TH, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allWeeks.map(weekStr => {
                const etd       = etdAt(weekStr)
                const etc       = etcAt(weekStr)
                const isEditing = billedEdit?.week === weekStr
                const billed    = isEditing
                  ? parseFloat(billedEdit.value) || 0
                  : (weeklyBilling[weekStr] || 0)
                const isCur  = weekStr === today

                const beToDate    = billed - etd
                const etcBilling  = tPresupuesto - billed
                const totalEffort = etd + etc
                const resultEtc   = tPresupuesto - totalEffort
                const pctProgress = totalEffort > 0 ? etd / totalEffort * 100 : 0
                const pctOff      = tPresupuesto > 0 ? resultEtc / tPresupuesto * 100 : 0

                const pos = c => c >= 0 ? '#30d158' : '#ff453a'

                return (
                  <tr key={weekStr}
                    style={{ backgroundColor: isCur ? 'rgba(255,255,255,0.025)' : 'transparent' }}
                    onMouseEnter={e => { if (!isCur) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)' }}
                    onMouseLeave={e => { if (!isCur) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <td style={{ ...CELL, color: isCur ? '#f5f5f7' : '#6e6e73', fontWeight: isCur ? 600 : 400 }}>
                      {isCur ? '● ' : ''}{shortDate(weekStr)}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', fontWeight: 600 }}>
                      {tPresupuesto > 0 ? fmtFull(tPresupuesto, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* Billed — editable inline */}
                    <td style={{ ...CELL, textAlign: 'right' }}>
                      <input
                        type="number" min="0" step="100"
                        value={isEditing ? billedEdit.value : (weeklyBilling[weekStr] || '')}
                        placeholder="—"
                        onChange={e => setBilledEdit({ week: weekStr, value: e.target.value })}
                        onFocus={e => {
                          setBilledEdit({ week: weekStr, value: String(weeklyBilling[weekStr] || '') })
                          e.target.style.borderColor = 'rgba(255,255,255,0.2)'
                          e.target.style.backgroundColor = 'rgba(255,255,255,0.07)'
                        }}
                        onBlur={async e => {
                          e.target.style.borderColor = 'transparent'
                          e.target.style.backgroundColor = 'transparent'
                          await saveBilled(weekStr, billedEdit?.value ?? weeklyBilling[weekStr] ?? 0)
                        }}
                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        style={{ width: 80, textAlign: 'right', fontSize: 12, fontFamily: 'inherit', backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: 5, padding: '2px 5px', color: weeklyBilling[weekStr] > 0 ? '#f5f5f7' : '#3a3a3a', outline: 'none', transition: 'all 0.15s' }}
                      />
                    </td>
                    <td style={{ ...CELL, textAlign: 'right' }}>
                      {etd > 0 ? fmtFull(etd, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', color: billed > 0 ? pos(beToDate) : '#3a3a3a', fontWeight: 600 }}>
                      {billed > 0 ? `${beToDate >= 0 ? '+' : ''}${fmtFull(beToDate, currency)}` : '—'}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right' }}>
                      {totalEffort > 0 ? `${pctProgress.toFixed(2)}%` : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', color: '#6e6e73' }}>
                      {etc > 0 ? fmtFull(etc, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', color: '#6e6e73' }}>
                      {billed > 0 ? fmtFull(etcBilling, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', fontWeight: 600 }}>
                      {totalEffort > 0 ? fmtFull(totalEffort, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', fontWeight: 600 }}>
                      {tPresupuesto > 0 ? fmtFull(tPresupuesto, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', color: totalEffort > 0 ? pos(resultEtc) : '#3a3a3a', fontWeight: 700 }}>
                      {totalEffort > 0 ? `${resultEtc >= 0 ? '+' : ''}${fmtFull(resultEtc, currency)}` : '—'}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', color: totalEffort > 0 ? pos(pctOff) : '#3a3a3a', fontWeight: 700 }}>
                      {totalEffort > 0 ? `${pctOff.toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ 2. RESOURCE TRACKING TABLE ════════════════════════════════════════ */}
      <div style={cardStyle}>
        {sectionHeader(
          'Recursos — Plan vs Real',
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
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '22%' }} /><col style={{ width: '18%' }} /><col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} /><col style={{ width: '13%' }} /><col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ ...TH, textAlign: 'left' }}>Nombre</th>
              <th style={{ ...TH, textAlign: 'left' }}>Rol</th>
              <th style={{ ...TH, textAlign: 'right' }}>€/h</th>
              <th style={{ ...TH, textAlign: 'right' }}>
                <span style={{ color: '#64d2ff' }}>Plan h</span>
              </th>
              <th style={{ ...TH, textAlign: 'right' }}>
                <span style={{ color: '#30d158' }}>Real h</span>
              </th>
              <th style={{ ...TH, textAlign: 'right' }}>Δ Coste</th>
              <th style={{ ...TH, textAlign: 'right' }} />
            </tr>
          </thead>
          <tbody>
            {resources.map(r => {
              const planKey  = `${r.id}_${weekIso}`
              const planH    = planKey in plannedBuf ? parseFloat(plannedBuf[planKey]) || 0 : (planned[planKey] || 0)
              const realH    = planKey in actualBuf  ? parseFloat(actualBuf[planKey])  || 0 : (actual[planKey]  || 0)
              const planCost = planH * r.hourly_rate
              const realCost = realH * r.hourly_rate
              const delta    = realCost - planCost
              const isEditing = editingId === r.id

              if (isEditing) return (
                <tr key={r.id} style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <input style={INPUT_STYLE} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus />
                  </td>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <input style={INPUT_STYLE} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" />
                  </td>
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <input style={{ ...INPUT_STYLE, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="0" />
                  </td>
                  <td colSpan={3} />
                  <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
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
                  <td style={CELL}><span style={{ fontWeight: 500 }}>{r.name}</span></td>
                  <td style={{ ...CELL, color: '#6e6e73' }}>{r.role || <span style={{ color: '#3a3a3a' }}>—</span>}</td>
                  <td style={{ ...CELL, textAlign: 'right', color: '#6e6e73' }}>{r.hourly_rate}{currency}</td>
                  {/* Plan hours */}
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    <InlineNum
                      value={planKey in plannedBuf ? plannedBuf[planKey] : (planned[planKey] || '')}
                      color={planned[planKey] > 0 ? '#64d2ff' : '#3a3a3a'}
                      accent="rgba(100,210,255,0.25)" bg="rgba(100,210,255,0.06)"
                      onChange={v => setPlannedBuf(p => ({ ...p, [planKey]: v }))}
                      onBlur={() => savePlanned(r.id, weekIso, plannedBuf[planKey] ?? planned[planKey] ?? 0)}
                    />
                    <span style={{ fontSize: 10, color: '#3a3a3a' }}>h</span>
                  </td>
                  {/* Actual hours */}
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    <InlineNum
                      value={planKey in actualBuf ? actualBuf[planKey] : (actual[planKey] || '')}
                      color={actual[planKey] > 0 ? '#30d158' : '#3a3a3a'}
                      accent="rgba(48,209,88,0.25)" bg="rgba(48,209,88,0.06)"
                      onChange={v => setActualBuf(p => ({ ...p, [planKey]: v }))}
                      onBlur={() => saveActual(r.id, weekIso, actualBuf[planKey] ?? actual[planKey] ?? 0)}
                    />
                    <span style={{ fontSize: 10, color: '#3a3a3a' }}>h</span>
                  </td>
                  {/* Δ cost */}
                  <td style={{ ...CELL, textAlign: 'right', fontSize: 11, color: planH > 0 || realH > 0 ? (delta >= 0 ? '#ff9f0a' : '#30d158') : '#3a3a3a' }}>
                    {(planH > 0 || realH > 0) ? `${delta >= 0 ? '+' : ''}${fmtK(delta, currency)}` : '—'}
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
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <input style={INPUT_STYLE} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus />
                </td>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <input style={INPUT_STYLE} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" />
                </td>
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <input style={{ ...INPUT_STYLE, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="€/h" />
                </td>
                <td colSpan={3} />
                <td style={{ ...CELL, paddingTop: 7, paddingBottom: 7 }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={saveResource} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', border: 'none', cursor: 'pointer', color: '#000' }}><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}><X size={12} /></button>
                  </div>
                </td>
              </tr>
            )}

            {/* Totals */}
            {resources.length > 0 && (() => {
              const totalPlan = resources.reduce((s, r) => s + (planned[`${r.id}_${weekIso}`] || 0) * r.hourly_rate, 0)
              const totalReal = resources.reduce((s, r) => s + (actual[`${r.id}_${weekIso}`] || 0) * r.hourly_rate, 0)
              const totalDelta = totalReal - totalPlan
              return (
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                  <td style={{ ...CELL, color: '#4a4a4a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: 'none' }}>Total sem.</td>
                  <td style={{ ...CELL, borderBottom: 'none' }} colSpan={2} />
                  <td style={{ ...CELL, textAlign: 'right', color: '#64d2ff', fontWeight: 600, borderBottom: 'none', fontSize: 11 }}>
                    {totalPlan > 0 ? fmtK(totalPlan, currency) : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', color: '#30d158', fontWeight: 600, borderBottom: 'none', fontSize: 11 }}>
                    {totalReal > 0 ? fmtK(totalReal, currency) : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', fontSize: 11, color: (totalPlan > 0 || totalReal > 0) ? (totalDelta >= 0 ? '#ff9f0a' : '#30d158') : '#3a3a3a', fontWeight: 600, borderBottom: 'none' }}>
                    {(totalPlan > 0 || totalReal > 0) ? `${totalDelta >= 0 ? '+' : ''}${fmtK(totalDelta, currency)}` : '—'}
                  </td>
                  <td style={{ ...CELL, borderBottom: 'none' }} />
                </tr>
              )
            })()}
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
