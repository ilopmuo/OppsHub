import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, RadialBarChart, RadialBar,
  AreaChart, Area,
} from 'recharts'

/* ─── constants ──────────────────────────────────────── */
const PRIORITY_COLOR  = { high: '#ff453a', medium: '#ff9f0a', low: '#6e6e73' }
const PRIORITY_LABEL  = { high: 'Alta', medium: 'Media', low: 'Baja' }
const STATUS_COLOR    = { backlog: '#3a3a3a', todo: '#6e6e73', in_progress: '#64d2ff', done: '#30d158' }
const STATUS_LABEL    = { backlog: 'Backlog', todo: 'Por hacer', in_progress: 'En progreso', done: 'Hecho' }
const STATUS_ORDER    = ['backlog', 'todo', 'in_progress', 'done']

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f5f5f7',
  fontSize: 12,
  padding: '6px 10px',
}

/* ─── helpers ────────────────────────────────────────── */
function today() { return new Date(new Date().toDateString()) }

function dueBucket(due_date) {
  if (!due_date) return 'sin_fecha'
  const d = new Date(due_date + 'T00:00:00')
  const t = today()
  const diff = Math.ceil((d - t) / 86400000)
  if (diff < 0)  return 'vencidas'
  if (diff === 0) return 'hoy'
  if (diff <= 7)  return 'esta_semana'
  if (diff <= 30) return 'este_mes'
  return 'despues'
}

function initials(member) {
  if (member?.display_name) return member.display_name.slice(0, 2).toUpperCase()
  if (member?.email)        return member.email.split('@')[0].slice(0, 2).toUpperCase()
  return '?'
}

function shortName(member) {
  if (member?.display_name) return member.display_name.split(' ')[0]
  if (member?.email)        return member.email.split('@')[0]
  return 'Sin asignar'
}

