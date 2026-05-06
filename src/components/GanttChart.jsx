import { useState, useRef, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import PlanPhaseRow from './PlanPhaseRow'
import { daysBetween } from '../hooks/usePlan'
import { useLang } from '../contexts/LanguageContext'

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

function buildMonthHeaders(planStart, totalDays, dayPx, locale) {
  const headers = []
  let cursor = new Date(planStart + 'T00:00:00')
  let dayOffset = 0

  while (dayOffset < totalDays + 7) {
    const year  = cursor.getFullYear()
    const month = cursor.getMonth()
    // Count days until next month
    const nextMonth = new Date(year, month + 1, 1)
    const daysInSlice = Math.round((nextMonth - cursor) / 86400000)
    const clampedDays = Math.min(daysInSlice, totalDays + 7 - dayOffset)

    headers.push({
      label: cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
      left: dayOffset * dayPx,
      width: clampedDays * dayPx,
    })

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
  compact = false,
  printMode = false,
  forceDayPx = null,
  forceLabelW = null,
}) {
  const { lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const [dayPxState, setDayPxState] = useState(18)
  const [labelW,     setLabelW]     = useState(LABEL_W_DEFAULT)
  const hasAutoFitted = useRef(false)

  // Effective values: forceDayPx / forceLabelW override internal state (used in printMode)
  const dayPx       = forceDayPx  ?? dayPxState
  const effectiveLW = forceLabelW ?? labelW

  function zoomIn()  { setDayPxState(v => clampDayPx(Math.round(v * 1.4))) }
  function zoomOut() { setDayPxState(v => clampDayPx(Math.round(v / 1.4))) }
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
    bg:         'white',
    headerBg:   '#f5f5f5',
    border:     '1px solid rgba(0,0,0,0.12)',
    borderFaint:'1px solid rgba(0,0,0,0.07)',
    textMuted:  '#555',
    textFaint:  '#aaa',
    gridLine:   'rgba(0,0,0,0.06)',
  } : {
    bg:         '#111111',
    headerBg:   '#111111',
    border:     '1px solid rgba(255,255,255,0.06)',
    borderFaint:'1px solid rgba(255,255,255,0.04)',
    textMuted:  '#6e6e73',
    textFaint:  '#3a3a3a',
    gridLine:   'rgba(255,255,255,0.03)',
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
  const planStart  = plan.start_date
  const lastEnd    = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, planStart)
  const totalDays  = Math.max(daysBetween(planStart, lastEnd) + 1, 14)
  const canvasW    = (totalDays + 14) * dayPx // extra 14 days padding right

  // Today marker
  const todayStr   = new Date().toISOString().slice(0, 10)
  const todayOffset = daysBetween(planStart, todayStr)
  const todayLeft  = todayOffset * dayPx

  const monthHeaders = buildMonthHeaders(planStart, totalDays, dayPx, locale)
  const weekMarkers  = buildWeekMarkers(planStart, totalDays, dayPx)

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
              {monthHeaders.map((mh, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex items-center"
                  style={{
                    left: mh.left, width: mh.width,
                    borderRight: t.borderFaint,
                    paddingLeft: 8, overflow: 'hidden',
                  }}
                >
                  <span
                    className="text-xs font-medium capitalize"
                    style={{ color: t.textMuted, whiteSpace: 'nowrap' }}
                  >
                    {mh.label}
                  </span>
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

            {/* Column grid lines */}
            {weekMarkers.map((wm, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: effectiveLW + wm.left, width: 1, backgroundColor: t.gridLine }}
              />
            ))}

            {/* ── Dependency arrows SVG overlay ──────────────── */}
            <svg
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: phases.length * 44,
                pointerEvents: 'none', overflow: 'visible', zIndex: 8,
              }}
            >
              {phases.map((phase, phaseIdx) => {
                if (!phase.depends_on) return null
                const depIdx = phases.findIndex(p => p.id === phase.depends_on)
                if (depIdx === -1) return null
                const dep = phases[depIdx]
                const ROW = 44
                const depOffset = daysBetween(planStart, dep.start_date)
                const depW      = daysBetween(dep.start_date, dep.end_date) + 1
                const x1 = effectiveLW + (depOffset + depW) * dayPx
                const y1 = depIdx * ROW + ROW / 2
                const x2 = effectiveLW + daysBetween(planStart, phase.start_date) * dayPx
                const y2 = phaseIdx * ROW + ROW / 2
                const c  = (dep.color || '#bf5af2') + '70'
                const dx = x2 - x1
                const ah = 7

                // When there's enough horizontal space: S-curve
                // When bars are close/overlapping: L-shaped dogleg routing around
                const THRESHOLD = 60
                let pathD, arrowPoints
                if (dx > THRESHOLD) {
                  const cpOff = dx * 0.45
                  pathD = `M ${x1} ${y1} C ${x1 + cpOff} ${y1}, ${x2 - cpOff} ${y2}, ${x2} ${y2}`
                  arrowPoints = `${x2},${y2} ${x2 - ah * 1.5},${y2 - ah / 2} ${x2 - ah * 1.5},${y2 + ah / 2}`
                } else {
                  const ex = Math.max(x1 + 22, x2 + 22)
                  pathD = `M ${x1} ${y1} L ${ex} ${y1} L ${ex} ${y2} L ${x2} ${y2}`
                  arrowPoints = `${x2},${y2} ${x2 + ah * 1.5},${y2 - ah / 2} ${x2 + ah * 1.5},${y2 + ah / 2}`
                }

                return (
                  <g key={`dep-${phase.id}`}>
                    <path
                      d={pathD}
                      fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round"
                    />
                    <polygon points={arrowPoints} fill={c} />
                  </g>
                )
              })}
            </svg>

            {phases.map((phase, idx) => (
              <div
                key={phase.id}
                style={{ borderBottom: idx < phases.length - 1 ? t.borderFaint : 'none' }}
              >
                <PlanPhaseRow
                  phase={phase}
                  planStartDate={planStart}
                  totalDays={totalDays}
                  dayPx={dayPx}
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

        </div>
      </div>
    </div>
  )
}
