import { useState, useRef, useLayoutEffect } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Flag } from 'lucide-react'
import PlanPhaseTaskList from './PlanPhaseTaskList'
import { daysBetween, addDays, computePhaseStatus } from '../hooks/usePlan'

const STATUS_COLORS = { at_risk: '#ff9f0a', delayed: '#ff453a', on_track: null }

export default function PlanPhaseRow({
  phase,
  planStartDate,
  totalDays,
  dayPx,
  labelW,
  baselinePhase,
  isEditable,
  onMove,
  onResize,
  onUpdate,
  onOpenCalendar,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
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

  const offset = daysBetween(planStartDate, phase.start_date)
  const width  = daysBetween(phase.start_date, phase.end_date) + 1
  const left   = offset * dayPx
  const barW   = Math.max(width * dayPx, dayPx)

  // ── Drag (move) ───────────────────────────────────────────
  function handleDragStart(e) {
    if (!isEditable) return
    e.preventDefault()
    const startX = e.clientX
    let moved = false

    function onMouseMove(me) {
      if (Math.abs(me.clientX - startX) > 5) moved = true
    }
    function onMouseUp(me) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (!moved) { onOpenCalendar?.(phase); return }
      const delta = Math.round((me.clientX - startX) / dayPx)
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
    const startX = e.clientX

    function onMouseMove() {}
    function onMouseUp(me) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      const deltaDays = Math.round((me.clientX - startX) / dayPx)
      if (deltaDays !== 0) {
        const newEnd = addDays(phase.end_date, deltaDays)
        if (newEnd >= phase.start_date) onResize(phase.id, newEnd)
      }
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

  const baselineOffset = baselinePhase ? daysBetween(planStartDate, baselinePhase.start_date) : 0
  const baselineWidth  = baselinePhase ? daysBetween(baselinePhase.start_date, baselinePhase.end_date) + 1 : 0
  const baselineLeft   = baselineOffset * dayPx
  const baselineBarW   = Math.max(baselineWidth * dayPx, dayPx)

  const color = phase.color || '#bf5af2'

  return (
    <div>
      {/* ── Row ─────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ height: 44 }}>

        {/* Label column */}
        <div
          className="flex items-center gap-2 shrink-0 pr-3"
          style={{ width: LABEL_W, minWidth: LABEL_W }}
        >
          {isEditable && (
            <div
              ref={dragRef}
              className="cursor-grab active:cursor-grabbing p-1 rounded"
              style={{ color: '#3a3a3a' }}
              onMouseEnter={e => e.currentTarget.style.color = '#6e6e73'}
              onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
            >
              <GripVertical className="w-3 h-3" />
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
              className="text-xs truncate"
              style={{ color: '#f5f5f7', fontWeight: 500 }}
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
            <span className="text-xs shrink-0" style={{ color: '#6e6e73' }}>{phase.hours}h</span>
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
                left:      left + dayPx / 2 - 10,
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
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-lg flex items-center overflow-hidden"
              style={{
                left:   left,
                width:  barW,
                height: 28,
                zIndex: 1,
                background: progress > 0
                  ? `linear-gradient(to right, ${color} ${progress}%, ${color}55 ${progress}%)`
                  : color,
                cursor: isEditable ? 'grab' : 'default',
                userSelect: 'none',
                boxShadow: statusColor
                  ? `0 2px 8px ${color}40, inset 0 0 0 1.5px ${statusColor}`
                  : `0 2px 8px ${color}40`,
              }}
              onMouseDown={isEditable ? handleDragStart : undefined}
              title={`${phase.start_date} → ${phase.end_date}${phase.hours ? ` · ${phase.hours}h` : ''}${progress > 0 ? ` · ${progress}%` : ''}`}
            >
              {barW > 80 && (
                <span
                  className="px-2.5 text-xs font-medium truncate pointer-events-none"
                  style={{ color: '#000', opacity: 0.8 }}
                >
                  {width}d{phase.hours > 0 ? ` · ${phase.hours}h` : ''}{progress > 0 ? ` · ${progress}%` : ''}
                </span>
              )}

              {/* Task completion stripe */}
              {totalTasks > 0 && barW > 60 && (
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
