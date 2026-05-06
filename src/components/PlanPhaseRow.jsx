import { useState, useRef, useLayoutEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Flag } from 'lucide-react'
import PlanPhaseTaskList from './PlanPhaseTaskList'
import { daysBetween, addDays, computePhaseStatus, mhDateToPixel, mhPixelToDate } from '../hooks/usePlan'

const STATUS_COLORS = { at_risk: '#ff9f0a', delayed: '#ff453a', on_track: null }

export default function PlanPhaseRow({
  phase,
  monthHeaders,
  labelW,
  baselinePhase,
  isEditable,
  printMode = false,
  isFirst,
  isLast,
  onMove,
  onResize,
  onUpdate,
  onOpenCalendar,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onMoveUp,
  onMoveDown,
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [tooltipPos,  setTooltipPos]  = useState(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const dragRef   = useRef(null)
  const resizeRef = useRef(null)
  const nameRef   = useRef(null)

  useLayoutEffect(() => {
    if (nameRef.current) {
      setIsTruncated(nameRef.current.scrollWidth > nameRef.current.clientWidth)
    }
  })

  const LABEL_W = labelW ?? 200
  const mh = monthHeaders ?? []

  const width  = daysBetween(phase.start_date, phase.end_date) + 1
  const left   = mhDateToPixel(phase.start_date, mh)
  const endPx  = mhDateToPixel(addDays(phase.end_date, 1), mh)
  const barW   = Math.max(endPx - left, mh[0]?.dayPx ?? 4)

  // ── Drag (move) ───────────────────────────────────────────
  function handleDragStart(e) {
    if (!isEditable) return
    e.preventDefault()
    const startX    = e.clientX
    const startLeft = left
    let moved = false

    function onMouseMove(me) {
      if (Math.abs(me.clientX - startX) > 5) moved = true
    }
    function onMouseUp(me) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (!moved) { onOpenCalendar?.(phase); return }
      const newDate = mhPixelToDate(Math.max(0, startLeft + (me.clientX - startX)), mh)
      const delta = daysBetween(phase.start_date, newDate)
      if (delta !== 0) onMove(phase.id, delta)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // ── Resize ────────────────────────────────────────────────
  function handleResizeStart(e) {
    if (!isEditable) return
    e.preventDefault()
    e.stopPropagation()
    const startX   = e.clientX
    const startEnd = endPx

    function onMouseMove() {}
    function onMouseUp(me) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      const newEndPx  = startEnd + (me.clientX - startX)
      const newEndDate = mhPixelToDate(newEndPx, mh)
      // endPx is start of next day; subtract 1 day to get actual end date
      const newEnd = addDays(newEndDate, -1)
      if (newEnd >= phase.start_date) onResize(phase.id, newEnd)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // ── Computed values ───────────────────────────────────────
  const effectiveStatus = computePhaseStatus(phase)
  const statusColor     = STATUS_COLORS[effectiveStatus] ?? null
  const isAutoStatus    = effectiveStatus !== (phase.status ?? 'on_track') && effectiveStatus !== null

  const hasTasks   = phase.plan_tasks && phase.plan_tasks.length > 0
  const doneTasks  = (phase.plan_tasks || []).filter(t => t.done).length
  const totalTasks = (phase.plan_tasks || []).length
  const progress   = phase.progress ?? 0

  // Baseline ghost bar
  const startDev     = baselinePhase ? daysBetween(baselinePhase.start_date, phase.start_date) : 0
  const endDev       = baselinePhase ? daysBetween(baselinePhase.end_date,   phase.end_date)   : 0
  const hasDeviation = !phase.is_milestone && baselinePhase && (startDev !== 0 || endDev !== 0)

  const baselineLeft = baselinePhase ? mhDateToPixel(baselinePhase.start_date, mh) : 0
  const baselineBarW = baselinePhase
    ? Math.max(mhDateToPixel(addDays(baselinePhase.end_date, 1), mh) - baselineLeft, mh[0]?.dayPx ?? 4)
    : 0

  const color = phase.color || '#bf5af2'

  return (
    <div>
      {/* ── Row ─────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ height: 44, alignItems: printMode ? 'center' : undefined }}>

        {/* Label column */}
        <div
          className="flex items-center gap-2 shrink-0 pr-3"
          style={{ width: LABEL_W, minWidth: LABEL_W }}
        >
          {isEditable && (
            <div className="flex flex-col shrink-0" style={{ gap: 1 }}>
              <button
                onClick={onMoveUp}
                disabled={isFirst}
                style={{ color: isFirst ? '#2a2a2a' : '#3a3a3a', lineHeight: 0, background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer', padding: 1 }}
                onMouseEnter={e => { if (!isFirst) e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { if (!isFirst) e.currentTarget.style.color = '#3a3a3a' }}
                title="Mover arriba"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={isLast}
                style={{ color: isLast ? '#2a2a2a' : '#3a3a3a', lineHeight: 0, background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer', padding: 1 }}
                onMouseEnter={e => { if (!isLast) e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { if (!isLast) e.currentTarget.style.color = '#3a3a3a' }}
                title="Mover abajo"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 min-w-0 flex-1"
            style={{ color: '#f5f5f7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {/* Milestone icon or expand chevron */}
            {phase.is_milestone ? (
              <div
                className="w-3 h-3 shrink-0"
                style={{
                  width: 9, height: 9,
                  transform: 'rotate(45deg)',
                  backgroundColor: color,
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              />
            ) : totalTasks > 0 ? (
              expanded
                ? <ChevronDown  className="w-3 h-3 shrink-0" style={{ color: '#6e6e73' }} />
                : <ChevronRight className="w-3 h-3 shrink-0" style={{ color: '#6e6e73' }} />
            ) : (
              <span className="w-3 h-3 shrink-0" />
            )}

            <span
              ref={nameRef}
              className={printMode ? 'text-xs' : 'text-xs truncate'}
              style={{
                color: printMode ? '#111' : '#f5f5f7',
                fontWeight: 500,
                ...(printMode && { whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.25, fontSize: 10 }),
              }}
              onMouseEnter={e => {
                if (isTruncated) {
                  const r = e.currentTarget.getBoundingClientRect()
                  setTooltipPos({ x: r.left, y: r.top })
                }
              }}
              onMouseLeave={() => setTooltipPos(null)}
            >{phase.name}</span>

            {tooltipPos && (
              <div style={{
                position: 'fixed', left: tooltipPos.x, top: tooltipPos.y - 34,
                backgroundColor: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#f5f5f7',
                whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}>
                {phase.name}
              </div>
            )}
          </button>

          {phase.is_sprint && (
            <Flag className="w-3 h-3 shrink-0" style={{ color: '#ff9f0a' }} title="Sprint" />
          )}

          {/* Auto-detected or manual status dot */}
          {statusColor && (
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: statusColor }}
              title={
                isAutoStatus
                  ? `${effectiveStatus === 'delayed' ? 'Retrasado (auto)' : 'En riesgo (auto)'}`
                  : effectiveStatus === 'at_risk' ? 'En riesgo' : 'Retrasado'
              }
            />
          )}

          {/* Deviation or hours */}
          {hasDeviation ? (
            <span
              className="text-xs shrink-0 font-bold"
              style={{ color: startDev > 0 ? '#ff453a' : '#30d158' }}
              title={startDev > 0
                ? `Retrasado ${startDev}d respecto al plan base`
                : `Adelantado ${Math.abs(startDev)}d respecto al plan base`}
            >
              {startDev > 0 ? `+${startDev}d` : `${startDev}d`}
            </span>
          ) : !phase.is_milestone && phase.hours > 0 ? (
            <span className="text-xs shrink-0" style={{ color: printMode ? '#666' : '#6e6e73' }}>{phase.hours}h</span>
          ) : null}
        </div>

        {/* Bar area */}
        <div className="relative flex-1" style={{ height: '100%' }}>

          {/* Ghost bar (baseline) */}
          {hasDeviation && (
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-lg pointer-events-none"
              style={{
                left: baselineLeft, width: baselineBarW, height: 28, zIndex: 0,
                backgroundColor: color + '18',
                border: `1.5px dashed ${color}55`,
              }}
              title={`Plan base: ${baselinePhase.start_date} → ${baselinePhase.end_date}`}
            />
          )}

          {phase.is_milestone ? (
            /* ── Milestone diamond ─────────────────────────── */
            <div
              className="absolute"
              style={{
                left:      left + (mh[0]?.dayPx ?? 4) / 2 - 10,
                top:       '50%',
                width:     20,
                height:    20,
                transform: 'translateY(-50%) rotate(45deg)',
                backgroundColor: color,
                boxShadow: statusColor
                  ? `0 2px 10px ${color}60, inset 0 0 0 1.5px ${statusColor}`
                  : `0 2px 10px ${color}60`,
                cursor:    isEditable ? 'grab' : 'default',
                userSelect: 'none',
                zIndex:    1,
              }}
              onMouseDown={isEditable ? handleDragStart : undefined}
              title={`${phase.name} · ${phase.start_date}`}
            />
          ) : (
            /* ── Regular bar ───────────────────────────────── */
            <>
              <div
                className="absolute top-1/2 -translate-y-1/2 rounded-lg flex items-center overflow-hidden"
                style={{
                  left:   left,
                  width:  barW,
                  height: 28,
                  zIndex: 1,
                  background: progress === 100
                    ? color
                    : progress > 0
                      ? `linear-gradient(to right, ${color} ${progress}%, ${color}44 ${progress}%)`
                      : `${color}44`,
                  cursor: isEditable ? 'grab' : 'default',
                  userSelect: 'none',
                  boxShadow: statusColor
                    ? `0 2px 8px ${color}40, inset 0 0 0 1.5px ${statusColor}`
                    : `0 2px 8px ${color}40`,
                }}
                onMouseDown={isEditable ? handleDragStart : undefined}
                title={`${phase.start_date} → ${phase.end_date}${phase.hours ? ` · ${phase.hours}h` : ''}${progress > 0 ? ` · ${progress}%` : ''}`}
              >
                {/* Task completion stripe */}
                {totalTasks > 0 && (
                  <div
                    className="absolute bottom-0 left-0 rounded-b-lg"
                    style={{
                      width: `${(doneTasks / totalTasks) * 100}%`,
                      height: 3,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                    }}
                  />
                )}

                {/* Resize handle */}
                {isEditable && (
                  <div
                    ref={resizeRef}
                    className="absolute right-0 top-0 bottom-0 w-3 rounded-r-lg flex items-center justify-center"
                    style={{ cursor: 'ew-resize', color: 'rgba(0,0,0,0.5)' }}
                    onMouseDown={handleResizeStart}
                    title="Arrastra para cambiar duración"
                  >
                    <div className="flex gap-px">
                      <div style={{ width: 1.5, height: 10, backgroundColor: 'currentColor', borderRadius: 1 }} />
                      <div style={{ width: 1.5, height: 10, backgroundColor: 'currentColor', borderRadius: 1 }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Stats label — always visible, to the right of the bar */}
              <span
                className="absolute pointer-events-none"
                style={{
                  left: left + barW + 18,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 10,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  color: printMode ? '#555' : '#6e6e73',
                  zIndex: 2,
                }}
              >
                {width}d{phase.hours > 0 ? ` · ${phase.hours}h` : ''}{progress > 0 ? ` · ${progress}%` : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Expanded tasks */}
      {expanded && (
        <div
          className="ml-0 mb-1"
          style={{ paddingLeft: LABEL_W, borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <PlanPhaseTaskList
            phase={phase}
            isEditable={isEditable}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        </div>
      )}
    </div>
  )
}
