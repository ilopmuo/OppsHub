import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, FileDown, Check, AlertTriangle, Clock, Link } from 'lucide-react'
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

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '24px 32px', backgroundColor: '#fff', color: '#111' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '2px solid #e5e5e5' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {plan?.project?.icon_url && (
            <img src={plan.project.icon_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, flexShrink: 0, marginTop: 2 }} />
          )}
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{plan?.name}</h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#666' }}>{s.printSubtitle}</p>
            {plan?.client_name && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>{plan.client_name}</p>}
          </div>
        </div>
        {plan?.pdf_logo_url
          ? <img src={plan.pdf_logo_url} alt="" style={{ height: 28, maxWidth: 110, objectFit: 'contain', flexShrink: 0 }} />
          : (plan?.pdf_logo_url === null || plan?.pdf_logo_url === undefined)
            ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 44 44" fill="none">
                  <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
                  <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
                  <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
                  <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
                  <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>OppsHub</span>
              </div>
            )
            : null
        }
      </div>

      {/* Project info */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 18, flexWrap: 'wrap' }}>
        {plan?.start_date && (
          <div><p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', margin: '0 0 3px' }}>{s.start}</p><p style={{ fontSize: 12, color: '#333', margin: 0 }}>{formatDate(plan.start_date, locale)}</p></div>
        )}
        {lastEnd && (
          <div><p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', margin: '0 0 3px' }}>{s.end}</p><p style={{ fontSize: 12, color: '#333', margin: 0 }}>{formatDate(lastEnd, locale)}</p></div>
        )}
        {totalHours > 0 && (
          <div><p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', margin: '0 0 3px' }}>{s.hours}</p><p style={{ fontSize: 12, color: '#333', margin: 0 }}>{totalHours}h</p></div>
        )}
        {visiblePhases.length > 0 && (
          <div><p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', margin: '0 0 3px' }}>{s.phasesCount}</p><p style={{ fontSize: 12, color: '#333', margin: 0 }}>{visiblePhases.length}</p></div>
        )}
      </div>

      {/* Objective */}
      {plan?.scope_objective && (
        <div style={{ marginBottom: 20, padding: '10px 14px', backgroundColor: '#f8f8f8', borderRadius: 6, borderLeft: '3px solid #bf5af2' }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', margin: '0 0 5px' }}>{s.objectiveLabel}</p>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: '#222', margin: 0, whiteSpace: 'pre-wrap' }}>{plan.scope_objective}</p>
        </div>
      )}

      {/* Deliverables */}
      {deliverables.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 8 }}>{s.deliverablesTitle}</p>
          {deliverables.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#999', minWidth: 18 }}>{i + 1}.</span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: '#222' }}>{d.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phases */}
      {visiblePhases.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 8 }}>{s.phasesTitle}</p>
          {visiblePhases.map((phase, idx) => {
            const items = getItems(phase)
            const status = computePhaseStatus(phase)
            const meta = (status && status !== 'on_track') ? statusMeta[status] : null
            const durationDays = daysBetween(phase.start_date, phase.end_date) + 1
            const color = phase.color || '#bf5af2'
            const linkedDel = deliverables.find(d => d.id === phase.scope_deliverable_id)

            return (
              <div key={phase.id} style={{ marginBottom: 14, pageBreakInside: 'avoid' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', backgroundColor: '#f8f8f8', borderLeft: `4px solid ${color}`, borderRadius: '0 6px 6px 0', marginBottom: 7 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{phase.name}</span>
                      {meta && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, backgroundColor: meta.color + '20', color: meta.color, fontWeight: 600 }}>{meta.label}</span>}
                      {linkedDel && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, backgroundColor: '#bf5af215', color: '#bf5af2', fontWeight: 500 }}>→ {linkedDel.title}</span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#666', marginTop: 2, display: 'block' }}>
                      {formatDate(phase.start_date, locale)} → {formatDate(phase.end_date, locale)} · {durationDays}d{phase.hours > 0 ? ` · ${phase.hours}h` : ''}
                    </span>
                  </div>
                </div>
                {items.length > 0 && (
                  <div style={{ paddingLeft: 12 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, flexShrink: 0, marginTop: 5, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, lineHeight: 1.5, color: '#222' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {idx < visiblePhases.length - 1 && <div style={{ borderBottom: '1px solid #eee', marginTop: 12 }} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Out of scope */}
      {outOfScope.length > 0 && (
        <div style={{ marginTop: 20, padding: '10px 14px', backgroundColor: '#fff8f8', borderRadius: 6, border: '1px solid #fde8e8' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: 8 }}>{s.outOfScopeTitle}</p>
          {outOfScope.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#ff453a', flexShrink: 0, marginTop: -1 }}>×</span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: '#444' }}>{item}</span>
            </div>
          ))}
        </div>
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
    // unlink phases that were linked to this deliverable
    phases.forEach(ph => {
      if (ph.scope_deliverable_id === removed.id) onUpdatePhase?.(ph.id, { scope_deliverable_id: null })
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
            const linkedDel = deliverables.find(d => d.id === phase.scope_deliverable_id)

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
                      {linkedDel && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#bf5af215', color: '#bf5af2' }}>
                          <Link style={{ width: 9, height: 9 }} />
                          {linkedDel.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: '#6e6e73' }}>{formatDate(phase.start_date, locale)} → {formatDate(phase.end_date, locale)}</span>
                      <span className="text-xs" style={{ color: '#3a3a3a' }}>{durationDays}d</span>
                      {phase.hours > 0 && <span className="text-xs" style={{ color: '#3a3a3a' }}>{phase.hours}h</span>}
                    </div>
                  </div>

                  {/* Deliverable link selector */}
                  {isEditable && deliverables.length > 0 && (
                    <select
                      value={phase.scope_deliverable_id || ''}
                      onChange={e => onUpdatePhase?.(phase.id, { scope_deliverable_id: e.target.value || null })}
                      style={{
                        fontSize: 11, backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6, padding: '3px 6px', color: '#6e6e73', cursor: 'pointer', outline: 'none', flexShrink: 0,
                      }}
                      title={s.linkDeliverable}
                    >
                      <option value="">{s.noLink}</option>
                      {deliverables.map(d => (
                        <option key={d.id} value={d.id}>{d.title || s.deliverablePlaceholder}</option>
                      ))}
                    </select>
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
