import { useState, useRef, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, Plus, Trash2 } from 'lucide-react'
import PlanPhaseRow from './PlanPhaseRow'
import { daysBetween, mhDateToPixel, mhPixelToDate } from '../hooks/usePlan'
import { useLang } from '../contexts/LanguageContext'

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Legend panel ──────────────────────────────────────────────
function LegendPanel({ items = [], isEditable, onUpdate, printMode }) {
  const { t: tl } = useLang()
  const [editIdx, setEditIdx] = useState(null)

  function addItem() {
    const colors = ['#bf5af2', '#64d2ff', '#30d158', '#ff9f0a', '#ff453a']
    const next = [...items, { color: colors[items.length % colors.length], label: '' }]
    onUpdate(next)
    setEditIdx(next.length - 1)
  }

  function updateItem(idx, patch) {
    onUpdate(items.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function deleteItem(idx) {
    onUpdate(items.filter((_, i) => i !== idx))
    setEditIdx(null)
  }

  if (!isEditable && items.length === 0) return null

  const bg      = printMode ? 'rgba(245,245,247,0.95)' : 'rgba(17,17,17,0.92)'
  const border  = printMode ? '1px solid #ddd'         : '1px solid rgba(255,255,255,0.08)'
  const textCol = printMode ? '#111'                   : '#f5f5f7'
  const mutedCol= printMode ? '#666'                   : '#6e6e73'

  return (
    <div
      style={{
        position: 'absolute', top: 10, right: 10,
        backgroundColor: bg,
        border,
        borderRadius: 10,
        padding: '8px 10px',
        minWidth: 120,
        maxWidth: 220,
        backdropFilter: 'blur(12px)',
        zIndex: 15,
        boxShadow: printMode ? '0 1px 6px rgba(0,0,0,0.1)' : '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5" style={{ gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: mutedCol }}>
          {tl('plans.legend') || 'Leyenda'}
        </span>
        {isEditable && (
          <button
            onClick={addItem}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: mutedCol, lineHeight: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = textCol}
            onMouseLeave={e => e.currentTarget.style.color = mutedCol}
            title="Añadir entrada"
          >
            <Plus style={{ width: 12, height: 12 }} />
          </button>
        )}
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Color swatch — editable */}
            <input
              type="color"
              value={item.color}
              disabled={!isEditable}
              onChange={e => updateItem(i, { color: e.target.value })}
              style={{
                width: 14, height: 14, border: 'none', borderRadius: 3,
                padding: 0, cursor: isEditable ? 'pointer' : 'default',
                flexShrink: 0, backgroundColor: 'transparent',
              }}
              title={item.color}
            />
            {/* Label */}
            {isEditable && editIdx === i ? (
              <input
                autoFocus
                value={item.label}
                onChange={e => updateItem(i, { label: e.target.value })}
                onBlur={() => setEditIdx(null)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditIdx(null) }}
                placeholder="Etiqueta..."
                style={{
                  flex: 1, fontSize: 11, background: 'none',
                  border: 'none', borderBottom: `1px solid ${mutedCol}`,
                  outline: 'none', color: textCol, padding: '0 0 1px',
                }}
              />
            ) : (
              <span
                onClick={() => isEditable && setEditIdx(i)}
                style={{
                  flex: 1, fontSize: 11, color: item.label ? textCol : mutedCol,
                  cursor: isEditable ? 'pointer' : 'default',
                  fontStyle: item.label ? 'normal' : 'italic',
                }}
              >
                {item.label || (isEditable ? 'Sin etiqueta' : '')}
              </span>
            )}
            {/* Delete */}
            {isEditable && (
              <button
                onClick={() => deleteItem(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: mutedCol, lineHeight: 0, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                onMouseLeave={e => e.currentTarget.style.color = mutedCol}
              >
                <Trash2 style={{ width: 10, height: 10 }} />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && isEditable && (
          <span style={{ fontSize: 10, color: mutedCol, fontStyle: 'italic' }}>Pulsa + para añadir</span>
        )}
      </div>
    </div>
  )
}

const LABEL_W_MIN     = 120
const LABEL_W_DEFAULT = 200
const DAY_PX_MIN = 3
const DAY_PX_MAX = 80
const ZOOM_PRESETS = [
  { label: 'Día',    dayPx: 40 },
  { label: 'Semana', dayPx: 18 },
  { label: 'Mes',    dayPx: 8  },
]

function clampDayPx(v) {
  return Math.max(DAY_PX_MIN, Math.min(DAY_PX_MAX, v))
}

function buildMonthHeaders(planStart, totalDays, baseDayPx, monthScales, locale) {
  const headers = []
  let cursor = new Date(planStart + 'T00:00:00')
  let pixelLeft = 0
  let dayOffset = 0

  while (dayOffset < totalDays + 14) {
    const year  = cursor.getFullYear()
    const month = cursor.getMonth()
    const nextMonth = new Date(year, month + 1, 1)
    const daysInSlice = Math.round((nextMonth - cursor) / 86400000)
    const clampedDays = Math.min(daysInSlice, totalDays + 14 - dayOffset)
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const mDayPx = clampDayPx(baseDayPx * (monthScales[monthKey] ?? 1))

    headers.push({
      label:     cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
      left:      pixelLeft,
      width:     clampedDays * mDayPx,
      days:      clampedDays,
      dayPx:     mDayPx,
      monthKey,
      startDate: localDateStr(cursor),
    })

    pixelLeft += daysInSlice * mDayPx
    dayOffset += daysInSlice
    cursor = nextMonth
  }
  return headers
}

function buildWeekMarkers(planStart, totalDays, dayPx) {
  const markers = []
  // Find first Monday on or before planStart
  let cursor = new Date(planStart + 'T00:00:00')
  const dow = cursor.getDay()
  const daysToMonday = dow === 0 ? -6 : 1 - dow
  cursor.setDate(cursor.getDate() + daysToMonday)

  while (true) {
    const dayOffset = daysBetween(planStart, cursor.toISOString().slice(0, 10))
    if (dayOffset > totalDays + 7) break
    if (dayOffset >= -7) {
      markers.push({ left: dayOffset * dayPx, label: cursor.getDate() })
    }
    cursor.setDate(cursor.getDate() + 7)
  }
  return markers
}

export default function GanttChart({
  plan,
  phases,
  isEditable = false,
  snapshots = [],
  activeSnapshotId = null,
  onMove,
  onResize,
  onUpdatePhase,
  onOpenCalendar,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderPhases,
  onUpdatePlan,
  onDayPxChange,
  onMonthScalesChange,
  forcedMonthScales = null,
  compact = false,
  printMode = false,
  forceDayPx = null,
  forceLabelW = null,
}) {
  const { lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const [dayPxState, setDayPxState] = useState(18)
  const [monthScalesState, setMonthScalesState] = useState({})
  const [labelW,     setLabelW]     = useState(LABEL_W_DEFAULT)
  const hasAutoFitted = useRef(false)

  // Effective values: forceDayPx / forceLabelW override internal state (used in printMode)
  const dayPx       = forceDayPx  ?? dayPxState
  const effectiveLW = forceLabelW ?? labelW

  const monthScales = forcedMonthScales ?? monthScalesState

  function setZoom(v) {
    const next = clampDayPx(Math.round(v))
    setDayPxState(next)
    onDayPxChange?.(next)
  }
  function zoomIn()  { setZoom(dayPxState * 1.4) }
  function zoomOut() { setZoom(dayPxState / 1.4) }

  function handleMonthResizeStart(e, mh) {
    e.preventDefault()
    const startX = e.clientX
    function onMouseMove(me) {
      const newWidth = Math.max(mh.days * 1, mh.width + (me.clientX - startX))
      const newScale = Math.max(0.1, (newWidth / mh.days) / dayPx)
      setMonthScalesState(s => {
        const next = { ...s, [mh.monthKey]: newScale }
        onMonthScalesChange?.(next)
        return next
      })
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const [resizing, setResizing] = useState(false)
  const scrollRef = useRef(null)

  // Auto-fit: on first render with data, scale so all phases fill the container width
  useEffect(() => {
    if (forceDayPx !== null || hasAutoFitted.current || compact || !plan || !phases || phases.length === 0) return
    if (!scrollRef.current) return
    const containerW = scrollRef.current.clientWidth
    if (containerW <= 0) return
    const planStart = plan.start_date
    const lastEnd = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, planStart)
    const total = Math.max(daysBetween(planStart, lastEnd) + 1, 14)
    const fitted = Math.floor((containerW - effectiveLW - 14 * 18) / total)
    if (fitted > 0) {
      setDayPxState(clampDayPx(fitted))
      hasAutoFitted.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, phases])

  // Print-mode color theme
  const t = printMode ? {
    bg:          'white',
    headerBg:    '#f5f5f5',
    border:      '1px solid rgba(0,0,0,0.12)',
    borderFaint: '1px solid rgba(0,0,0,0.07)',
    monthBorder: '2px solid rgba(0,0,0,0.18)',
    monthLine:   'rgba(0,0,0,0.14)',
    textMuted:   '#555',
    textFaint:   '#aaa',
    gridLine:    'rgba(0,0,0,0.06)',
  } : {
    bg:          '#111111',
    headerBg:    '#111111',
    border:      '1px solid rgba(255,255,255,0.06)',
    borderFaint: '1px solid rgba(255,255,255,0.04)',
    monthBorder: '2px solid rgba(255,255,255,0.12)',
    monthLine:   'rgba(255,255,255,0.08)',
    textMuted:   '#6e6e73',
    textFaint:   '#3a3a3a',
    gridLine:    'rgba(255,255,255,0.03)',
  }

  const handleLabelResizeStart = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = labelW
    setResizing(true)

    function onMouseMove(me) {
      const newW = Math.max(LABEL_W_MIN, Math.min(480, startW + (me.clientX - startX)))
      setLabelW(newW)
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      setResizing(false)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [labelW])

  if (!plan || phases.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl"
        style={{
          height: compact ? 120 : 200,
          backgroundColor: '#111111',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#3a3a3a',
        }}
      >
        <span className="text-sm">Sin fases — añade una fase para ver el Gantt</span>
      </div>
    )
  }

  // Calculate timeline range
  const planStart   = plan.start_date
  const lastEnd     = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, planStart)
  const totalDays   = Math.max(daysBetween(planStart, lastEnd) + 1, 14)

  const monthHeaders = buildMonthHeaders(planStart, totalDays, dayPx, monthScales, locale)
  const lastMH       = monthHeaders[monthHeaders.length - 1]
  const canvasW      = lastMH ? lastMH.left + lastMH.width : totalDays * dayPx

  // Today marker
  const todayStr  = localDateStr(new Date())
  const todayLeft = mhDateToPixel(todayStr, monthHeaders)

  const weekMarkers = buildWeekMarkers(planStart, totalDays, dayPx)

  const totalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)

  // Build a map of phase_id → snapshot phase for the active baseline
  const activeSnapshot  = snapshots.find(s => s.id === activeSnapshotId) ?? null
  const baselineMap     = activeSnapshot
    ? Object.fromEntries((activeSnapshot.plan_snapshot_phases || []).map(sp => [sp.phase_id, sp]))
    : {}

  return (
    <div className="flex flex-col" style={{ height: 'auto' }}>
      {/* Top bar: zoom + stats */}
      {!compact && (
        <div className="flex items-center justify-between mb-3 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#6e6e73' }}>Zoom:</span>
            {/* Preset quick-jump buttons */}
            <div className="flex gap-0.5 p-1 rounded-xl" style={{ backgroundColor: '#111111' }}>
              {ZOOM_PRESETS.map(z => {
                const active = dayPx === z.dayPx
                return (
                  <button
                    key={z.label}
                    onClick={() => setDayPxState(z.dayPx)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: active ? '#2a2a2a' : 'transparent',
                      color: active ? '#f5f5f7' : '#6e6e73',
                    }}
                  >
                    {z.label}
                  </button>
                )
              })}
            </div>
            {/* Fine zoom controls */}
            <div className="flex gap-0.5 p-1 rounded-xl" style={{ backgroundColor: '#111111' }}>
              <button
                onClick={zoomOut}
                disabled={dayPx <= DAY_PX_MIN}
                className="flex items-center justify-center rounded-lg transition-all"
                style={{
                  width: 28, height: 28,
                  color: dayPx <= DAY_PX_MIN ? '#3a3a3a' : '#6e6e73',
                  cursor: dayPx <= DAY_PX_MIN ? 'not-allowed' : 'pointer',
                }}
                title="Alejar"
                onMouseEnter={e => { if (dayPx > DAY_PX_MIN) e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { e.currentTarget.style.color = dayPx <= DAY_PX_MIN ? '#3a3a3a' : '#6e6e73' }}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={zoomIn}
                disabled={dayPx >= DAY_PX_MAX}
                className="flex items-center justify-center rounded-lg transition-all"
                style={{
                  width: 28, height: 28,
                  color: dayPx >= DAY_PX_MAX ? '#3a3a3a' : '#6e6e73',
                  cursor: dayPx >= DAY_PX_MAX ? 'not-allowed' : 'pointer',
                }}
                title="Acercar"
                onMouseEnter={e => { if (dayPx < DAY_PX_MAX) e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { e.currentTarget.style.color = dayPx >= DAY_PX_MAX ? '#3a3a3a' : '#6e6e73' }}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {totalHours > 0 && (
            <span className="text-xs" style={{ color: '#6e6e73' }}>
              Total: <span style={{ color: '#f5f5f7', fontWeight: 600 }}>{totalHours}h</span>
            </span>
          )}
        </div>
      )}

      {/* Gantt scroll container */}
      <div
        ref={scrollRef}
        className="gantt-scroll-container overflow-x-auto rounded-2xl"
        style={{
          backgroundColor: t.bg,
          border: t.border,
        }}
      >
        <div style={{ minWidth: effectiveLW + canvasW, position: 'relative' }}>

          {/* ── Header: month labels ─────────────────────────── */}
          <div
            className={printMode ? 'flex' : 'flex sticky top-0 z-10'}
            style={{
              backgroundColor: t.headerBg,
              borderBottom: t.border,
              height: 32,
              cursor: resizing ? 'col-resize' : 'auto',
            }}
          >
            {/* Label column placeholder + resize handle */}
            <div style={{ width: effectiveLW, minWidth: effectiveLW, position: 'relative', borderRight: t.border }}>
              {/* Resize grip — hidden in print mode */}
              {!printMode && (
                <div
                  style={{
                    position: 'absolute', right: -4, top: 0, bottom: 0, width: 8,
                    cursor: 'col-resize', zIndex: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseDown={handleLabelResizeStart}
                  title="Arrastra para ajustar el ancho de la columna"
                >
                  <div style={{
                    width: 2, height: 16, borderRadius: 2,
                    backgroundColor: resizing ? 'rgba(255,255,255,0.3)' : 'transparent',
                    transition: 'background-color 0.15s',
                  }} className="resize-grip-line" />
                </div>
              )}
            </div>
            {/* Month cells */}
            <div className="relative flex-1">
              {/* Labels */}
              {monthHeaders.map((mh, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex items-center"
                  style={{ left: mh.left, width: mh.width, paddingLeft: 8, overflow: 'hidden' }}
                >
                  <span
                    className="text-xs font-medium capitalize"
                    style={{ color: t.textMuted, whiteSpace: 'nowrap' }}
                  >
                    {mh.label}
                  </span>
                </div>
              ))}
              {/* Separators — draggable to resize zoom */}
              {monthHeaders.map((mh, i) => (
                <div
                  key={`sep-${i}`}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: mh.left + mh.width - 3,
                    width: 8,
                    cursor: printMode ? 'default' : 'col-resize',
                    zIndex: 6,
                  }}
                  onMouseDown={printMode ? undefined : e => handleMonthResizeStart(e, mh)}
                >
                  <div className="absolute top-0 bottom-0" style={{ left: 3, width: 2, backgroundColor: t.monthLine, pointerEvents: 'none' }} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Sub-header: week markers ─────────────────────── */}
          {dayPx >= 24 && (
            <div
              className={printMode ? 'flex' : 'flex sticky z-10'}
              style={{
                top: 32,
                backgroundColor: t.headerBg,
                borderBottom: t.border,
                height: 20,
              }}
            >
              <div style={{ width: effectiveLW, minWidth: effectiveLW, borderRight: t.border }} />
              <div className="relative flex-1">
                {weekMarkers.map((wm, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 flex items-center"
                    style={{ left: wm.left, borderLeft: t.borderFaint, paddingLeft: 4 }}
                  >
                    <span className="text-xs" style={{ color: t.textFaint }}>{wm.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Phase rows ───────────────────────────────────── */}
          <div className="relative" id="gantt-rows-container">
            {/* Today marker — hidden in print */}
            {!printMode && todayOffset >= 0 && todayOffset <= totalDays + 14 && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: effectiveLW + todayLeft, width: 1.5, backgroundColor: '#ff453a', opacity: 0.7 }}
              >
                <div
                  className="absolute -top-1 -translate-x-1/2 text-xs px-1 rounded"
                  style={{ backgroundColor: '#ff453a', color: '#fff', fontSize: 10 }}
                >
                  hoy
                </div>
              </div>
            )}

            {/* Column grid lines — months only */}
            {monthHeaders.map((mh, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: effectiveLW + mh.left + mh.width, width: 2, backgroundColor: t.monthLine }}
              />
            ))}


            {phases.map((phase, idx) => (
              <div
                key={phase.id}
                style={{ borderBottom: idx < phases.length - 1 ? t.borderFaint : 'none' }}
              >
                <PlanPhaseRow
                  phase={phase}
                  monthHeaders={monthHeaders}
                  labelW={effectiveLW}
                  baselinePhase={baselineMap[phase.id] ?? null}
                  isEditable={isEditable}
                  printMode={printMode}
                  isFirst={idx === 0}
                  isLast={idx === phases.length - 1}
                  onMove={onMove}
                  onResize={onResize}
                  onUpdate={onUpdatePhase}
                  onOpenCalendar={onOpenCalendar}
                  onAddTask={onAddTask}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  onMoveUp={() => {
                    if (idx === 0 || !onReorderPhases) return
                    const next = [...phases]
                    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                    onReorderPhases(next)
                  }}
                  onMoveDown={() => {
                    if (idx === phases.length - 1 || !onReorderPhases) return
                    const next = [...phases]
                    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                    onReorderPhases(next)
                  }}
                />
              </div>
            ))}
          </div>

          {/* Legend */}
          <LegendPanel
            items={plan.legend || []}
            isEditable={isEditable && !!onUpdatePlan}
            onUpdate={items => onUpdatePlan?.({ legend: items })}
            printMode={printMode}
          />

        </div>
      </div>
    </div>
  )
}
