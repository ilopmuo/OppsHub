import { Download, TrendingUp, Clock, Layers, Flag, CheckSquare, Calendar } from 'lucide-react'
import { daysBetween, computePhaseStatus } from '../hooks/usePlan'
import { useLang } from '../contexts/LanguageContext'

// ── Themes ─────────────────────────────────────────────────────────────
const DARK = {
  bg:         '#111111',
  bgAlt:      '#0a0a0a',
  border:     '1px solid rgba(255,255,255,0.06)',
  borderFaint:'1px solid rgba(255,255,255,0.04)',
  text:       '#f5f5f7',
  muted:      '#6e6e73',
  faint:      '#3a3a3a',
  track:      'rgba(255,255,255,0.06)',
  trackLine:  'rgba(255,255,255,0.04)',
  divider:    'rgba(255,255,255,0.06)',
}
const LIGHT = {
  bg:         '#f5f5f7',
  bgAlt:      '#ffffff',
  border:     '1px solid #e0e0e0',
  borderFaint:'1px solid #ececec',
  text:       '#111111',
  muted:      '#555555',
  faint:      '#aaaaaa',
  track:      'rgba(0,0,0,0.07)',
  trackLine:  'rgba(0,0,0,0.05)',
  divider:    '#e0e0e0',
}

// ── Date helpers ────────────────────────────────────────────────────────
function fmtDate(iso, locale) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
function fmtDateShort(iso, locale) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric', month: 'short',
  })
}
function fmtDuration(days, i) {
  if (days < 30) return `${days} ${i.days}`
  const months = Math.floor(days / 30.4)
  const rem = days - Math.round(months * 30.4)
  if (rem < 5) return months === 1 ? `1 ${i.month}` : `${months} ${i.months}`
  return `${months}m ${rem}d`
}
function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── Monthly workload builder ─────────────────────────────────────────────
function buildMonthly(nonMilestone, planStart, planEnd, locale) {
  const result = []
  const cur = new Date(planStart + 'T00:00:00')
  cur.setDate(1)
  const endDate = new Date(planEnd + 'T00:00:00')
  const hasHours = nonMilestone.some(p => p.hours > 0)

  while (cur <= endDate) {
    const y  = cur.getFullYear()
    const mo = String(cur.getMonth() + 1).padStart(2, '0')
    const monthStart = `${y}-${mo}-01`
    const lastDay = new Date(y, cur.getMonth() + 1, 0).getDate()
    const monthEnd = `${y}-${mo}-${String(lastDay).padStart(2, '0')}`

    const active = nonMilestone.filter(
      p => p.start_date <= monthEnd && p.end_date >= monthStart,
    )

    let value = active.length
    if (hasHours) {
      value = active.reduce((s, p) => {
        if (!p.hours) return s
        const os = p.start_date > monthStart ? p.start_date : monthStart
        const oe = p.end_date   < monthEnd   ? p.end_date   : monthEnd
        const total   = daysBetween(p.start_date, p.end_date) + 1
        const overlap = daysBetween(os, oe) + 1
        return s + Math.round((p.hours * overlap) / total)
      }, 0)
    }

    result.push({
      label: cur.toLocaleDateString(locale, { month: 'short' }),
      year:  y,
      value,
      activeCount: active.length,
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return result
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent, theme }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1.5"
      style={{ backgroundColor: theme.bg, border: theme.border }}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: theme.muted }} />}
        <p className="text-xs uppercase tracking-wider" style={{ color: theme.muted }}>{label}</p>
      </div>
      <p className="text-2xl font-bold leading-none" style={{ color: accent || theme.text }}>
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: theme.faint }}>{sub}</p>}
    </div>
  )
}

function DonutChart({ segments, size = 130, stroke = 26, label, sublabel, theme }) {
  const r     = (size - stroke) / 2
  const circ  = 2 * Math.PI * r
  let cumOffset = 0
  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={theme.track} strokeWidth={stroke} />
          {segments.filter(s => s.pct > 0).map((seg, i) => {
            const dash = (seg.pct / 100) * circ
            const el = (
              <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
                stroke={seg.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-cumOffset}
                strokeLinecap="round"
              />
            )
            cumOffset += dash
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: 'none' }}>
          <span className="text-xl font-bold leading-none" style={{ color: theme.text }}>{label}</span>
          {sublabel && <span className="text-xs mt-0.5" style={{ color: theme.muted }}>{sublabel}</span>}
        </div>
      </div>
    </div>
  )
}

