import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Week helpers ──────────────────────────────────────────────────────────────
function weekMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}
function weekLabel(monday) {
  const sun = new Date(monday); sun.setDate(sun.getDate() + 6)
  const f = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${f(monday)} – ${f(sun)}`
}
function isoDate(d) { return d.toISOString().slice(0, 10) }
function shortDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const CELL = { fontSize: 12, color: '#f5f5f7', padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
const TH   = { fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 12px', textAlign: 'left' }
const INPUT = {
  backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#f5f5f7',
  outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}
const INLINE_INPUT = {
  width: 72, textAlign: 'right', backgroundColor: 'transparent',
  border: '1px solid transparent', borderRadius: 6,
  padding: '3px 5px', fontSize: 12, outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s, background-color 0.15s',
}
function fmt(n, cur = '€') {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M${cur}`
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}k${cur}`
  return `${Number(n).toFixed(0)}${cur}`
}
function fmtFull(n, cur = '€') {
  return `${cur}${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ProjectFinances({ projectId, endDate }) {
  const [resources,      setResources]      = useState([])
  const [allocations,    setAllocations]    = useState({})
  const [financials,     setFinancials]     = useState({ currency: '€', contract_value: 0, effort_to_date: null })
  const [weeklyBilling,  setWeeklyBilling]  = useState([])  // [{week_start, billed_cumulative}]
  const [billedEdits,    setBilledEdits]    = useState({})  // {weekIso: string}
  const [week,           setWeek]           = useState(() => weekMonday())
  const [loading,        setLoading]        = useState(true)
  const [editFinancials, setEditFinancials] = useState(false)
  const [finForm,        setFinForm]        = useState({})
  const [editingId,      setEditingId]      = useState(null)
  const [resForm,        setResForm]        = useState({ name: '', role: '', hourly_rate: '', planned_weekly_hours: '' })

  const weekIso = isoDate(week)
  const today   = isoDate(weekMonday())

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const resIds = (await supabase.from('project_resources').select('id').eq('project_id', projectId)).data?.map(r => r.id) || []
    const [{ data: res }, { data: alloc }, { data: fin }, { data: wb }] = await Promise.all([
      supabase.from('project_resources').select('*').eq('project_id', projectId).order('created_at'),
      resIds.length > 0
        ? supabase.from('resource_allocations').select('resource_id, week_start, hours').in('resource_id', resIds)
        : { data: [] },
      supabase.from('project_financials').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_weekly_financials').select('week_start, billed_cumulative').eq('project_id', projectId).order('week_start'),
    ])
    setResources(res || [])
    const map = {}
    for (const a of alloc || []) map[`${a.resource_id}_${a.week_start}`] = a.hours
    setAllocations(map)
    if (fin) setFinancials(fin)
    setWeeklyBilling(wb || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── All weeks to display in the financial table ───────────────────────────
  const allWeeks = useMemo(() => {
    const s = new Set()
    Object.keys(allocations).forEach(k => s.add(k.slice(-10)))
    weeklyBilling.forEach(wb => s.add(wb.week_start))
    s.add(today)
    const sorted = [...s].sort()
    if (sorted.length === 0) return [today]
    // Fill all weeks from first to today
    const result = []
    let cur = weekMonday(new Date(sorted[0] + 'T12:00:00'))
    const end = weekMonday(new Date(today + 'T12:00:00'))
    while (isoDate(cur) <= isoDate(end)) {
      result.push(isoDate(cur))
      cur = new Date(cur); cur.setDate(cur.getDate() + 7)
    }
    return result
  }, [allocations, weeklyBilling, today])

  // ── Helpers: per-week calculations ────────────────────────────────────────
  const etdBase = financials.effort_to_date != null ? Number(financials.effort_to_date) : 0
  const currency = financials.currency || '€'

  function etdForWeek(weekStr) {
    return etdBase + resources.reduce((sum, r) => {
      return sum + Object.entries(allocations)
        .filter(([k]) => k.startsWith(r.id + '_') && k.slice(r.id.length + 1) <= weekStr)
        .reduce((s, [, h]) => s + h * r.hourly_rate, 0)
    }, 0)
  }

  function etcForWeek(weekStr) {
    const wMon = weekMonday(new Date(weekStr + 'T12:00:00'))
    const eMon = endDate ? weekMonday(new Date(endDate + 'T12:00:00')) : null
    const rem  = eMon ? Math.max(0, Math.round((eMon - wMon) / (7 * 24 * 60 * 60 * 1000))) : 0
    return resources.reduce((sum, r) => sum + (r.planned_weekly_hours || 0) * r.hourly_rate * rem, 0)
  }

  function billedForWeek(weekStr) {
    return weeklyBilling.find(wb => wb.week_start === weekStr)?.billed_cumulative || 0
  }

  // ── Save billed for a week ─────────────────────────────────────────────────
  async function saveBilled(weekStr) {
    const raw = billedEdits[weekStr]
    if (raw === undefined) return
    const val = parseFloat(raw) || 0
    setBilledEdits(p => { const n = { ...p }; delete n[weekStr]; return n })
    setWeeklyBilling(prev => {
      const exists = prev.find(wb => wb.week_start === weekStr)
      if (exists) return prev.map(wb => wb.week_start === weekStr ? { ...wb, billed_cumulative: val } : wb)
      return [...prev, { week_start: weekStr, billed_cumulative: val }].sort((a, b) => a.week_start.localeCompare(b.week_start))
    })
    await supabase.from('project_weekly_financials')
      .upsert({ project_id: projectId, week_start: weekStr, billed_cumulative: val }, { onConflict: 'project_id,week_start' })
  }

  // ── Allocation update ──────────────────────────────────────────────────────
  async function setHours(resourceId, hours) {
    const key = `${resourceId}_${weekIso}`
    const val = parseFloat(hours) || 0
    setAllocations(p => ({ ...p, [key]: val }))
    if (val === 0) {
      await supabase.from('resource_allocations').delete().eq('resource_id', resourceId).eq('week_start', weekIso)
    } else {
      await supabase.from('resource_allocations')
        .upsert({ resource_id: resourceId, week_start: weekIso, hours: val }, { onConflict: 'resource_id,week_start' })
    }
  }

  async function setPlannedHours(resourceId, hours) {
    const val = parseFloat(hours) || 0
    setResources(p => p.map(r => r.id === resourceId ? { ...r, planned_weekly_hours: val } : r))
    await supabase.from('project_resources').update({ planned_weekly_hours: val }).eq('id', resourceId)
  }

  // ── Financial save ─────────────────────────────────────────────────────────
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
    setEditFinancials(false)
    toast.success('Datos financieros guardados')
  }

  // ── Resource CRUD ──────────────────────────────────────────────────────────
  async function saveResource() {
    if (!resForm.name.trim()) { toast.error('Añade un nombre'); return }
    const rate    = parseFloat(resForm.hourly_rate) || 0
    const planned = parseFloat(resForm.planned_weekly_hours) || 0
    if (editingId === 'new') {
      const { data, error } = await supabase.from('project_resources')
        .insert({ project_id: projectId, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate, planned_weekly_hours: planned })
        .select().single()
      if (error) { toast.error('Error al añadir'); return }
      setResources(p => [...p, data])
    } else {
      const { error } = await supabase.from('project_resources')
        .update({ name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate, planned_weekly_hours: planned })
        .eq('id', editingId)
      if (error) { toast.error('Error al actualizar'); return }
      setResources(p => p.map(r => r.id === editingId
        ? { ...r, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate, planned_weekly_hours: planned }
        : r))
    }
    setEditingId(null)
    setResForm({ name: '', role: '', hourly_rate: '', planned_weekly_hours: '' })
  }

  async function deleteResource(r) {
    if (!confirm(`¿Eliminar a "${r.name}" del proyecto?`)) return
    await supabase.from('resource_allocations').delete().eq('resource_id', r.id)
    await supabase.from('project_resources').delete().eq('id', r.id)
    setResources(p => p.filter(x => x.id !== r.id))
    setAllocations(p => {
      const next = { ...p }
      Object.keys(next).filter(k => k.startsWith(r.id)).forEach(k => delete next[k])
      return next
    })
    toast.success('Recurso eliminado')
  }

  // ── Remaining weeks for header pill ───────────────────────────────────────
  const endMonday      = endDate ? weekMonday(new Date(endDate + 'T12:00:00')) : null
  const currentMonday  = weekMonday()
  const remainingWeeks = endMonday
    ? Math.max(0, Math.round((endMonday - currentMonday) / (7 * 24 * 60 * 60 * 1000)))
    : 0

  // ── This week resource totals ──────────────────────────────────────────────
  const weekHours = resources.reduce((s, r) => s + (allocations[`${r.id}_${weekIso}`] || 0), 0)
  const weekCost  = resources.reduce((s, r) => s + (allocations[`${r.id}_${weekIso}`] || 0) * r.hourly_rate, 0)

  const tPresupuesto = financials.contract_value || 0

  if (loading) return <div style={{ height: 300, borderRadius: 16, backgroundColor: '#111' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Financial table ───────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Finanzas</span>
            {remainingWeeks > 0 && (
              <span style={{ fontSize: 10, color: '#3a3a3a', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 7px' }}>
                {remainingWeeks} sem. restantes
              </span>
            )}
            {endDate && remainingWeeks === 0 && (
              <span style={{ fontSize: 10, color: '#ff453a', backgroundColor: 'rgba(255,69,58,0.08)', borderRadius: 6, padding: '2px 7px' }}>
                Proyecto finalizado
              </span>
            )}
          </div>
          {!editFinancials ? (
            <button
              onClick={() => { setFinForm({ ...financials, effort_to_date: financials.effort_to_date ?? '' }); setEditFinancials(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><Pencil size={11} /> Editar</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditFinancials(false)} style={{ fontSize: 11, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={saveFinancials} style={{ fontSize: 11, fontWeight: 600, color: '#000', background: '#f5f5f7', border: 'none', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
            </div>
          )}
        </div>

        {/* Edit form */}
        {editFinancials && (
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>T. Presupuesto</label>
              <input style={INPUT} type="number" min="0" step="100" value={finForm.contract_value ?? ''} onChange={e => setFinForm(p => ({ ...p, contract_value: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>ETD base histórica</label>
              <input style={INPUT} type="number" min="0" step="100"
                value={finForm.effort_to_date ?? ''}
                onChange={e => setFinForm(p => ({ ...p, effort_to_date: e.target.value === '' ? null : e.target.value }))}
                placeholder="0" />
              <p style={{ fontSize: 9, color: '#3a3a3a', marginTop: 3 }}>Costes anteriores al proyecto</p>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>Moneda</label>
              <select style={INPUT} value={finForm.currency || '€'} onChange={e => setFinForm(p => ({ ...p, currency: e.target.value }))}>
                <option>€</option><option>$</option><option>£</option>
              </select>
            </div>
          </div>
        )}

        {/* Multi-week data table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                {[
                  'Semana', 'T. Presupuesto', 'Billed', 'Effort to date',
                  'B-E to date', '% Progress', 'ETC Effort', 'ETC Billing',
                  'Total Effort', 'Total Bill', 'Result ETC', '% OFF',
                ].map((h, i) => (
                  <th key={h} style={{ ...TH, textAlign: i === 0 ? 'left' : 'right', paddingRight: i === 0 ? 12 : 16 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allWeeks.map(weekStr => {
                const etdW    = etdForWeek(weekStr)
                const etcW    = etcForWeek(weekStr)
                const billedW = billedForWeek(weekStr)
                const isEditingBilled = weekStr in billedEdits

                const beToDateW   = billedW - etdW
                const etcBillingW = tPresupuesto - billedW
                const totalEffortW = etdW + etcW
                const resultEtcW  = tPresupuesto - totalEffortW
                const pctProgressW = totalEffortW > 0 ? etdW / totalEffortW * 100 : 0
                const pctOffW     = tPresupuesto > 0 ? resultEtcW / tPresupuesto * 100 : 0
                const isCurrent   = weekStr === today

                return (
                  <tr key={weekStr}
                    style={{ backgroundColor: isCurrent ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                    onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.012)' }}
                    onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {/* Semana */}
                    <td style={{ ...CELL, color: isCurrent ? '#f5f5f7' : '#6e6e73', fontWeight: isCurrent ? 600 : 400 }}>
                      {isCurrent ? '● ' : ''}{shortDate(weekStr)}
                    </td>
                    {/* T. Presupuesto */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, fontWeight: 600 }}>
                      {tPresupuesto > 0 ? fmtFull(tPresupuesto, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* Billed — inline editable */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16 }}>
                      <input
                        type="number" min="0" step="100"
                        value={isEditingBilled ? billedEdits[weekStr] : (billedW || '')}
                        placeholder="—"
                        onChange={e => setBilledEdits(p => ({ ...p, [weekStr]: e.target.value }))}
                        onFocus={e => {
                          if (!isEditingBilled) setBilledEdits(p => ({ ...p, [weekStr]: billedW || '' }))
                          e.target.style.borderColor = 'rgba(255,255,255,0.15)'
                          e.target.style.backgroundColor = 'rgba(255,255,255,0.06)'
                        }}
                        onBlur={async e => {
                          e.target.style.borderColor = 'transparent'
                          e.target.style.backgroundColor = 'transparent'
                          await saveBilled(weekStr)
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                        style={{ ...INLINE_INPUT, color: billedW > 0 || isEditingBilled ? '#f5f5f7' : '#3a3a3a' }}
                      />
                    </td>
                    {/* Effort to date */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16 }}>
                      {etdW > 0 ? fmtFull(etdW, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* B-E to date */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, color: billedW > 0 ? (beToDateW >= 0 ? '#30d158' : '#ff453a') : '#3a3a3a', fontWeight: 600 }}>
                      {billedW > 0 ? `${beToDateW >= 0 ? '+' : ''}${fmtFull(beToDateW, currency)}` : '—'}
                    </td>
                    {/* % Progress */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, color: '#f5f5f7' }}>
                      {totalEffortW > 0 ? `${pctProgressW.toFixed(2)}%` : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* ETC Effort */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, color: '#6e6e73' }}>
                      {etcW > 0 ? fmtFull(etcW, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* ETC Billing */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, color: '#6e6e73' }}>
                      {billedW > 0 ? fmtFull(etcBillingW, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* Total Effort */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, fontWeight: 600 }}>
                      {totalEffortW > 0 ? fmtFull(totalEffortW, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* Total Bill */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, fontWeight: 600 }}>
                      {tPresupuesto > 0 ? fmtFull(tPresupuesto, currency) : <span style={{ color: '#3a3a3a' }}>—</span>}
                    </td>
                    {/* Result ETC */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, color: totalEffortW > 0 ? (resultEtcW >= 0 ? '#30d158' : '#ff453a') : '#3a3a3a', fontWeight: 700 }}>
                      {totalEffortW > 0 ? `${resultEtcW >= 0 ? '+' : ''}${fmtFull(resultEtcW, currency)}` : '—'}
                    </td>
                    {/* % OFF */}
                    <td style={{ ...CELL, textAlign: 'right', paddingRight: 16, color: totalEffortW > 0 ? (pctOffW >= 0 ? '#30d158' : '#ff453a') : '#3a3a3a', fontWeight: 700 }}>
                      {totalEffortW > 0 ? `${pctOffW.toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resource table ────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Equipo &amp; Dedicación</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setWeek(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d })}
              style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><ChevronLeft size={13} /></button>
            <span style={{ fontSize: 11, color: weekIso === today ? '#f5f5f7' : '#6e6e73', fontWeight: weekIso === today ? 600 : 400, minWidth: 130, textAlign: 'center' }}>
              {weekIso === today ? '● ' : ''}{weekLabel(week)}
            </span>
            <button
              onClick={() => setWeek(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d })}
              style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            ><ChevronRight size={13} /></button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              {['Nombre', 'Rol', '€/h', 'h/sem plan.', 'Horas esta sem.', 'Coste sem.', ''].map((h, i) => (
                <th key={i} style={{ ...TH, textAlign: i >= 2 && i < 6 ? 'right' : 'left', paddingRight: i >= 2 && i < 6 ? 18 : 14 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map(r => {
              const isEditing = editingId === r.id
              const h    = allocations[`${r.id}_${weekIso}`] || 0
              const cost = h * r.hourly_rate
              const plan = r.planned_weekly_hours || 0

              if (isEditing) {
                return (
                  <tr key={r.id} style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8 }}>
                      <input style={INPUT} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus />
                    </td>
                    <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8 }}>
                      <input style={INPUT} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" />
                    </td>
                    <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 18 }}>
                      <input style={{ ...INPUT, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="0" />
                    </td>
                    <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 18 }}>
                      <input style={{ ...INPUT, textAlign: 'right' }} type="number" min="0" max="80" step="0.5" value={resForm.planned_weekly_hours} onChange={e => setResForm(p => ({ ...p, planned_weekly_hours: e.target.value }))} placeholder="0" />
                    </td>
                    <td colSpan={2} />
                    <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 14 }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={saveResource} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', border: 'none', cursor: 'pointer', color: '#000' }}><Check size={12} /></button>
                        <button onClick={() => setEditingId(null)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}><X size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={r.id} style={{ transition: 'background-color 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={CELL}><span style={{ fontWeight: 500 }}>{r.name}</span></td>
                  <td style={{ ...CELL, color: '#6e6e73' }}>{r.role || <span style={{ color: '#3a3a3a' }}>—</span>}</td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18 }}>
                    <span style={{ color: '#6e6e73' }}>{r.hourly_rate}{currency}</span>
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18 }}>
                    <input type="number" min="0" max="80" step="0.5" value={plan || ''} onChange={e => setPlannedHours(r.id, e.target.value)} placeholder="—"
                      style={{ ...INLINE_INPUT, color: plan > 0 ? '#64d2ff' : '#3a3a3a' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(100,210,255,0.25)'; e.target.style.backgroundColor = 'rgba(100,210,255,0.06)' }}
                      onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent' }}
                    />
                    <span style={{ fontSize: 10, color: '#3a3a3a', marginLeft: 2 }}>h</span>
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18 }}>
                    <input type="number" min="0" max="80" step="0.5" value={h || ''} onChange={e => setHours(r.id, e.target.value)} placeholder="—"
                      style={{ ...INLINE_INPUT, color: h > 0 ? '#f5f5f7' : '#3a3a3a' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                      onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent' }}
                    />
                    <span style={{ fontSize: 10, color: '#3a3a3a', marginLeft: 2 }}>h</span>
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: cost > 0 ? '#f5f5f7' : '#3a3a3a', fontWeight: cost > 0 ? 600 : 400 }}>
                    {cost > 0 ? fmt(cost, currency) : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 14 }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setEditingId(r.id); setResForm({ name: r.name, role: r.role || '', hourly_rate: r.hourly_rate, planned_weekly_hours: r.planned_weekly_hours || '' }) }}
                        style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
                        onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
                      ><Pencil size={11} /></button>
                      <button
                        onClick={() => deleteResource(r)}
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
                <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8 }}>
                  <input style={INPUT} value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" autoFocus />
                </td>
                <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8 }}>
                  <input style={INPUT} value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} placeholder="Rol" />
                </td>
                <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 18 }}>
                  <input style={{ ...INPUT, textAlign: 'right' }} type="number" min="0" value={resForm.hourly_rate} onChange={e => setResForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="€/h" />
                </td>
                <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 18 }}>
                  <input style={{ ...INPUT, textAlign: 'right' }} type="number" min="0" max="80" step="0.5" value={resForm.planned_weekly_hours} onChange={e => setResForm(p => ({ ...p, planned_weekly_hours: e.target.value }))} placeholder="h/sem" />
                </td>
                <td colSpan={2} />
                <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 14 }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={saveResource} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', border: 'none', cursor: 'pointer', color: '#000' }}><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}><X size={12} /></button>
                  </div>
                </td>
              </tr>
            )}

            {resources.length > 0 && (
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                <td style={{ ...CELL, color: '#4a4a4a', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: 'none' }}>Total</td>
                <td style={{ ...CELL, borderBottom: 'none' }} colSpan={2} />
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#64d2ff', fontWeight: 600, borderBottom: 'none', fontSize: 11 }}>
                  {resources.reduce((s, r) => s + (r.planned_weekly_hours || 0), 0)}h/sem
                </td>
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, fontWeight: 700, color: weekHours > 0 ? '#f5f5f7' : '#3a3a3a', borderBottom: 'none' }}>
                  {weekHours > 0 ? `${weekHours}h` : '—'}
                </td>
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, fontWeight: 700, color: weekCost > 0 ? '#f5f5f7' : '#3a3a3a', borderBottom: 'none' }}>
                  {weekCost > 0 ? fmt(weekCost, currency) : '—'}
                </td>
                <td style={{ ...CELL, borderBottom: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>

        {editingId !== 'new' && (
          <div style={{ padding: '10px 18px', borderTop: resources.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <button
              onClick={() => { setEditingId('new'); setResForm({ name: '', role: '', hourly_rate: '', planned_weekly_hours: '' }) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              <Plus size={13} /> Añadir recurso
            </button>
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
