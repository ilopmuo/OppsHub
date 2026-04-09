import { useState, useEffect, useCallback } from 'react'
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
  const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sun)}`
}
function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const CELL = { fontSize: 13, color: '#f5f5f7', padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }
const TH   = { fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left' }
const INPUT = {
  backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#f5f5f7',
  outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}
function fmt(n, cur = '€') {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M${cur}`
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}k${cur}`
  return `${Number(n).toFixed(0)}${cur}`
}
function fmtFull(n, cur = '€') {
  return `${cur}${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ProjectFinances({ projectId }) {
  const [resources,     setResources]     = useState([])
  const [allocations,   setAllocations]   = useState({})  // key: `${resourceId}_${weekIso}` → hours
  const [financials,    setFinancials]    = useState({ currency: '€', contract_value: 0, invoiced_to_date: 0, effort_to_date: null, etc_effort: 0 })
  const [week,          setWeek]          = useState(() => weekMonday())
  const [loading,       setLoading]       = useState(true)
  const [editFinancials, setEditFinancials] = useState(false)
  const [finForm,       setFinForm]       = useState({})
  const [editingId,     setEditingId]     = useState(null) // resource id being edited, or 'new'
  const [resForm,       setResForm]       = useState({ name: '', role: '', hourly_rate: '' })

  const weekIso = isoDate(week)
  const today   = isoDate(weekMonday())

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: res }, { data: alloc }, { data: fin }] = await Promise.all([
      supabase.from('project_resources').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('resource_allocations')
        .select('resource_id, week_start, hours')
        .in('resource_id',
          (await supabase.from('project_resources').select('id').eq('project_id', projectId))
            .data?.map(r => r.id) || []
        ),
      supabase.from('project_financials').select('*').eq('project_id', projectId).maybeSingle(),
    ])
    setResources(res || [])
    const map = {}
    for (const a of alloc || []) map[`${a.resource_id}_${a.week_start}`] = a.hours
    setAllocations(map)
    if (fin) setFinancials(fin)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Allocation update ──────────────────────────────────────────────────────
  async function setHours(resourceId, hours) {
    const key = `${resourceId}_${weekIso}`
    const val = parseFloat(hours) || 0
    setAllocations(p => ({ ...p, [key]: val }))
    if (val === 0) {
      await supabase.from('resource_allocations')
        .delete().eq('resource_id', resourceId).eq('week_start', weekIso)
    } else {
      await supabase.from('resource_allocations')
        .upsert({ resource_id: resourceId, week_start: weekIso, hours: val }, { onConflict: 'resource_id,week_start' })
    }
  }

  // ── Financial save ─────────────────────────────────────────────────────────
  async function saveFinancials() {
    const payload = {
      project_id: projectId,
      currency: finForm.currency || '€',
      contract_value: parseFloat(finForm.contract_value) || 0,
      invoiced_to_date: parseFloat(finForm.invoiced_to_date) || 0,
      effort_to_date: finForm.effort_to_date !== '' && finForm.effort_to_date != null
        ? parseFloat(finForm.effort_to_date)
        : null,
      etc_effort: parseFloat(finForm.etc_effort) || 0,
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
    const rate = parseFloat(resForm.hourly_rate) || 0
    if (editingId === 'new') {
      const { data, error } = await supabase.from('project_resources')
        .insert({ project_id: projectId, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate })
        .select().single()
      if (error) { toast.error('Error al añadir'); return }
      setResources(p => [...p, data])
    } else {
      const { error } = await supabase.from('project_resources')
        .update({ name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate })
        .eq('id', editingId)
      if (error) { toast.error('Error al actualizar'); return }
      setResources(p => p.map(r => r.id === editingId ? { ...r, name: resForm.name.trim(), role: resForm.role.trim(), hourly_rate: rate } : r))
    }
    setEditingId(null)
    setResForm({ name: '', role: '', hourly_rate: '' })
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

  // ── Computed metrics ───────────────────────────────────────────────────────
  const currency = financials.currency || '€'

  // Calculated ETD from all allocations
  const calcEtd = resources.reduce((sum, r) => {
    return sum + Object.entries(allocations)
      .filter(([k]) => k.startsWith(r.id + '_'))
      .reduce((s, [, h]) => s + h * r.hourly_rate, 0)
  }, 0)

  // ETD = base histórica (manual) + allocations
  const etdBase      = financials.effort_to_date != null ? Number(financials.effort_to_date) : 0
  const etd          = etdBase + calcEtd

  // This week totals (for the resource table)
  const weekHours = resources.reduce((s, r) => s + (allocations[`${r.id}_${weekIso}`] || 0), 0)
  const weekCost  = resources.reduce((s, r) => s + (allocations[`${r.id}_${weekIso}`] || 0) * r.hourly_rate, 0)
  const totalHours = Object.values(allocations).reduce((s, h) => s + h, 0)

  // ── Financial table calculations ──────────────────────────────────────────
  const tPresupuesto = financials.contract_value   || 0
  const billed       = financials.invoiced_to_date || 0
  const etcEffort    = financials.etc_effort        || 0

  const beToDate   = billed - etd                          // Billed − ETD
  const etcBilling = tPresupuesto - billed                 // T.Pres − Billed
  const totalEffort = etd + etcEffort                      // ETD + ETC Effort
  const totalBill   = tPresupuesto                         // always = contract
  const resultEtc   = tPresupuesto - totalEffort           // T.Pres − Total Effort
  const pctProgress = totalEffort > 0 ? etd / totalEffort * 100 : 0
  const pctOff      = tPresupuesto > 0 ? resultEtc / tPresupuesto * 100 : 0

  if (loading) return <div className="skeleton rounded-2xl" style={{ height: 300 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Financial table ───────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Finanzas</span>
          {!editFinancials ? (
            <button
              onClick={() => { setFinForm({ ...financials, effort_to_date: financials.effort_to_date ?? '', etc_effort: financials.etc_effort ?? '' }); setEditFinancials(true) }}
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
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { k: 'contract_value',   l: 'T. Presupuesto' },
              { k: 'invoiced_to_date', l: 'Billed' },
              { k: 'etc_effort',       l: 'ETC Effort' },
            ].map(({ k, l }) => (
              <div key={k}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>{l}</label>
                <input style={INPUT} type="number" min="0" step="100"
                  value={finForm[k] ?? ''}
                  onChange={e => setFinForm(p => ({ ...p, [k]: e.target.value }))}
                  placeholder="0" />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>ETD base histórica</label>
              <input style={INPUT} type="number" min="0" step="100"
                value={finForm.effort_to_date ?? ''}
                onChange={e => setFinForm(p => ({ ...p, effort_to_date: e.target.value === '' ? null : e.target.value }))}
                placeholder="0" />
              {calcEtd > 0 && <p style={{ fontSize: 9, color: '#3a3a3a', marginTop: 3 }}>+ {fmt(calcEtd, finForm.currency || '€')} allocations</p>}
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 5 }}>Moneda</label>
              <select style={INPUT} value={finForm.currency || '€'} onChange={e => setFinForm(p => ({ ...p, currency: e.target.value }))}>
                <option>€</option><option>$</option><option>£</option>
              </select>
            </div>
          </div>
        )}

        {/* Data table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                {[
                  'Date', 'T. Presupuesto', 'Billed', 'Effort to date',
                  'B-E to date', '% Progress', 'ETC Effort', 'ETC Billing',
                  'Total Effort', 'Total Bill', 'Result ETC', '% OFF',
                ].map(h => (
                  <th key={h} style={{ ...TH, textAlign: h === 'Date' ? 'left' : 'right', paddingRight: h === 'Date' ? 14 : 18 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* Date */}
                <td style={{ ...CELL, color: '#6e6e73' }}>
                  {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                </td>
                {/* T. Presupuesto */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7', fontWeight: 600 }}>
                  {fmtFull(tPresupuesto, currency)}
                </td>
                {/* Billed */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7' }}>
                  {fmtFull(billed, currency)}
                </td>
                {/* Effort to date */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7' }}>
                  {fmtFull(etd, currency)}
                </td>
                {/* B-E to date */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: beToDate >= 0 ? '#30d158' : '#ff453a', fontWeight: 600 }}>
                  {beToDate >= 0 ? '+' : ''}{fmtFull(beToDate, currency)}
                </td>
                {/* % Progress */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7' }}>
                  {pctProgress.toFixed(2)}%
                </td>
                {/* ETC Effort */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7' }}>
                  {fmtFull(etcEffort, currency)}
                </td>
                {/* ETC Billing */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7' }}>
                  {fmtFull(etcBilling, currency)}
                </td>
                {/* Total Effort */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7', fontWeight: 600 }}>
                  {fmtFull(totalEffort, currency)}
                </td>
                {/* Total Bill */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#f5f5f7', fontWeight: 600 }}>
                  {fmtFull(totalBill, currency)}
                </td>
                {/* Result ETC */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: resultEtc >= 0 ? '#30d158' : '#ff453a', fontWeight: 700 }}>
                  {resultEtc >= 0 ? '+' : ''}{fmtFull(resultEtc, currency)}
                </td>
                {/* % OFF */}
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: pctOff >= 0 ? '#30d158' : '#ff453a', fontWeight: 700 }}>
                  {pctOff.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resource table ────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6e73' }}>Equipo &amp; Dedicación</span>

          {/* Week navigation */}
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
            <col style={{ width: '22%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              {['Nombre', 'Rol', '€/h', `Horas (sem)`, 'Coste sem.', 'Total h', ''].map((h, i) => (
                <th key={i} style={{ ...TH, textAlign: i >= 2 ? 'right' : 'left', paddingRight: i >= 2 ? 18 : 14 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map(r => {
              const isEditing = editingId === r.id
              const h     = allocations[`${r.id}_${weekIso}`] || 0
              const cost  = h * r.hourly_rate
              const allH  = Object.entries(allocations)
                .filter(([k]) => k.startsWith(r.id + '_'))
                .reduce((s, [, v]) => s + v, 0)

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
                    <td colSpan={3} />
                    <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 18 }}>
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
                  <td style={CELL}>
                    <span style={{ fontWeight: 500 }}>{r.name}</span>
                  </td>
                  <td style={{ ...CELL, color: '#6e6e73' }}>{r.role || <span style={{ color: '#3a3a3a' }}>—</span>}</td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18 }}>
                    <span style={{ color: '#6e6e73' }}>{r.hourly_rate}{currency}</span>
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18 }}>
                    <input
                      type="number" min="0" max="80" step="0.5"
                      value={h || ''}
                      onChange={e => setHours(r.id, e.target.value)}
                      placeholder="—"
                      style={{
                        width: 56, textAlign: 'right', backgroundColor: 'transparent',
                        border: '1px solid transparent', borderRadius: 6,
                        padding: '3px 6px', fontSize: 13, color: h > 0 ? '#f5f5f7' : '#3a3a3a',
                        outline: 'none', fontFamily: 'inherit',
                        transition: 'border-color 0.15s, background-color 0.15s',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                      onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent' }}
                    />
                    <span style={{ fontSize: 10, color: '#3a3a3a', marginLeft: 2 }}>h</span>
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: cost > 0 ? '#f5f5f7' : '#3a3a3a', fontWeight: cost > 0 ? 600 : 400 }}>
                    {cost > 0 ? fmt(cost, currency) : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#6e6e73' }}>
                    {allH > 0 ? `${allH}h` : <span style={{ color: '#3a3a3a' }}>—</span>}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', paddingRight: 14 }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setEditingId(r.id); setResForm({ name: r.name, role: r.role || '', hourly_rate: r.hourly_rate }) }}
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

            {/* New resource row */}
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
                <td colSpan={3} />
                <td style={{ ...CELL, paddingTop: 8, paddingBottom: 8, textAlign: 'right', paddingRight: 18 }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={saveResource} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', border: 'none', cursor: 'pointer', color: '#000' }}><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#6e6e73' }}><X size={12} /></button>
                  </div>
                </td>
              </tr>
            )}

            {/* Totals row */}
            {(resources.length > 0 || weekHours > 0) && (
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                <td style={{ ...CELL, color: '#4a4a4a', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: 'none' }}>Total</td>
                <td style={{ ...CELL, borderBottom: 'none' }} colSpan={2} />
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, fontWeight: 700, color: weekHours > 0 ? '#f5f5f7' : '#3a3a3a', borderBottom: 'none' }}>
                  {weekHours > 0 ? `${weekHours}h` : '—'}
                </td>
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, fontWeight: 700, color: weekCost > 0 ? '#f5f5f7' : '#3a3a3a', borderBottom: 'none' }}>
                  {weekCost > 0 ? fmt(weekCost, currency) : '—'}
                </td>
                <td style={{ ...CELL, textAlign: 'right', paddingRight: 18, color: '#6e6e73', borderBottom: 'none' }}>
                  {totalHours > 0 ? `${totalHours}h` : '—'}
                </td>
                <td style={{ ...CELL, borderBottom: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>

        {/* Add resource */}
        {editingId !== 'new' && (
          <div style={{ padding: '10px 18px', borderTop: resources.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <button
              onClick={() => { setEditingId('new'); setResForm({ name: '', role: '', hourly_rate: '' }) }}
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
