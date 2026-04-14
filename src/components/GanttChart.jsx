import { useState, useRef, useCallback } from 'react'
import PlanPhaseRow from './PlanPhaseRow'
import { daysBetween } from '../hooks/usePlan'

const LABEL_W_MIN     = 120
const LABEL_W_DEFAULT = 200
const ZOOM_LEVELS = [
  { label: 'Día',    dayPx: 40 },
  { label: 'Semana', dayPx: 24 },
  { label: 'Mes',    dayPx: 10 },
]

function buildMonthHeaders(planStart, totalDays, dayPx) {
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
      label: cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
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
  compact = false,
}) {
  const [zoomIdx, setZoomIdx] = useState(1) // default: semana
  const [labelW,  setLabelW]  = useState(LABEL_W_DEFAULT)
  const [resizing, setResizing] = useState(false)
  const scrollRef = useRef(null)

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

  const dayPx = ZOOM_LEVELS[zoomIdx].dayPx

  // Calculate timeline range
  const planStart  = plan.start_date
  const lastEnd    = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, planStart)
  const totalDays  = Math.max(daysBetween(planStart, lastEnd) + 1, 14)
  const canvasW    = (totalDays + 14) * dayPx // extra 14 days padding right

  // Today marker
  const todayStr   = new Date().toISOString().slice(0, 10)
  const todayOffset = daysBetween(planStart, todayStr)
  const todayLeft  = todayOffset * dayPx

  const monthHeaders = buildMonthHeaders(planStart, totalDays, dayPx)
  const weekMarkers  = buildWeekMarkers(planStart, totalDays, dayPx)

  const totalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)

  // Build a map of phase_id → snapshot phase for the active baseline
  const activeSnapshot  = snapshots.find(s => s.id === activeSnapshotId) ?? null
  const baselineMap     = activeSnapshot
    ? Object.fromEntries((activeSnapshot.plan_snapshot_phases || []).map(sp => [sp.phase_id, sp]))
    : {}

  return (
    <div className="flex flex-col" style={{ height: compact ? 'auto' : '100%' }}>
      {/* Top bar: zoom + stats */}
      {!compact && (
        <div className="flex items-center justify-between mb-3 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#6e6e73' }}>Zoom:</span>
            <div className="flex gap-0.5 p-1 rounded-xl" style={{ backgroundColor: '#111111' }}>
              {ZOOM_LEVELS.map((z, i) => (
                <button
                  key={z.label}
                  onClick={() => setZoomIdx(i)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: zoomIdx === i ? '#2a2a2a' : 'transparent',
                    color: zoomIdx === i ? '#f5f5f7' : '#6e6e73',
                  }}
                >
                  {z.label}
                </button>
              ))}
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
          backgroundColor: '#111111',
          border: '1px solid rgba(255,255,255,0.06)',
          flex: compact ? 'none' : 1,
        }}
      >
        <div style={{ minWidth: labelW + canvasW, position: 'relative' }}>

          {/* ── Header: month labels ─────────────────────────── */}
          <div
            className="flex sticky top-0 z-10"
            style={{
              backgroundColor: '#111111',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              height: 32,
              cursor: resizing ? 'col-resize' : 'auto',
            }}
          >
            {/* Label column placeholder + resize handle */}
            <div style={{ width: labelW, minWidth: labelW, position: 'relative', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Resize grip — sits on the right border */}
              <div
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: 8,
                  cursor: 'col-resize',
                  zIndex: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseDown={handleLabelResizeStart}
                title="Arrastra para ajustar el ancho de la columna"
              >
                <div style={{
                  width: 2,
                  height: 16,
                  borderRadius: 2,
                  backgroundColor: resizing ? 'rgba(255,255,255,0.3)' : 'transparent',
                  transition: 'background-color 0.15s',
                }}
                  className="resize-grip-line"
                />
              </div>
            </div>
            {/* Month cells */}
            <div className="relative flex-1">
              {monthHeaders.map((mh, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex items-center"
                  style={{
                    left: mh.left,
                    width: mh.width,
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                    paddingLeft: 8,
                  }}
                >
                  <span
                    className="text-xs font-medium capitalize"
                    style={{ color: '#6e6e73' }}
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
              className="flex sticky z-10"
              style={{
                top: 32,
                backgroundColor: '#111111',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                height: 20,
              }}
            >
              <div style={{ width: labelW, minWidth: labelW, borderRight: '1px solid rgba(255,255,255,0.06)' }} />
              <div className="relative flex-1">
                {weekMarkers.map((wm, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 flex items-center"
                    style={{ left: wm.left, borderLeft: '1px solid rgba(255,255,255,0.04)', paddingLeft: 4 }}
                  >
                    <span className="text-xs" style={{ color: '#3a3a3a' }}>{wm.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Phase rows ───────────────────────────────────── */}
          <div className="relative">
            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalDays + 14 && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{
                  left: labelW + todayLeft,
                  width: 1.5,
                  backgroundColor: '#ff453a',
                  opacity: 0.7,
                }}
              >
                <div
                  className="absolute -top-1 -translate-x-1/2 text-xs px-1 rounded"
                  style={{ backgroundColor: '#ff453a', color: '#fff', fontSize: 10 }}
                >
                  hoy
                </div>
              </div>
            )}

            {/* Column grid lines (one per week) */}
            {weekMarkers.map((wm, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: labelW + wm.left,
                  width: 1,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}
              />
            ))}

            {phases.map((phase, idx) => (
              <div
                key={phase.id}
                style={{
                  borderBottom: idx < phases.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <PlanPhaseRow
                  phase={phase}
                  planStartDate={planStart}
                  totalDays={totalDays}
                  dayPx={dayPx}
                  labelW={labelW}
                  baselinePhase={baselineMap[phase.id] ?? null}
                  isEditable={isEditable}
                  onMove={onMove}
                  onResize={onResize}
                  onUpdate={onUpdatePhase}
                  onOpenCalendar={onOpenCalendar}
                  onAddTask={onAddTask}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                />
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
