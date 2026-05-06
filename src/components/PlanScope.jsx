import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, FileDown, Check, AlertTriangle, Clock } from 'lucide-react'
import { computePhaseStatus, daysBetween } from '../hooks/usePlan'
import { useLang } from '../contexts/LanguageContext'

const STATUS_META = {
  on_track: { label: 'En plazo',   color: '#30d158', icon: Check },
  at_risk:  { label: 'En riesgo',  color: '#ff9f0a', icon: AlertTriangle },
  delayed:  { label: 'Retrasado',  color: '#ff453a', icon: Clock },
}
const STATUS_META_EN = {
  on_track: { label: 'On track',  color: '#30d158', icon: Check },
  at_risk:  { label: 'At risk',   color: '#ff9f0a', icon: AlertTriangle },
  delayed:  { label: 'Delayed',   color: '#ff453a', icon: Clock },
}

function formatDate(dateStr, locale) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function BulletList({ items, section, isEditable, onChange, color }) {
  const [editIdx, setEditIdx] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editIdx !== null) inputRef.current?.focus()
  }, [editIdx])

  function addItem() {
    const next = [...items, '']
    onChange(section, next)
    setEditIdx(next.length - 1)
  }

  function updateItem(idx, val) {
    onChange(section, items.map((it, i) => i === idx ? val : it))
  }

  function deleteItem(idx) {
    onChange(section, items.filter((_, i) => i !== idx))
    setEditIdx(null)
  }

  function commitEdit(idx) {
    if (items[idx] === '') deleteItem(idx)
    else setEditIdx(null)
  }

  const dotColor = section === 'included' ? color : 'rgba(255,255,255,0.2)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 group">
          <div
            style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: dotColor,
              flexShrink: 0, marginTop: 6,
            }}
          />
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
              style={{
                flex: 1, fontSize: 13, background: 'none', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
                outline: 'none', color: '#f5f5f7', padding: '0 0 2px',
              }}
            />
          ) : (
            <span
              onClick={() => isEditable && setEditIdx(i)}
              style={{
                flex: 1, fontSize: 13, lineHeight: 1.5,
                color: item ? '#d1d1d6' : 'rgba(255,255,255,0.25)',
                cursor: isEditable ? 'text' : 'default',
                fontStyle: item ? 'normal' : 'italic',
              }}
            >
              {item || 'Sin texto'}
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
          className="flex items-center gap-1.5 mt-1 transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#3a3a3a', fontSize: 12, alignSelf: 'flex-start' }}
          onMouseEnter={e => e.currentTarget.style.color = '#6e6e73'}
          onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
        >
          <Plus style={{ width: 11, height: 11 }} />
          Añadir
        </button>
      )}
      {!isEditable && items.length === 0 && (
        <span style={{ fontSize: 12, color: '#3a3a3a', fontStyle: 'italic' }}>—</span>
      )}
    </div>
  )
}

