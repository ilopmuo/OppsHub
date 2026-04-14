import { useState } from 'react'
import { X } from 'lucide-react'
import { workingDaysBetween } from '../hooks/usePlan'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function getMonthsInRange(startStr, endStr) {
  const months = []
  const d   = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr   + 'T00:00:00')
  d.setDate(1)
  while (d <= end) {
    months.push({ year: d.getFullYear(), month: d.getMonth() })
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function PlanPhaseCalendar({ phase, onClose }) {
  const [hoveredDay, setHoveredDay] = useState(null)

  const rangeStart = new Date(phase.start_date + 'T00:00:00')
  const rangeEnd   = new Date(phase.end_date   + 'T00:00:00')
  const todayStr   = new Date().toISOString().slice(0, 10)
  const hpd        = phase.hours_per_day ?? 8

  const months      = getMonthsInRange(phase.start_date, phase.end_date)
  const workingDays = workingDaysBetween(phase.start_date, phase.end_date)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#111',
          border: '1px solid rgba(255,255,255,0.1)',
          width: 312,
          maxHeight: '85vh',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: phase.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#f5f5f7' }}>
              {phase.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>
              {phase.start_date} → {phase.end_date}
              {' · '}{workingDays} días laborables
              {phase.hours > 0 ? ` · ${phase.hours}h` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
            onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Calendar body — scrollable if phase spans many months */}
        <div className="overflow-y-auto px-5 py-4 space-y-6">
          {months.map(({ year, month }) => {
            const days    = getDaysInMonth(year, month)
            const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0

            return (
              <div key={`${year}-${month}`}>
                {/* Month title */}
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: '#6e6e73' }}
                >
                  {MONTH_NAMES[month]} {year}
                </p>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map((l, i) => (
                    <div
                      key={l}
                      className="text-center py-1"
                      style={{ color: i >= 5 ? '#2a2a2a' : '#3a3a3a', fontSize: 10 }}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-y-1">
                  {/* Empty cells before the 1st */}
                  {Array.from({ length: firstDow }).map((_, i) => (
                    <div key={`e${i}`} />
                  ))}

                  {days.map(date => {
                    const dateStr  = date.toISOString().slice(0, 10)
                    const inRange  = date >= rangeStart && date <= rangeEnd
                    const dow      = date.getDay()
                    const isWeekend = dow === 0 || dow === 6
                    const isWorking = inRange && !isWeekend
                    const isToday   = dateStr === todayStr

                    // Styles
                    let bg         = 'transparent'
                    let color      = '#242424'
                    let borderClr  = 'transparent'
                    let fontWeight = 400

                    if (isWorking) {
                      bg         = phase.color + '28'  // ~16 % opacity
                      color      = '#f5f5f7'
                      borderClr  = phase.color + '60'
                      fontWeight = 600
                    } else if (inRange && isWeekend) {
                      // Weekend inside range: visible but clearly inactive
                      color = '#3a3a3a'
                    }

                    // Today ring overrides border
                    if (isToday) {
                      borderClr = isWorking ? phase.color : 'rgba(255,255,255,0.25)'
                    }

                    return (
                      <div
                        key={dateStr}
                        className="relative flex items-center justify-center rounded-lg"
                        style={{
                          height: 30,
                          backgroundColor: bg,
                          color,
                          border: `1px solid ${borderClr}`,
                          fontWeight,
                          fontSize: 11,
                          cursor: isWorking ? 'default' : 'default',
                        }}
                        onMouseEnter={() => isWorking && setHoveredDay(dateStr)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        {date.getDate()}

                        {/* Dot under today */}
                        {isToday && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 3,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 3,
                              height: 3,
                              borderRadius: '50%',
                              backgroundColor: isWorking ? phase.color : 'rgba(255,255,255,0.4)',
                            }}
                          />
                        )}

                        {/* Hours tooltip on hover */}
                        {hoveredDay === dateStr && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 5px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              backgroundColor: '#1c1c1e',
                              border: `1px solid ${phase.color}80`,
                              borderRadius: 6,
                              padding: '2px 7px',
                              fontSize: 10,
                              fontWeight: 600,
                              color: '#f5f5f7',
                              whiteSpace: 'nowrap',
                              zIndex: 20,
                              pointerEvents: 'none',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                            }}
                          >
                            {hpd}h
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Legend */}
          <div className="flex items-center gap-4 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: phase.color + '28', border: `1px solid ${phase.color}60` }}
              />
              <span className="text-xs" style={{ color: '#3a3a3a' }}>Día laborable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'transparent', border: '1px solid transparent' }}>
                <span style={{ color: '#3a3a3a', fontSize: 9 }}>S</span>
              </div>
              <span className="text-xs" style={{ color: '#2a2a2a' }}>Fin de semana</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
