import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, FileDown, Check, AlertTriangle, Clock, Link, ChevronDown } from 'lucide-react'
import { computePhaseStatus, daysBetween } from '../hooks/usePlan'
import { useLang } from '../contexts/LanguageContext'

// ── Status metadata ───────────────────────────────────────────
const STATUS_META = {
  on_track: { label: 'En plazo',  color: '#30d158', icon: Check },
  at_risk:  { label: 'En riesgo', color: '#ff9f0a', icon: AlertTriangle },
  delayed:  { label: 'Retrasado', color: '#ff453a', icon: Clock },
}
const STATUS_META_EN = {
  on_track: { label: 'On track', color: '#30d158', icon: Check },
  at_risk:  { label: 'At risk',  color: '#ff9f0a', icon: AlertTriangle },
  delayed:  { label: 'Delayed',  color: '#ff453a', icon: Clock },
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(dateStr, locale) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function getItems(phase) {
  const s = phase.scope_items
  if (Array.isArray(s)) return s
  if (Array.isArray(s?.included)) return s.included
  return []
}

function getDeliverables(plan) {
  return Array.isArray(plan?.scope_deliverables) ? plan.scope_deliverables : []
}

function getOutOfScope(plan) {
  return Array.isArray(plan?.scope_out_of_scope) ? plan.scope_out_of_scope : []
}

function getLinkedIds(phase) {
  return Array.isArray(phase?.scope_deliverable_ids) ? phase.scope_deliverable_ids : []
}

// ── Multi-deliverable checkbox dropdown ───────────────────────
function DeliverableMultiSelect({ phase, deliverables, onUpdatePhase, s }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const linkedIds = getLinkedIds(phase)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function toggle(id) {
    const next = linkedIds.includes(id) ? linkedIds.filter(x => x !== id) : [...linkedIds, id]
    onUpdatePhase?.(phase.id, { scope_deliverable_ids: next })
  }

  const label = linkedIds.length === 0
    ? s.linkDeliverable
    : linkedIds.length === 1
      ? (deliverables.find(d => d.id === linkedIds[0])?.title || s.linkDeliverable)
      : `${linkedIds.length} ${s.linkDeliverable}`

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, backgroundColor: linkedIds.length > 0 ? '#bf5af215' : '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
          padding: '3px 8px', color: linkedIds.length > 0 ? '#bf5af2' : '#6e6e73',
          cursor: 'pointer', outline: 'none',
        }}
        title={s.linkDeliverable}
      >
        <Link style={{ width: 9, height: 9 }} />
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <ChevronDown style={{ width: 9, height: 9, flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
          backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 180, overflow: 'hidden',
        }}>
          {deliverables.map(d => {
            const checked = linkedIds.includes(d.id)
            return (
              <button
                key={d.id}
                onClick={() => toggle(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                  border: checked ? 'none' : '1px solid rgba(255,255,255,0.2)',
                  backgroundColor: checked ? '#bf5af2' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && <Check style={{ width: 9, height: 9, color: '#fff' }} />}
                </div>
                <span style={{ fontSize: 12, color: '#d1d1d6', flex: 1 }}>{d.title || s.deliverablePlaceholder}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, desc, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 className="text-sm font-semibold" style={{ color: '#f5f5f7', margin: 0 }}>{title}</h3>
        {desc && <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>{desc}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Bullet list (reusable) ────────────────────────────────────
function BulletList({ items, isEditable, onChange, color = '#bf5af2', placeholder, s }) {
  const [editIdx, setEditIdx] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editIdx !== null) inputRef.current?.focus()
  }, [editIdx])

  function addItem() {
    const next = [...items, '']
    onChange(next)
    setEditIdx(next.length - 1)
  }
  function updateItem(idx, val) { onChange(items.map((it, i) => i === idx ? val : it)) }
  function deleteItem(idx) { onChange(items.filter((_, i) => i !== idx)); setEditIdx(null) }
  function commitEdit(idx) { if (items[idx] === '') deleteItem(idx); else setEditIdx(null) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 group">
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, flexShrink: 0, marginTop: 6 }} />
          {isEditable && editIdx === i ? (
            <input
              ref={inputRef}
              value={item}
              onChange={e => updateItem(i, e.target.value)}
              onBlur={() => commitEdit(i)}
              onKeyDown={e => {
                if (e.key === 'Enter') { commitEdit(i); if (i === items.length - 1) addItem() }
                if (e.key === 'Escape') commitEdit(i)
              }}
              style={{ flex: 1, fontSize: 13, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', outline: 'none', color: '#f5f5f7', padding: '0 0 2px' }}
            />
          ) : (
            <span
              onClick={() => isEditable && setEditIdx(i)}
              style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: item ? '#d1d1d6' : 'rgba(255,255,255,0.25)', cursor: isEditable ? 'text' : 'default', fontStyle: item ? 'normal' : 'italic' }}
            >
              {item || s.noText}
            </span>
          )}
          {isEditable && (
            <button
              onClick={() => deleteItem(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6e6e73', lineHeight: 0, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              <Trash2 style={{ width: 11, height: 11 }} />
            </button>
          )}
        </div>
      ))}
      {isEditable && (
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 mt-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#3a3a3a', fontSize: 12, alignSelf: 'flex-start' }}
          onMouseEnter={e => e.currentTarget.style.color = '#6e6e73'}
          onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
        >
          <Plus style={{ width: 11, height: 11 }} />
          {placeholder || s.add}
        </button>
      )}
      {!isEditable && items.length === 0 && (
        <span style={{ fontSize: 12, color: '#3a3a3a', fontStyle: 'italic' }}>—</span>
      )}
    </div>
  )
}