export default function PlanScope({ plan, phases, isEditable, onUpdatePhase }) {
  const { lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const statusMeta = lang === 'en' ? STATUS_META_EN : STATUS_META

  const visiblePhases = phases.filter(p => !p.is_milestone)

  function getScopeItems(phase) {
    const s = phase.scope_items
    return {
      included: Array.isArray(s?.included) ? s.included : [],
      excluded: Array.isArray(s?.excluded) ? s.excluded : [],
    }
  }

  function handleChange(phase, section, items) {
    const current = getScopeItems(phase)
    onUpdatePhase(phase.id, { scope_items: { ...current, [section]: items } })
  }

  function handlePrint() {
    if (plan) document.title = `${plan.name} — Alcance`
    window.print()
    setTimeout(() => { document.title = 'OppsHub' }, 1000)
  }

  const totalIncluded = visiblePhases.reduce((s, p) => s + getScopeItems(p).included.length, 0)
  const totalExcluded = visiblePhases.reduce((s, p) => s + getScopeItems(p).excluded.length, 0)

  return (
    <>
      {/* Screen view */}
      <div className="no-print" style={{ padding: '24px 24px 48px' }}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#f5f5f7' }}>
              Alcance del proyecto
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>
              {totalIncluded} entregables · {totalExcluded} exclusiones · {visiblePhases.length} fases
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f5f5f7' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#6e6e73' }}
          >
            <FileDown style={{ width: 13, height: 13 }} />
            Exportar PDF
          </button>
        </div>

        {visiblePhases.length === 0 && (
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{ height: 160, border: '1px solid rgba(255,255,255,0.06)', color: '#3a3a3a', fontSize: 13 }}
          >
            Añade fases al plan para definir el alcance
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visiblePhases.map(phase => {
            const scope  = getScopeItems(phase)
            const status = computePhaseStatus(phase)
            const meta   = status ? statusMeta[status] : null
            const StatusIcon = meta?.icon
            const durationDays = daysBetween(phase.start_date, phase.end_date) + 1

            return (
              <div
                key={phase.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#111111' }}
              >
                {/* Phase header */}
                <div
                  className="flex items-center gap-3 px-5 py-3"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${phase.color || '#bf5af2'}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>{phase.name}</span>
                      {meta && (
                        <span
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: meta.color + '18', color: meta.color }}
                        >
                          <StatusIcon style={{ width: 10, height: 10 }} />
                          {meta.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: '#6e6e73' }}>
                        {formatDate(phase.start_date, locale)} → {formatDate(phase.end_date, locale)}
                      </span>
                      <span className="text-xs" style={{ color: '#3a3a3a' }}>{durationDays}d</span>
                      {phase.hours > 0 && (
                        <span className="text-xs" style={{ color: '#3a3a3a' }}>{phase.hours}h</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Included / Excluded columns */}
                <div className="grid grid-cols-2" style={{ gap: 0 }}>
                  {/* Included */}
                  <div className="px-5 py-4" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: phase.color || '#bf5af2' }} />
                      <span className="text-xs font-semibold" style={{ color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Incluido
                      </span>
                    </div>
                    <BulletList
                      items={scope.included}
                      section="included"
                      isEditable={isEditable}
                      onChange={(sec, items) => handleChange(phase, sec, items)}
                      color={phase.color || '#bf5af2'}
                    />
                  </div>

                  {/* Excluded */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                      <span className="text-xs font-semibold" style={{ color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        No incluido
                      </span>
                    </div>
                    <BulletList
                      items={scope.excluded}
                      section="excluded"
                      isEditable={isEditable}
                      onChange={(sec, items) => handleChange(phase, sec, items)}
                      color={phase.color || '#bf5af2'}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Print-only scope document */}
      <div className="print-only" style={{ display: 'none', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px 32px', backgroundColor: '#fff', color: '#111' }}>
        {/* Print header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '2px solid #e5e5e5' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {plan?.project?.icon_url && (
              <img src={plan.project.icon_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, flexShrink: 0, marginTop: 2 }} />
            )}
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{plan?.name}</h1>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#666' }}>Documento de alcance</p>
              {plan?.client_name && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>{plan.client_name}</p>}
            </div>
          </div>
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
        </div>

        {/* Phases */}
        {visiblePhases.map((phase, idx) => {
          const scope  = getScopeItems(phase)
          const status = computePhaseStatus(phase)
          const meta   = lang === 'en' ? STATUS_META_EN[status] : STATUS_META[status]
          const durationDays = daysBetween(phase.start_date, phase.end_date) + 1

          return (
            <div key={phase.id} style={{ marginBottom: 20, pageBreakInside: 'avoid' }}>
              {/* Phase header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                backgroundColor: '#f8f8f8',
                borderLeft: `4px solid ${phase.color || '#bf5af2'}`,
                borderRadius: '0 6px 6px 0',
                marginBottom: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{phase.name}</span>
                    {meta && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, backgroundColor: meta.color + '20', color: meta.color, fontWeight: 600 }}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: '#666', marginTop: 2, display: 'block' }}>
                    {formatDate(phase.start_date, locale)} → {formatDate(phase.end_date, locale)} · {durationDays}d{phase.hours > 0 ? ` · ${phase.hours}h` : ''}
                  </span>
                </div>
              </div>

              {/* Two columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingLeft: 12 }}>
                {/* Included */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 6 }}>Incluido</p>
                  {scope.included.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>—</p>
                  ) : scope.included.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: phase.color || '#bf5af2', flexShrink: 0, marginTop: 5 }} />
                      <span style={{ fontSize: 12, lineHeight: 1.5, color: '#222' }}>{item}</span>
                    </div>
                  ))}
                </div>
                {/* Excluded */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 6 }}>No incluido</p>
                  {scope.excluded.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>—</p>
                  ) : scope.excluded.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#ccc', flexShrink: 0, marginTop: 5 }} />
                      <span style={{ fontSize: 12, lineHeight: 1.5, color: '#222' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {idx < visiblePhases.length - 1 && (
                <div style={{ borderBottom: '1px solid #eee', marginTop: 16 }} />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
