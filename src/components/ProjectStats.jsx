import { Calendar, CheckCircle, Flag, Ticket, RefreshCw, Clock } from 'lucide-react'

function daysUntil(date) {
  if (!date) return null
  return Math.ceil((new Date(date + 'T00:00:00') - new Date()) / 86400000)
}

function daysSince(date) {
  if (!date) return null
  const d = Math.floor((new Date() - new Date(date + 'T00:00:00')) / 86400000)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Ayer'
  return `Hace ${d}d`
}

function formatDate(date) {
  if (!date) return null
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DeadlineStat({ days, label }) {
  const color = days === null ? '#6e6e73'
    : days < 0 ? '#ff453a'
    : days <= 7 ? '#ff9f0a'
    : '#30d158'
  const text = days === null ? '—'
    : days < 0 ? `Vencido hace ${Math.abs(days)}d`
    : days === 0 ? 'Hoy'
    : `${days} días`

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: '#6e6e73' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>{text}</span>
    </div>
  )
}

function Stat({ label, value, color = '#f5f5f7', sub }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: '#6e6e73' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: '#6e6e73' }}>{sub}</span>}
    </div>
  )
}

const SLA_LABELS = { ok: 'Cumpliendo', at_risk: 'En riesgo', breach: 'Incumpliendo' }
const SLA_COLORS = { ok: '#30d158', at_risk: '#ff9f0a', breach: '#ff453a' }

export default function ProjectStats({ project, tasks, milestones }) {
  const isImpl = project.type !== 'maintenance'
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0

  const totalMilestones = milestones.length
  const doneMilestones = milestones.filter(m => m.done).length

  const deadlineDays = daysUntil(project.deadline)
  const renewalDays = daysUntil(project.renewal_date)
  const openTasks = tasks.filter(t => t.status !== 'done').length
  const closedTasks = doneTasks
  const openTaskColor = openTasks > 5 ? '#ff453a' : openTasks > 0 ? '#ff9f0a' : '#30d158'

  return (
    <div
      className="rounded-2xl px-6 py-5 mb-6"
      style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {isImpl ? (
        <div className="flex flex-wrap gap-8">
          <DeadlineStat days={deadlineDays} label="Deadline" />
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: '#6e6e73' }}>Progreso tareas</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>{pct}%</span>
              <div className="w-20 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#30d158' : 'rgba(255,255,255,0.3)' }} />
              </div>
              <span className="text-xs" style={{ color: '#6e6e73' }}>{doneTasks}/{totalTasks}</span>
            </div>
          </div>
          {totalMilestones > 0 && (
            <Stat label="Hitos" value={`${doneMilestones}/${totalMilestones}`}
              color={doneMilestones === totalMilestones ? '#30d158' : '#f5f5f7'} />
          )}
          {project.start_date && (
            <Stat label="Inicio" value={formatDate(project.start_date)} />
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-8">
          {project.renewal_date && (
            <DeadlineStat days={renewalDays} label="Renovación" />
          )}
          {project.sla_status && (
            <Stat label="SLA" value={SLA_LABELS[project.sla_status]} color={SLA_COLORS[project.sla_status]} />
          )}
          <Stat label="Tareas abiertas" value={openTasks} color={openTaskColor} />
          <Stat label="Tareas cerradas" value={closedTasks} color="#6e6e73" />
          {project.last_contact && (
            <Stat label="Último contacto" value={daysSince(project.last_contact)} />
          )}
          {project.start_date && (
            <Stat label="Inicio" value={formatDate(project.start_date)} />
          )}
        </div>
      )}
    </div>
  )
}