function HorizBar({ pct, color, label, valueLabel, theme }) {
  const safe = Math.min(Math.max(pct, 0), 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs truncate" style={{ color: theme.muted }}>{label}</span>
        </div>
        <span className="text-xs font-semibold shrink-0 ml-2 tabular" style={{ color: theme.text }}>{valueLabel}</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 5, backgroundColor: theme.track }}>
        <div className="h-full rounded-full"
          style={{ width: `${safe}%`, backgroundColor: color, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function MiniTimeline({ phases, planStart, planEnd, theme, locale, i }) {
  const totalDays = Math.max(daysBetween(planStart, planEnd) + 1, 1)
  const todayStr  = todayISO()
  const todayOff  = daysBetween(planStart, todayStr)
  const showToday = todayOff >= 0 && todayOff <= totalDays

  const months = []
  const cur = new Date(planStart + 'T00:00:00')
  cur.setDate(1)
  const endDate = new Date(planEnd + 'T00:00:00')
  while (cur <= endDate) {
    const y  = cur.getFullYear()
    const mo = String(cur.getMonth() + 1).padStart(2, '0')
    const iso = `${y}-${mo}-01`
    const off = daysBetween(planStart, iso)
    if (off >= 0) {
      months.push({
        pct:   (off / totalDays) * 100,
        label: cur.toLocaleDateString(locale, { month: 'short' }),
      })
    }
    cur.setMonth(cur.getMonth() + 1)
  }

  const nonMilestone = phases.filter(p => !p.is_milestone)
  const milestones   = phases.filter(p =>  p.is_milestone)

  const statusMeta = {
    on_track: { label: i.onTrack,  color: '#30d158' },
    at_risk:  { label: i.atRisk,   color: '#ff9f0a' },
    delayed:  { label: i.delayed,  color: '#ff453a' },
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Month header */}
      <div style={{ position: 'relative', height: 22 }}>
        {months.map((m, idx) => (
          <span key={idx} style={{
            position: 'absolute',
            left: `${m.pct}%`,
            fontSize: 10,
            color: theme.muted,
            lineHeight: '22px',
            paddingLeft: 3,
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
          }}>{m.label}</span>
        ))}
        {showToday && (
          <span style={{
            position: 'absolute',
            left: `${(todayOff / totalDays) * 100}%`,
            top: 0,
            fontSize: 9,
            color: '#ff453a',
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
          }}>{i.today}</span>
        )}
      </div>

      {/* Grid lines */}
      <div style={{ position: 'relative', borderTop: theme.borderFaint }}>
        {months.map((m, idx) => (
          <div key={idx} style={{
            position: 'absolute',
            left:   `${m.pct}%`,
            top:    0,
            bottom: 0,
            width:  1,
            backgroundColor: theme.trackLine,
            pointerEvents: 'none',
          }} />
        ))}

        {showToday && (
          <div style={{
            position: 'absolute',
            left: `${(todayOff / totalDays) * 100}%`,
            top: 0, bottom: 0, width: 1.5,
            backgroundImage: 'repeating-linear-gradient(to bottom, #ff453a 0px, #ff453a 4px, transparent 4px, transparent 8px)',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}

        {nonMilestone.map(phase => {
          const leftPct  = (Math.max(daysBetween(planStart, phase.start_date), 0) / totalDays) * 100
          const widthPct = Math.max(((daysBetween(phase.start_date, phase.end_date) + 1) / totalDays) * 100, 0.4)
          const color    = phase.color || '#bf5af2'
          const progress = phase.progress || 0
          const status   = computePhaseStatus(phase)
          const statusColor = statusMeta[status]?.color

          return (
            <div key={phase.id} style={{ position: 'relative', height: 20, marginBottom: 3 }}>
              <div style={{
                position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`,
                height: '100%', backgroundColor: color + '22', borderRadius: 4,
              }} />
              {progress > 0 && (
                <div style={{
                  position: 'absolute', left: `${leftPct}%`,
                  width: `${widthPct * progress / 100}%`,
                  height: '100%', backgroundColor: color + 'bb', borderRadius: 4,
                }} />
              )}
              {progress === 0 && (
                <div style={{
                  position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`,
                  height: '100%', backgroundColor: color + '66', borderRadius: 4,
                }} />
              )}
              {statusColor && (
                <div style={{
                  position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`,
                  height: '100%', borderRadius: 4,
                  boxShadow: `inset 0 0 0 1.5px ${statusColor}`,
                }} />
              )}
              <span style={{
                position: 'absolute',
                left: `calc(${leftPct}% + 6px)`,
                lineHeight: '20px',
                fontSize: 10,
                color: theme.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                maxWidth: `calc(${widthPct}% - 10px)`,
                fontFamily: 'Inter, sans-serif',
                pointerEvents: 'none',
              }}>
                {phase.name}
              </span>
            </div>
          )
        })}

        {milestones.length > 0 && (
          <div style={{ position: 'relative', height: 20, marginBottom: 3 }}>
            {milestones.map(m => {
              const leftPct = (Math.max(daysBetween(planStart, m.start_date), 0) / totalDays) * 100
              const color   = m.color || '#bf5af2'
              return (
                <div key={m.id} title={`${m.name} · ${m.start_date}`} style={{
                  position: 'absolute',
                  left: `${leftPct}%`, top: '50%',
                  width: 10, height: 10,
                  transform: 'translate(-50%, -50%) rotate(45deg)',
                  backgroundColor: color,
                  borderRadius: 2,
                }} />
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3" style={{ flexWrap: 'wrap' }}>
        {milestones.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, backgroundColor: '#bf5af2', borderRadius: 1, transform: 'rotate(45deg)' }} />
            <span style={{ fontSize: 10, color: theme.muted }}>{i.milestone}</span>
          </div>
        )}
        {Object.entries(statusMeta).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: v.color + '66', boxShadow: `inset 0 0 0 1.5px ${v.color}` }} />
            <span style={{ fontSize: 10, color: theme.muted }}>{v.label}</span>
          </div>
        ))}
        {showToday && (
          <div className="flex items-center gap-1.5">
            <div style={{ width: 12, height: 2, backgroundImage: 'repeating-linear-gradient(to right, #ff453a 0px, #ff453a 4px, transparent 4px, transparent 8px)' }} />
            <span style={{ fontSize: 10, color: theme.muted }}>{i.today}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function WorkloadChart({ months, hasHours, theme, i, locale }) {
  const maxVal = Math.max(...months.map(m => m.value), 1)
  const H = 110
  const PAD = { l: 32, r: 8, t: 8, b: 28 }
  const chartH = H - PAD.t - PAD.b
  const W = 1000
  const barArea = W - PAD.l - PAD.r
  const barW    = Math.max(barArea / months.length - 6, 6)
  const spacing = barArea / months.length
  const todayLabel = new Date().toLocaleDateString(locale, { month: 'short' })

  const yTicks = [0, 0.5, 1].map(pct => ({
    pct,
    val: Math.round(maxVal * pct),
    y: PAD.t + chartH * (1 - pct),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map(({ pct, val, y }, idx) => (
        <g key={idx}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
            stroke={pct === 0 ? theme.muted : theme.trackLine} strokeWidth={pct === 0 ? 1 : 0.5} />
          <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize={8}
            fill={theme.faint} fontFamily="Inter, sans-serif">
            {val > 0 ? val : ''}
          </text>
        </g>
      ))}

      {months.map((m, idx) => {
        const barH   = Math.max((m.value / maxVal) * chartH, m.value > 0 ? 2 : 0)
        const x      = PAD.l + idx * spacing + (spacing - barW) / 2
        const y      = PAD.t + chartH - barH
        const isCur  = m.label === todayLabel
        const color  = isCur ? '#bf5af2' : '#bf5af255'

        return (
          <g key={idx}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} />
            <text x={x + barW / 2} y={H - PAD.b + 14}
              textAnchor="middle" fontSize={9}
              fill={isCur ? theme.text : theme.muted} fontFamily="Inter, sans-serif">
              {m.label}
            </text>
          </g>
        )
      })}

      <text x={W - PAD.r} y={PAD.t - 2} textAnchor="end" fontSize={8}
        fill={theme.faint} fontFamily="Inter, sans-serif">
        {hasHours ? i.hours : i.activePhases}
      </text>
    </svg>
  )
}

// ── Export handler ───────────────────────────────────────────────────────
function triggerChartsExport() {
  const charts = document.querySelector('.charts-print-only')
  if (!charts) return

  const placeholder = document.createElement('span')
  charts.parentNode.insertBefore(placeholder, charts)
  document.body.appendChild(charts)

  const style = document.createElement('style')
  style.id = '__charts_print__'
  style.textContent = `
    @media print {
      @page { size: A4 portrait; margin: 12mm 15mm; }
      html, body { background: white !important; }
      body > *:not(.charts-print-only) { display: none !important; }
      .charts-print-only { display: block !important; padding: 16px !important; }
      .charts-p2 { page-break-before: always; padding-top: 8px; }
    }
  `
  document.head.appendChild(style)
  window.print()

  setTimeout(() => {
    placeholder.parentNode.insertBefore(charts, placeholder)
    placeholder.remove()
    document.getElementById('__charts_print__')?.remove()
  }, 1500)
}

// ── Charts panel ─────────────────────────────────────────────────────────
function ChartsPanel({ plan, phases, nonMilestone, milestones, theme, planStart, lastEnd,
  totalDays, overallProgress, progressColor, totalHours, statusCounts, donutSegments,
  phasesWithHours, maxHours, phasesWithDuration, maxDuration, monthlyData, hasHours,
  allTasks, doneTasks, i, locale }) {

  const statusMeta = {
    on_track: { label: i.onTrack,  color: '#30d158' },
    at_risk:  { label: i.atRisk,   color: '#ff9f0a' },
    delayed:  { label: i.delayed,  color: '#ff453a' },
  }

  return (
    <>
      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <StatCard icon={Calendar}    label={i.duration}         value={fmtDuration(totalDays, i)}   sub={`${totalDays} ${i.calendarDays}`}                    theme={theme} />
        <StatCard icon={TrendingUp}  label={i.overallProgress}  value={`${overallProgress}%`}        sub={i.weightedByDuration}  accent={progressColor}         theme={theme} />
        <StatCard icon={Clock}       label={i.plannedHours}     value={totalHours > 0 ? `${totalHours}h` : '—'} sub={totalHours > 0 ? `≈ ${Math.round(totalHours / 8)} ${i.workDays}` : i.unassigned} theme={theme} />
        <StatCard icon={Layers}      label={i.phases}           value={nonMilestone.length}          sub={milestones.length > 0 ? `+ ${milestones.length} ${milestones.length > 1 ? i.phases2 : i.phase}` : i.noMilestones} theme={theme} />
        {allTasks > 0 && (
          <StatCard icon={CheckSquare} label={i.tasks}          value={`${doneTasks}/${allTasks}`}   sub={`${Math.round((doneTasks/allTasks)*100)}% ${i.completed}`} accent={doneTasks === allTasks ? '#30d158' : undefined} theme={theme} />
        )}
        {milestones.length > 0 && (
          <StatCard icon={Flag}      label={i.nextMilestone}    value={fmtDateShort(milestones.sort((a,b)=>a.start_date.localeCompare(b.start_date)).find(m => m.start_date >= todayISO())?.start_date || milestones[0].start_date, locale)} sub={milestones.sort((a,b)=>a.start_date.localeCompare(b.start_date)).find(m => m.start_date >= todayISO())?.name || milestones[0].name} theme={theme} />
        )}
      </div>

      {/* ── Mini timeline ──────────────────────────────────────── */}
      <div className="rounded-2xl p-4 mb-3"
        style={{ backgroundColor: theme.bg, border: theme.border }}>
        <p className="text-xs uppercase tracking-wider mb-3" style={{ color: theme.muted }}>
          {i.timeline}
        </p>
        <MiniTimeline phases={phases} planStart={planStart} planEnd={lastEnd} theme={theme} locale={locale} i={i} />
      </div>

      {/* ── Row: donut + hours + progress ──────────────────────── */}
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '190px 1fr 1fr' }}>

        {/* Status donut */}
        <div className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: theme.bg, border: theme.border }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: theme.muted }}>{i.status}</p>
          <DonutChart
            segments={donutSegments}
            size={130} stroke={28}
            label={nonMilestone.length}
            sublabel={i.phases2}
            theme={theme}
          />
          <div className="flex flex-col gap-1.5">
            {Object.entries(statusMeta).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs" style={{ color: theme.muted }}>{label}</span>
                </div>
                <span className="text-xs font-semibold tabular"
                  style={{ color: statusCounts[key] > 0 ? color : theme.faint }}>
                  {statusCounts[key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hours by phase */}
        <div className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: theme.bg, border: theme.border }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: theme.muted }}>{i.hoursByPhase}</p>
          {phasesWithHours.length === 0
            ? <p className="text-xs" style={{ color: theme.faint }}>{i.noHours}</p>
            : <div className="flex flex-col gap-2.5">
                {phasesWithHours.slice(0, 9).map(p => (
                  <HorizBar key={p.id}
                    pct={(p.hours / maxHours) * 100}
                    color={p.color || '#bf5af2'}
                    label={p.name}
                    valueLabel={`${p.hours}h`}
                    theme={theme}
                  />
                ))}
              </div>
          }
        </div>

        {/* Progress by phase */}
        <div className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: theme.bg, border: theme.border }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: theme.muted }}>{i.progressByPhase}</p>
          {nonMilestone.length === 0
            ? <p className="text-xs" style={{ color: theme.faint }}>{i.noPhases}</p>
            : <div className="flex flex-col gap-2.5">
                {nonMilestone.slice(0, 9).map(p => {
                  const status = computePhaseStatus(p)
                  const statusColor = statusMeta[status]?.color
                  const barColor = status !== 'on_track' ? statusColor : (p.color || '#bf5af2')
                  return (
                    <HorizBar key={p.id}
                      pct={p.progress || 0}
                      color={barColor}
                      label={p.name}
                      valueLabel={`${p.progress || 0}%`}
                      theme={theme}
                    />
                  )
                })}
              </div>
          }
        </div>
      </div>

      {/* ── Row: workload + duration ─────────────────────────── */}
      <div className="grid gap-3 charts-p2" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Monthly workload */}
        <div className="rounded-2xl p-4 flex flex-col gap-2"
          style={{ backgroundColor: theme.bg, border: theme.border }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: theme.muted }}>
            {i.monthlyWorkload} {hasHours ? `(h)` : `(${i.activePhases})`}
          </p>
          <WorkloadChart months={monthlyData} hasHours={hasHours} theme={theme} i={i} locale={locale} />
        </div>

        {/* Duration by phase */}
        <div className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: theme.bg, border: theme.border }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: theme.muted }}>{i.durationByPhase}</p>
          {phasesWithDuration.length === 0
            ? <p className="text-xs" style={{ color: theme.faint }}>{i.noPhases}</p>
            : <div className="flex flex-col gap-2.5">
                {phasesWithDuration.slice(0, 9).map(p => (
                  <HorizBar key={p.id}
                    pct={(p._dur / maxDuration) * 100}
                    color={p.color || '#bf5af2'}
                    label={p.name}
                    valueLabel={`${p._dur}d`}
                    theme={theme}
                  />
                ))}
              </div>
          }
        </div>
      </div>
    </>
  )
}

// ── Main component ───────────────────────────────────────────────────────
export default function PlanInsights({ plan, phases, hideExport = false }) {
  const { lang, t } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const i = t('insights') // insights translations object shorthand

  if (!plan || phases.length === 0) return null

  const nonMilestone = phases.filter(p => !p.is_milestone)
  const milestones   = phases.filter(p =>  p.is_milestone)

  const planStart = plan.start_date
  const lastEnd   = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, planStart)
  const totalDays = daysBetween(planStart, lastEnd) + 1

  const totalDuration = nonMilestone.reduce((s, p) => s + daysBetween(p.start_date, p.end_date) + 1, 0)
  const overallProgress = totalDuration > 0
    ? Math.round(nonMilestone.reduce((s, p) =>
        s + (p.progress || 0) * (daysBetween(p.start_date, p.end_date) + 1), 0,
      ) / totalDuration)
    : 0
  const progressColor = overallProgress >= 75 ? '#30d158' : overallProgress >= 40 ? '#ff9f0a' : '#ff453a'

  const totalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)
  const hasHours   = nonMilestone.some(p => p.hours > 0)

  const statusCounts = { on_track: 0, at_risk: 0, delayed: 0 }
  nonMilestone.forEach(p => { const s = computePhaseStatus(p); statusCounts[s] = (statusCounts[s] || 0) + 1 })
  const statusTotal   = nonMilestone.length || 1
  const donutSegments = [
    { color: '#30d158', pct: (statusCounts.on_track / statusTotal) * 100 },
    { color: '#ff9f0a', pct: (statusCounts.at_risk  / statusTotal) * 100 },
    { color: '#ff453a', pct: (statusCounts.delayed  / statusTotal) * 100 },
  ]
  if (donutSegments.every(s => s.pct === 0)) donutSegments[0].pct = 100

  const phasesWithHours    = [...nonMilestone].filter(p => p.hours > 0).sort((a, b) => b.hours - a.hours)
  const maxHours           = phasesWithHours[0]?.hours || 1

  const phasesWithDuration = nonMilestone.map(p => ({
    ...p, _dur: daysBetween(p.start_date, p.end_date) + 1,
  })).sort((a, b) => b._dur - a._dur)
  const maxDuration = phasesWithDuration[0]?._dur || 1

  const allTasks  = nonMilestone.reduce((s, p) => s + (p.plan_tasks?.length || 0), 0)
  const doneTasks = nonMilestone.reduce((s, p) => s + (p.plan_tasks?.filter(tk => tk.done).length || 0), 0)

  const monthlyData = buildMonthly(nonMilestone, planStart, lastEnd, locale)

  const shared = {
    plan, phases, nonMilestone, milestones, planStart, lastEnd,
    totalDays, overallProgress, progressColor, totalHours,
    statusCounts, donutSegments, phasesWithHours, maxHours,
    phasesWithDuration, maxDuration, monthlyData, hasHours,
    allTasks, doneTasks, i, locale,
  }

  return (
    <>
      {/* ── Screen version (dark) ─────────────────────────────── */}
      <div className="no-print" style={{ padding: '0 24px 48px' }}>
        <div className="flex items-center gap-3 mb-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 28 }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
            {i.planSummary}
          </h2>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
          <span className="text-xs" style={{ color: '#3a3a3a' }}>
            {fmtDate(planStart, locale)} → {fmtDate(lastEnd, locale)}
          </span>
          {!hideExport && (
            <button
              onClick={triggerChartsExport}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#6e6e73', borderRadius: 8, padding: '5px 10px',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
            >
              <Download className="w-3.5 h-3.5" />
              {i.exportSummary}
            </button>
          )}
        </div>

        <ChartsPanel {...shared} theme={DARK} />
      </div>

      {/* ── Print version (light) ─────────── */}
      <div className="charts-print-only" style={{ display: 'none', padding: '16px 20px 24px', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e0e0e0' }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#111' }}>{plan.name} — {i.summary}</h1>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#888' }}>
              {fmtDate(planStart, locale)} → {fmtDate(lastEnd, locale)} · {totalDays} {i.days} · {nonMilestone.length} {nonMilestone.length !== 1 ? i.phases2 : i.phase}
              {totalHours > 0 ? ` · ${totalHours}h` : ''}
            </p>
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
        <ChartsPanel {...shared} theme={LIGHT} />
      </div>
    </>
  )
}