/* ─── sub-components ─────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#3a3a3a' }}>
      {children}
    </p>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub, color = '#f5f5f7', ring }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs" style={{ color: '#6e6e73' }}>{label}</p>
      <div className="flex items-end gap-3 mt-1">
        {ring !== undefined && (
          <div className="relative w-10 h-10 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" stroke="rgba(255,255,255,0.06)" />
              <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3"
                stroke={ring >= 100 ? '#30d158' : ring >= 60 ? '#64d2ff' : ring >= 30 ? '#ff9f0a' : '#ff453a'}
                strokeDasharray={`${ring * 0.879} 87.9`}
                strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>
              {ring}%
            </span>
          </div>
        )}
        <div>
          <p className="text-2xl font-bold tracking-tight" style={{ color, letterSpacing: '-0.03em' }}>{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: '#3a3a3a' }}>{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

/* Pipeline — custom proportional funnel */
function Pipeline({ tasks }) {
  const counts = STATUS_ORDER.map(s => ({ status: s, count: tasks.filter(t => t.status === s).length }))
  const max = Math.max(...counts.map(c => c.count), 1)

  return (
    <Card>
      <SectionLabel>Pipeline de tareas</SectionLabel>
      <div className="space-y-2.5">
        {counts.map(({ status, count }) => {
          const pct = Math.max((count / max) * 100, count === 0 ? 0 : 8)
          return (
            <div key={status} className="flex items-center gap-3">
              <span className="w-20 text-xs shrink-0 text-right" style={{ color: '#6e6e73' }}>
                {STATUS_LABEL[status]}
              </span>
              <div className="flex-1 h-7 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <div
                  className="h-full rounded-lg flex items-center px-2.5 transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: STATUS_COLOR[status], minWidth: count > 0 ? 28 : 0 }}
                >
                  {count > 0 && (
                    <span className="text-xs font-bold" style={{ color: status === 'backlog' || status === 'todo' ? '#f5f5f7' : '#000' }}>
                      {count}
                    </span>
                  )}
                </div>
              </div>
              <span className="w-10 text-xs text-right tabular-nums" style={{ color: '#3a3a3a' }}>
                {tasks.length > 0 ? Math.round(count / tasks.length * 100) : 0}%
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5 mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-xs" style={{ color: '#3a3a3a' }}>{tasks.length} tareas en total</span>
        {tasks.filter(t => t.status === 'done').length === tasks.length && tasks.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: '#30d158' }}>✓ Todas completadas</span>
        )}
      </div>
    </Card>
  )
}

/* Priority × Status matrix */
function PriorityMatrix({ tasks }) {
  const matrix = ['high', 'medium', 'low'].map(p => ({
    priority: p,
    ...Object.fromEntries(STATUS_ORDER.map(s => [s, tasks.filter(t => t.priority === p && t.status === s).length])),
    total: tasks.filter(t => t.priority === p).length,
  }))

  const maxCell = Math.max(...matrix.flatMap(row => STATUS_ORDER.map(s => row[s])), 1)

  function cellOpacity(val) { return val === 0 ? 0.04 : 0.06 + (val / maxCell) * 0.35 }

  return (
    <Card>
      <SectionLabel>Prioridad × Estado</SectionLabel>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: '3px' }}>
          <thead>
            <tr>
              <th className="text-left pb-2" style={{ color: '#3a3a3a', fontWeight: 500 }}></th>
              {STATUS_ORDER.map(s => (
                <th key={s} className="pb-2 text-center" style={{ color: '#6e6e73', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {STATUS_LABEL[s]}
                </th>
              ))}
              <th className="pb-2 text-center" style={{ color: '#3a3a3a', fontWeight: 500 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr key={row.priority}>
                <td className="pr-3 py-1 font-semibold" style={{ color: PRIORITY_COLOR[row.priority] }}>
                  {PRIORITY_LABEL[row.priority]}
                </td>
                {STATUS_ORDER.map(s => (
                  <td key={s} className="text-center py-1 px-2 rounded-lg"
                    style={{
                      backgroundColor: row[s] > 0
                        ? `${STATUS_COLOR[s]}${Math.round(cellOpacity(row[s]) * 255).toString(16).padStart(2, '0')}`
                        : 'rgba(255,255,255,0.02)',
                      color: row[s] > 0 ? '#f5f5f7' : '#3a3a3a',
                      fontWeight: row[s] > 0 ? 600 : 400,
                    }}>
                    {row[s]}
                  </td>
                ))}
                <td className="text-center py-1 px-2 font-semibold" style={{ color: '#6e6e73' }}>
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* Assignee workload */
function AssigneeWorkload({ tasks }) {
  const assigneeMap = {}
  tasks.forEach(t => {
    const key = t.assignee?.id || '__none__'
    if (!assigneeMap[key]) assigneeMap[key] = { member: t.assignee, open: 0, done: 0 }
    if (t.status === 'done') assigneeMap[key].done++
    else assigneeMap[key].open++
  })

  const data = Object.values(assigneeMap)
    .map(({ member, open, done }) => ({ name: shortName(member), open, done, total: open + done }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  if (data.length === 0) return null

  return (
    <Card>
      <SectionLabel>Carga por miembro</SectionLabel>
      <ResponsiveContainer width="100%" height={data.length * 42 + 20}>
        <BarChart data={data} layout="vertical" barSize={12} barGap={3}
          margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis type="number" tick={{ fill: '#3a3a3a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#6e6e73', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#f5f5f7', marginBottom: 4 }}
            formatter={(val, name) => [val, name === 'open' ? 'Abiertas' : 'Cerradas']}
            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
          />
          <Bar dataKey="done" name="done" stackId="a" fill="#30d158" radius={[0, 0, 0, 0]} />
          <Bar dataKey="open" name="open" stackId="a" fill="#ff9f0a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6e6e73' }}>
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#30d158' }} /> Cerradas
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6e6e73' }}>
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#ff9f0a' }} /> Abiertas
        </span>
      </div>
    </Card>
  )
}

/* Due date urgency */
function DueDateUrgency({ tasks }) {
  const pending = tasks.filter(t => t.status !== 'done')

  const buckets = [
    { key: 'vencidas',    label: 'Vencidas',    color: '#ff453a' },
    { key: 'hoy',         label: 'Hoy',         color: '#ff9f0a' },
    { key: 'esta_semana', label: 'Esta semana',  color: '#ff9f0a' },
    { key: 'este_mes',    label: 'Este mes',     color: '#64d2ff' },
    { key: 'despues',     label: 'Después',      color: '#6e6e73' },
    { key: 'sin_fecha',   label: 'Sin fecha',    color: '#3a3a3a' },
  ]

  const data = buckets.map(b => ({
    ...b,
    value: pending.filter(t => dueBucket(t.due_date) === b.key).length,
  })).filter(d => d.value > 0)

  if (data.length === 0) return (
    <Card className="flex flex-col items-center justify-center" style={{ minHeight: 180 }}>
      <SectionLabel>Urgencia de vencimiento</SectionLabel>
      <p className="text-xs" style={{ color: '#3a3a3a' }}>Sin tareas pendientes con fecha</p>
    </Card>
  )

  return (
    <Card>
      <SectionLabel>Urgencia de vencimiento</SectionLabel>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={28} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="label" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#3a3a3a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#f5f5f7' }}
            formatter={v => [v, 'Tareas']} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]}>
            {data.map(d => <Cell key={d.key} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

/* Milestone tracker */
function MilestoneTracker({ milestones }) {
  if (!milestones || milestones.length === 0) return null
  const done  = milestones.filter(m => m.done).length
  const total = milestones.length
  const pct   = Math.round(done / total * 100)
  const color = pct === 100 ? '#30d158' : pct >= 60 ? '#64d2ff' : '#ff9f0a'

  return (
    <Card>
      <SectionLabel>Hitos del proyecto</SectionLabel>
      <div className="flex items-center gap-5 mb-5">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3.5" stroke="rgba(255,255,255,0.06)" />
            <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3.5"
              stroke={color} strokeDasharray={`${pct * 0.879} 87.9`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
            {pct}%
          </span>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color, letterSpacing: '-0.03em' }}>{done}/{total}</p>
          <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>hitos completados</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {milestones.slice(0, 6).map(m => (
          <div key={m.id} className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: m.done ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.06)' }}>
              {m.done && <span style={{ color: '#30d158', fontSize: 8, fontWeight: 900 }}>✓</span>}
            </span>
            <span className="text-xs truncate" style={{ color: m.done ? '#6e6e73' : '#f5f5f7',
              textDecoration: m.done ? 'line-through' : 'none' }}>
              {m.title}
            </span>
          </div>
        ))}
        {milestones.length > 6 && (
          <p className="text-xs pt-1" style={{ color: '#3a3a3a' }}>+{milestones.length - 6} más</p>
        )}
      </div>
    </Card>
  )
}

/* Priority trend (area chart — simulated with priority buckets) */
function PriorityBreakdown({ tasks }) {
  const pending = tasks.filter(t => t.status !== 'done')

  const data = ['high', 'medium', 'low'].map(p => ({
    priority: PRIORITY_LABEL[p],
    Backlog:  pending.filter(t => t.priority === p && t.status === 'backlog').length,
    'Por hacer': pending.filter(t => t.priority === p && t.status === 'todo').length,
    'En progreso': pending.filter(t => t.priority === p && t.status === 'in_progress').length,
  }))

  if (pending.length === 0) return null

  return (
    <Card>
      <SectionLabel>Pendientes por prioridad y estado</SectionLabel>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={18} barGap={3} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="priority" tick={{ fill: '#6e6e73', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#3a3a3a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#f5f5f7' }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="Backlog"      fill={STATUS_COLOR.backlog}     radius={[3, 3, 0, 0]} />
          <Bar dataKey="Por hacer"    fill={STATUS_COLOR.todo}        radius={[3, 3, 0, 0]} />
          <Bar dataKey="En progreso"  fill={STATUS_COLOR.in_progress} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

/* ─── main component ─────────────────────────────────── */
export default function ProjectDetailReports({ project, tasks, milestones }) {
  const isImpl = project?.type !== 'maintenance'

  const stats = useMemo(() => {
    const total       = tasks.length
    const done        = tasks.filter(t => t.status === 'done').length
    const pending     = tasks.filter(t => t.status !== 'done').length
    const pct         = total > 0 ? Math.round(done / total * 100) : 0
    const overdue     = tasks.filter(t => t.status !== 'done' && t.due_date &&
                          new Date(t.due_date + 'T00:00:00') < today()).length
    const highOpen    = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length
    const assigned    = new Set(tasks.filter(t => t.assignee?.id).map(t => t.assignee.id)).size

    const deadlineDate = isImpl ? project.deadline : project.renewal_date
    const daysLeft = deadlineDate
      ? Math.ceil((new Date(deadlineDate + 'T00:00:00') - today()) / 86400000)
      : null

    return { total, done, pending, pct, overdue, highOpen, assigned, daysLeft }
  }, [tasks, project, isImpl])

  if (tasks.length === 0 && (!milestones || milestones.length === 0)) return null

  const daysColor = stats.daysLeft === null ? '#6e6e73'
    : stats.daysLeft < 0 ? '#ff453a'
    : stats.daysLeft <= 7 ? '#ff9f0a'
    : '#30d158'
  const daysText = stats.daysLeft === null ? '—'
    : stats.daysLeft < 0 ? `Vencido ${Math.abs(stats.daysLeft)}d`
    : stats.daysLeft === 0 ? 'Hoy'
    : `${stats.daysLeft}d`

  return (
    <div className="mt-14">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1.5" style={{ color: '#3a3a3a' }}>Analíticas</p>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
            Project Reports
          </h2>
        </div>
        <p className="text-xs" style={{ color: '#3a3a3a' }}>
          {stats.total} tarea{stats.total !== 1 ? 's' : ''}
          {milestones?.length > 0 ? ` · ${milestones.length} hito${milestones.length !== 1 ? 's' : ''}` : ''}
        </p>
      </div>

      {/* Row 1 — KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        <KpiCard label="Completación" value={`${stats.pct}%`}
          color={stats.pct === 100 ? '#30d158' : stats.pct >= 60 ? '#64d2ff' : '#f5f5f7'}
          sub={`${stats.done} de ${stats.total}`}
          ring={stats.pct} />
        <KpiCard label="Tareas abiertas" value={stats.pending}
          color={stats.pending > 10 ? '#ff453a' : stats.pending > 0 ? '#ff9f0a' : '#30d158'}
          sub={`${stats.done} cerradas`} />
        <KpiCard label="Vencidas" value={stats.overdue}
          color={stats.overdue > 0 ? '#ff453a' : '#30d158'}
          sub={stats.overdue > 0 ? 'requieren atención' : 'todo al día'} />
        <KpiCard label="Alta prioridad abiertas" value={stats.highOpen}
          color={stats.highOpen > 3 ? '#ff453a' : stats.highOpen > 0 ? '#ff9f0a' : '#30d158'}
          sub="sin completar" />
        <KpiCard
          label={isImpl ? 'Deadline' : 'Renovación'}
          value={daysText}
          color={daysColor}
          sub={stats.assigned > 0 ? `${stats.assigned} miembro${stats.assigned !== 1 ? 's' : ''} asignado${stats.assigned !== 1 ? 's' : ''}` : 'sin asignar'} />
      </div>

      {/* Row 2 — Pipeline + Matrix */}
      <div className="grid grid-cols-[1fr_auto] gap-3 mb-3">
        <Pipeline tasks={tasks} />
        <div style={{ minWidth: 280 }}>
          <PriorityMatrix tasks={tasks} />
        </div>
      </div>

      {/* Row 3 — Workload + Urgency + Milestones */}
      <div className={`grid gap-3 mb-3 ${isImpl && milestones?.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <AssigneeWorkload tasks={tasks} />
        <DueDateUrgency tasks={tasks} />
        {isImpl && milestones?.length > 0 && <MilestoneTracker milestones={milestones} />}
      </div>

      {/* Row 4 — Priority breakdown */}
      {tasks.filter(t => t.status !== 'done').length > 0 && (
        <PriorityBreakdown tasks={tasks} />
      )}
    </div>
  )
}
