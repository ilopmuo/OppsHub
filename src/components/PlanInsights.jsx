import { daysBetween, computePhaseStatus } from '../hooks/usePlan'

// ── Helpers ────────────────────────────────────────────────────────
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDuration(days) {
  if (days < 30)  return `${days} días`
  const months = Math.round(days / 30.4)
  return months === 1 ? '1 mes' : `${months} meses`
}

// ── Sub-components ─────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p className="text-xs uppercase tracking-wider" style={{ color: '#6e6e73' }}>{label}</p>
      <p
        className="text-2xl font-bold leading-none"
        style={{ color: accent || '#f5f5f7' }}
      >
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#3a3a3a' }}>{sub}</p>}
    </div>
  )
}

function DonutChart({ segments, size = 100, stroke = 22, label, sublabel }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  let cumOffset = 0
  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* track */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke}
          />
          {segments.filter(s => s.pct > 0).map((seg, i) => {
            const dash = (seg.pct / 100) * circ
            const el = (
              <circle
                key={i}
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-cumOffset}
              />
            )
            cumOffset += dash
            return el
          })}
        </svg>
        {/* center label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <span className="text-lg font-bold leading-none" style={{ color: '#f5f5f7' }}>{label}</span>
          {sublabel && <span className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>{sublabel}</span>}
        </div>
      </div>
    </div>
  )
}

function HorizBar({ pct, color, label, valueLabel }) {
  const safe = Math.min(Math.max(pct, 0), 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs truncate" style={{ color: '#6e6e73' }}>{label}</span>
        </div>
        <span className="text-xs font-medium shrink-0 ml-2" style={{ color: '#f5f5f7' }}>{valueLabel}</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${safe}%`, backgroundColor: color, transition: 'width 0.4s ease' }}
        />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────
export default function PlanInsights({ plan, phases }) {
  if (!plan || phases.length === 0) return null

  const nonMilestone = phases.filter(p => !p.is_milestone)
  const milestones   = phases.filter(p => p.is_milestone)

  // Duration
  const planStart = plan.start_date
  const lastEnd   = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, planStart)
  const totalDays = daysBetween(planStart, lastEnd) + 1

  // Overall weighted progress
  const totalDuration = nonMilestone.reduce(
    (s, p) => s + daysBetween(p.start_date, p.end_date) + 1, 0,
  )
  const overallProgress = totalDuration > 0
    ? Math.round(
        nonMilestone.reduce(
          (s, p) => s + (p.progress || 0) * (daysBetween(p.start_date, p.end_date) + 1), 0,
        ) / totalDuration,
      )
    : 0

  // Total hours
  const totalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)

  // Status counts
  const STATUS_META = {
    on_track: { label: 'En plazo',   color: '#30d158' },
    at_risk:  { label: 'En riesgo',  color: '#ff9f0a' },
    delayed:  { label: 'Retrasado',  color: '#ff453a' },
  }
  const statusCounts = { on_track: 0, at_risk: 0, delayed: 0 }
  nonMilestone.forEach(p => {
    const s = computePhaseStatus(p)
    statusCounts[s] = (statusCounts[s] || 0) + 1
  })
  const statusTotal = nonMilestone.length || 1
  const donutSegments = Object.entries(STATUS_META).map(([key, { color }]) => ({
    color,
    pct: (statusCounts[key] / statusTotal) * 100,
  }))
  if (donutSegments.every(s => s.pct === 0)) donutSegments[0].pct = 100

  // Phases sorted by hours (for hours chart)
  const phasesWithHours = [...nonMilestone].filter(p => p.hours > 0)
    .sort((a, b) => b.hours - a.hours)
  const maxHours = phasesWithHours[0]?.hours || 1

  // Progress bar color
  const progressColor = overallProgress >= 75 ? '#30d158'
    : overallProgress >= 40 ? '#ff9f0a'
    : '#ff453a'

  return (
    <div style={{ padding: '0 24px 40px' }}>
      {/* Section title */}
      <div
        className="flex items-center gap-3 mb-5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 28 }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
          Resumen del plan
        </h2>
        <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
        <span className="text-xs" style={{ color: '#3a3a3a' }}>
          {fmtDate(planStart)} → {fmtDate(lastEnd)}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard
          label="Duración total"
          value={fmtDuration(totalDays)}
          sub={`${totalDays} días naturales`}
        />
        <StatCard
          label="Avance global"
          value={`${overallProgress}%`}
          sub="Ponderado por duración"
          accent={progressColor}
        />
        <StatCard
          label="Horas planificadas"
          value={totalHours > 0 ? `${totalHours}h` : '—'}
          sub={totalHours > 0 ? `${Math.round(totalHours / 8)} jornadas` : 'Sin horas asignadas'}
        />
        <StatCard
          label="Fases"
          value={nonMilestone.length}
          sub={milestones.length > 0 ? `+ ${milestones.length} hito${milestones.length > 1 ? 's' : ''}` : `${phases.length} en total`}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '200px 1fr 1fr' }}>

        {/* Status donut */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-4"
          style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs uppercase tracking-wider" style={{ color: '#6e6e73' }}>Estado</p>
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              segments={donutSegments}
              size={100}
              stroke={22}
              label={nonMilestone.length}
              sublabel="fases"
            />
            <div className="w-full space-y-1.5">
              {Object.entries(STATUS_META).map(([key, { label, color }]) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs" style={{ color: '#6e6e73' }}>{label}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: statusCounts[key] > 0 ? color : '#3a3a3a' }}>
                    {statusCounts[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hours by phase */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs uppercase tracking-wider" style={{ color: '#6e6e73' }}>Horas por fase</p>
          {phasesWithHours.length === 0 ? (
            <p className="text-xs" style={{ color: '#3a3a3a' }}>Sin horas asignadas</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {phasesWithHours.slice(0, 8).map(p => (
                <HorizBar
                  key={p.id}
                  pct={(p.hours / maxHours) * 100}
                  color={p.color || '#bf5af2'}
                  label={p.name}
                  valueLabel={`${p.hours}h`}
                />
              ))}
              {phasesWithHours.length > 8 && (
                <p className="text-xs" style={{ color: '#3a3a3a' }}>
                  +{phasesWithHours.length - 8} más
                </p>
              )}
            </div>
          )}
        </div>

        {/* Progress by phase */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs uppercase tracking-wider" style={{ color: '#6e6e73' }}>Avance por fase</p>
          {nonMilestone.length === 0 ? (
            <p className="text-xs" style={{ color: '#3a3a3a' }}>Sin fases</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {nonMilestone.slice(0, 8).map(p => (
                <HorizBar
                  key={p.id}
                  pct={p.progress || 0}
                  color={p.color || '#bf5af2'}
                  label={p.name}
                  valueLabel={`${p.progress || 0}%`}
                />
              ))}
              {nonMilestone.length > 8 && (
                <p className="text-xs" style={{ color: '#3a3a3a' }}>
                  +{nonMilestone.length - 8} más
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