// ── Named export: pure print markup ──────────────────────────
export function ScopePrintArea({ plan, phases }) {
  const { lang, t } = useLang()
  const s = t('scope')
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const statusMeta = lang === 'en' ? STATUS_META_EN : STATUS_META
  const visiblePhases = (phases || []).filter(p => !p.is_milestone)
  const deliverables = getDeliverables(plan)
  const outOfScope = getOutOfScope(plan)
  const totalHours = (phases || []).reduce((s, p) => s + Number(p.hours || 0), 0)
  const lastEnd = (phases || []).reduce((acc, p) => p.end_date > acc ? p.end_date : acc, plan?.start_date || '')

  const SectionHeading = ({ num, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 28 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: '#1a1a1a', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>{title}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: '#e8e8e8' }} />
    </div>
  )

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '28px 36px', backgroundColor: '#fff', color: '#111' }}>

      {/* ── Cabecera del documento ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '2px solid #111' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {plan?.project?.icon_url && (
            <img src={plan.project.icon_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, flexShrink: 0, border: '1px solid #eee' }} />
          )}
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999' }}>{s.printSubtitle}</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{plan?.name}</h1>
            {plan?.client_name && <p style={{ margin: 0, fontSize: 13, color: '#555' }}>{plan.client_name}</p>}
          </div>
        </div>
        {plan?.pdf_logo_url
          ? <img src={plan.pdf_logo_url} alt="" style={{ height: 32, maxWidth: 120, objectFit: 'contain', flexShrink: 0 }} />
          : (plan?.pdf_logo_url === null || plan?.pdf_logo_url === undefined)
            ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 44 44" fill="none">
                  <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
                  <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
                  <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
                  <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
                  <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>OppsHub</span>
              </div>
            )
            : null
        }
      </div>

      {/* ── Datos del proyecto (pills en fila) ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 4, border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
        {[
          plan?.start_date && { label: s.start, value: formatDate(plan.start_date, locale) },
          lastEnd          && { label: s.end,   value: formatDate(lastEnd, locale) },
          totalHours > 0   && { label: s.hours, value: `${totalHours}h` },
          visiblePhases.length > 0 && { label: s.phasesCount, value: visiblePhases.length },
          plan?.client_name && { label: s.client, value: plan.client_name },
        ].filter(Boolean).map((item, i, arr) => (
          <div key={i} style={{ flex: 1, padding: '10px 14px', borderRight: i < arr.length - 1 ? '1px solid #e8e8e8' : 'none', backgroundColor: i % 2 === 0 ? '#fafafa' : '#fff' }}>
            <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#222' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── 1. Objetivo ── */}
      {plan?.scope_objective && (
        <>
          <SectionHeading num={1} title={s.objectiveLabel} />
          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#333', margin: 0, whiteSpace: 'pre-wrap', paddingLeft: 2 }}>{plan.scope_objective}</p>
        </>
      )}

      {/* ── 2. Entregables ── */}
      {deliverables.length > 0 && (
        <>
          <SectionHeading num={plan?.scope_objective ? 2 : 1} title={s.deliverablesTitle} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {deliverables.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', backgroundColor: '#fafafa', borderRadius: 6, border: '1px solid #efefef' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#bbb', minWidth: 16, paddingTop: 1 }}>{i + 1}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: '#111', fontWeight: 500 }}>{d.title}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 3. Fases ── */}
      {visiblePhases.length > 0 && (
        <>
          <SectionHeading num={[plan?.scope_objective, deliverables.length > 0].filter(Boolean).length + 1} title={s.phasesTitle} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visiblePhases.map((phase) => {
              const items = getItems(phase)
              const status = computePhaseStatus(phase)
              const meta = (status && status !== 'on_track') ? statusMeta[status] : null
              const durationDays = daysBetween(phase.start_date, phase.end_date) + 1
              const color = phase.color || '#bf5af2'
              const linkedIds = getLinkedIds(phase)
              const linkedDels = deliverables.filter(d => linkedIds.includes(d.id))

              return (
                <div key={phase.id} style={{ pageBreakInside: 'avoid', border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
                  {/* Phase header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', backgroundColor: '#f5f5f5', borderLeft: `4px solid ${color}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{phase.name}</span>
                        {meta && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, backgroundColor: meta.color + '20', color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                        )}
                        {linkedDels.map(d => (
                          <span key={d.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, backgroundColor: '#f0e8ff', color: '#7c3aed', fontWeight: 500 }}>→ {d.title}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'block' }}>
                        {formatDate(phase.start_date, locale)} → {formatDate(phase.end_date, locale)} · {durationDays}d{phase.hours > 0 ? ` · ${phase.hours}h` : ''}
                      </span>
                    </div>
                  </div>
                  {/* Bullets */}
                  {items.length > 0 && (
                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, flexShrink: 0, marginTop: 6, display: 'inline-block' }} />
                          <span style={{ fontSize: 12, lineHeight: 1.6, color: '#333' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── 4. Fuera de alcance ── */}
      {outOfScope.length > 0 && (
        <>
          <SectionHeading num={[plan?.scope_objective, deliverables.length > 0, visiblePhases.length > 0].filter(Boolean).length + 1} title={s.outOfScopeTitle} />
          <div style={{ border: '1px solid #fdd', borderRadius: 8, overflow: 'hidden' }}>
            {outOfScope.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 14px', borderBottom: i < outOfScope.length - 1 ? '1px solid #fdd' : 'none', backgroundColor: i % 2 === 0 ? '#fff8f8' : '#fff' }}>
                <span style={{ fontSize: 14, color: '#ef4444', flexShrink: 0, lineHeight: 1.4, fontWeight: 700 }}>×</span>
                <span style={{ fontSize: 12, lineHeight: 1.6, color: '#444' }}>{item}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Default export: interactive screen view ──────────────────
export default function PlanScope({ plan, phases, isEditable, onUpdatePlan, onUpdatePhase }) {
  const { lang, t } = useLang()
  const s = t('scope')
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const statusMeta = lang === 'en' ? STATUS_META_EN : STATUS_META

  const visiblePhases = phases.filter(p => !p.is_milestone)
  const deliverables = getDeliverables(plan)
  const outOfScope = getOutOfScope(plan)
  const totalHours = phases.reduce((acc, p) => acc + Number(p.hours || 0), 0)
  const lastEnd = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, plan?.start_date || '')

  const [delEditIdx, setDelEditIdx] = useState(null)
  const delInputRef = useRef(null)
  useEffect(() => { if (delEditIdx !== null) delInputRef.current?.focus() }, [delEditIdx])

  function handlePrint() {
    const style = document.createElement('style')
    style.id = '__scope-portrait__'
    style.textContent = '@page { size: A4 portrait !important; margin: 15mm 20mm !important; }'
    document.head.appendChild(style)
    if (plan) document.title = `${plan.name} — ${s.tabLabel}`
    // Small delay so the browser processes the injected @page rule before opening the print dialog
    setTimeout(() => {
      window.print()
      setTimeout(() => {
        document.title = 'OppsHub'
        document.getElementById('__scope-portrait__')?.remove()
      }, 1000)
    }, 80)
  }

  function addDeliverable() {
    const id = `del-${Date.now()}`
    const next = [...deliverables, { id, title: '' }]
    onUpdatePlan?.({ scope_deliverables: next })
    setDelEditIdx(next.length - 1)
  }
  function updateDeliverable(idx, title) {
    onUpdatePlan?.({ scope_deliverables: deliverables.map((d, i) => i === idx ? { ...d, title } : d) })
  }
  function deleteDeliverable(idx) {
    const removed = deliverables[idx]
    onUpdatePlan?.({ scope_deliverables: deliverables.filter((_, i) => i !== idx) })
    // unlink phases that referenced this deliverable
    phases.forEach(ph => {
      const ids = getLinkedIds(ph)
      if (ids.includes(removed.id)) onUpdatePhase?.(ph.id, { scope_deliverable_ids: ids.filter(x => x !== removed.id) })
    })
    setDelEditIdx(null)
  }
  function commitDelEdit(idx) {
    if (deliverables[idx]?.title === '') deleteDeliverable(idx)
    else setDelEditIdx(null)
  }

  return (
    <div style={{ padding: '24px 24px 48px' }}>

      {/* Export button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f5f5f7' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#6e6e73' }}
        >
          <FileDown style={{ width: 13, height: 13 }} />
          {s.exportPdf}
        </button>
      </div>

      {/* ── Sección 1: Información del proyecto ── */}
      <Section title={s.overviewTitle}>
        {/* Info pills */}
        <div className="flex flex-wrap gap-3 mb-4">
          {plan?.start_date && (
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs" style={{ color: '#6e6e73', margin: '0 0 2px' }}>{s.start}</p>
              <p className="text-xs font-medium" style={{ color: '#f5f5f7', margin: 0 }}>{formatDate(plan.start_date, locale)}</p>
            </div>
          )}
          {lastEnd && (
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs" style={{ color: '#6e6e73', margin: '0 0 2px' }}>{s.end}</p>
              <p className="text-xs font-medium" style={{ color: '#f5f5f7', margin: 0 }}>{formatDate(lastEnd, locale)}</p>
            </div>
          )}
          {totalHours > 0 && (
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs" style={{ color: '#6e6e73', margin: '0 0 2px' }}>{s.hours}</p>
              <p className="text-xs font-medium" style={{ color: '#f5f5f7', margin: 0 }}>{totalHours}h</p>
            </div>
          )}
          {plan?.client_name && (
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs" style={{ color: '#6e6e73', margin: '0 0 2px' }}>{s.client}</p>
              <p className="text-xs font-medium" style={{ color: '#f5f5f7', margin: 0 }}>{plan.client_name}</p>
            </div>
          )}
        </div>

        {/* Objective textarea */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: '#6e6e73' }}>{s.objectiveLabel}</p>
          <textarea
            value={plan?.scope_objective || ''}
            onChange={e => onUpdatePlan?.({ scope_objective: e.target.value })}
            placeholder={s.objectivePlaceholder}
            readOnly={!isEditable}
            rows={3}
            style={{
              width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6,
              backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 14px', color: '#d1d1d6',
              outline: 'none', fontFamily: 'inherit',
              cursor: isEditable ? 'text' : 'default',
            }}
            onFocus={e => { if (isEditable) e.target.style.borderColor = 'rgba(191,90,242,0.4)' }}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
      </Section>

      {/* ── Sección 2: Entregables ── */}
      <Section title={s.deliverablesTitle} desc={s.deliverablesDesc}>
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#111111' }}>
          {deliverables.length === 0 && !isEditable && (
            <p className="px-5 py-4 text-sm" style={{ color: '#3a3a3a', fontStyle: 'italic' }}>{s.noDeliverables}</p>
          )}
          {deliverables.map((del, i) => (
            <div
              key={del.id}
              className="flex items-center gap-3 px-5 py-3 group"
              style={{ borderBottom: i < deliverables.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
            >
              <span className="text-xs font-bold shrink-0" style={{ color: '#3a3a3a', minWidth: 18 }}>{i + 1}.</span>
              {isEditable && delEditIdx === i ? (
                <input
                  ref={delInputRef}
                  value={del.title}
                  onChange={e => updateDeliverable(i, e.target.value)}
                  onBlur={() => commitDelEdit(i)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commitDelEdit(i) }}
                  placeholder={s.deliverablePlaceholder}
                  style={{ flex: 1, fontSize: 13, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', outline: 'none', color: '#f5f5f7', padding: '0 0 2px' }}
                />
              ) : (
                <span
                  onClick={() => isEditable && setDelEditIdx(i)}
                  className="flex-1 text-sm"
                  style={{ color: del.title ? '#d1d1d6' : '#3a3a3a', cursor: isEditable ? 'text' : 'default', fontStyle: del.title ? 'normal' : 'italic' }}
                >
                  {del.title || s.deliverablePlaceholder}
                </span>
              )}
              {isEditable && (
                <button
                  onClick={() => deleteDeliverable(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6e6e73', lineHeight: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>
          ))}
          {isEditable && (
            <button
              onClick={addDeliverable}
              className="flex items-center gap-2 w-full px-5 py-3 transition-colors text-sm"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3a3a', borderTop: deliverables.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = '#6e6e73'}
              onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
            >
              <Plus style={{ width: 13, height: 13 }} />
              {s.addDeliverable}
            </button>
          )}
        </div>
      </Section>

      {/* ── Sección 3: Fases ── */}
      <Section title={s.phasesTitle} desc={s.phasesDesc}>
        {visiblePhases.length === 0 && (
          <div className="flex items-center justify-center rounded-2xl" style={{ height: 100, border: '1px solid rgba(255,255,255,0.06)', color: '#3a3a3a', fontSize: 13 }}>
            {s.noPhases}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visiblePhases.map(phase => {
            const items = getItems(phase)
            const status = computePhaseStatus(phase)
            const meta = (status && status !== 'on_track') ? statusMeta[status] : null
            const StatusIcon = meta?.icon
            const durationDays = daysBetween(phase.start_date, phase.end_date) + 1
            const color = phase.color || '#bf5af2'
            const linkedIds = getLinkedIds(phase)
            const linkedDels = deliverables.filter(d => linkedIds.includes(d.id))

            return (
              <div key={phase.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#111111' }}>
                {/* Phase header */}
                <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${color}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>{phase.name}</span>
                      {meta && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.color + '18', color: meta.color }}>
                          <StatusIcon style={{ width: 10, height: 10 }} />
                          {meta.label}
                        </span>
                      )}
                      {linkedDels.map(d => (
                        <span key={d.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#bf5af215', color: '#bf5af2' }}>
                          <Link style={{ width: 9, height: 9 }} />
                          {d.title}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: '#6e6e73' }}>{formatDate(phase.start_date, locale)} → {formatDate(phase.end_date, locale)}</span>
                      <span className="text-xs" style={{ color: '#3a3a3a' }}>{durationDays}d</span>
                      {phase.hours > 0 && <span className="text-xs" style={{ color: '#3a3a3a' }}>{phase.hours}h</span>}
                    </div>
                  </div>

                  {/* Multi-deliverable link selector */}
                  {isEditable && deliverables.length > 0 && (
                    <DeliverableMultiSelect phase={phase} deliverables={deliverables} onUpdatePhase={onUpdatePhase} s={s} />
                  )}
                </div>

                {/* Bullet list */}
                <div className="px-5 py-4">
                  <BulletList
                    items={items}
                    isEditable={isEditable}
                    onChange={next => onUpdatePhase?.(phase.id, { scope_items: next })}
                    color={color}
                    s={s}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Sección 4: Fuera de alcance ── */}
      <Section title={s.outOfScopeTitle} desc={s.outOfScopeDesc}>
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,69,58,0.15)', backgroundColor: '#111111' }}>
          <div className="px-5 py-4">
            <BulletList
              items={outOfScope}
              isEditable={isEditable}
              onChange={next => onUpdatePlan?.({ scope_out_of_scope: next })}
              color="#ff453a"
              placeholder={s.outOfScopePlaceholder}
              s={s}
            />
          </div>
        </div>
      </Section>

    </div>
  )
}
