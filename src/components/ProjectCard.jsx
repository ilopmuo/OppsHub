import StatusBadge from './StatusBadge'
import SLABadge from './SLABadge'
import { Calendar, AlertTriangle, RefreshCw, Clock, Rocket, Wrench, Circle, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' }
const PRIORITY_DOT = { high: '#ff453a', medium: '#ff9f0a', low: '#6e6e73' }

function getNextTask(tasks) {
  return tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))[0]
}

function isDeadlineSoon(deadline) {
  if (!deadline) return false
  return Math.ceil((new Date(deadline) - new Date()) / 86400000) <= 7
}

function formatDate(date) {
  if (!date) return null
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysSince(date) {
  if (!date) return null
  const diff = Math.floor((new Date() - new Date(date + 'T00:00:00')) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return `Hace ${diff} días`
}

export default function ProjectCard({ project, onClick, index = 0 }) {
  const [hovered, setHovered] = useState(false)
  const [displayProgress, setDisplayProgress] = useState(0)
  const tasks = project.tasks || []
  const nextTask = getNextTask(tasks)
  const pendingCount = tasks.filter(t => t.status !== 'done').length
  const totalCount = tasks.length
  const progress = totalCount > 0 ? Math.round((totalCount - pendingCount) / totalCount * 100) : 0

  const isImpl = project.type !== 'maintenance'
  const soon = isDeadlineSoon(project.deadline)

  useEffect(() => {
    const t = setTimeout(() => setDisplayProgress(progress), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-2xl p-5 transition-all duration-200"
      style={{
        backgroundColor: hovered ? '#161616' : '#111111',
        border: `1px solid ${
          project.status === 'blocked' ? 'rgba(255,69,58,0.28)' :
          project.status === 'at_risk' ? 'rgba(255,159,10,0.22)' :
          hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'
        }`,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? project.status === 'blocked' ? '0 12px 40px rgba(255,69,58,0.18)'
          : project.status === 'at_risk'  ? '0 12px 40px rgba(255,159,10,0.14)'
          : '0 12px 40px rgba(0,0,0,0.5)'
          : project.status === 'blocked' ? 'inset 0 0 0 0 transparent, 0 0 20px rgba(255,69,58,0.06)'
          : project.status === 'at_risk'  ? 'inset 0 0 0 0 transparent, 0 0 20px rgba(255,159,10,0.05)'
          : 'none',
        animation: 'card-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: `${index * 55}ms`,
      }}
    >
      {/* Name + type chip */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: '#f5f5f7' }}>
          {project.name}
        </h3>
        <span
          className="shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-0.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}
        >
          {isImpl
            ? <Rocket className="w-2.5 h-2.5" />
            : <Wrench className="w-2.5 h-2.5" />}
          {isImpl ? 'Impl.' : 'Mant.'}
        </span>
      </div>

      {/* Status badge */}
      <div className="mb-4">
        <StatusBadge status={project.status} />
      </div>

      {/* ── IMPLEMENTATION ── */}
      {isImpl && (
        <>
          {project.deadline && (
            <div className="flex items-center gap-1.5 mb-4 text-xs" style={{ color: soon ? '#ff9f0a' : '#6e6e73' }}>
              {soon ? <AlertTriangle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
              {formatDate(project.deadline)}
              {soon && <span className="font-medium">· Próximo</span>}
            </div>
          )}

          {/* Task progress */}
          {totalCount > 0 && (
            <div className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-xs" style={{ color: '#6e6e73' }}>{progress}% completado</span>
                <span className="text-xs" style={{ color: '#3a3a3a' }}>{totalCount - pendingCount}/{totalCount}</span>
              </div>
              <div className="h-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${displayProgress}%`, background: displayProgress === 100 ? 'linear-gradient(90deg,#30d158,#4cd964)' : 'linear-gradient(90deg,rgba(255,255,255,0.15),rgba(255,255,255,0.45))' }} />
              </div>
            </div>
          )}

          {/* Next task */}
          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {nextTask ? (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: PRIORITY_DOT[nextTask.priority] }} />
                <div className="min-w-0">
                  <p className="text-xs line-clamp-1" style={{ color: '#c0c0c0' }}>{nextTask.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>Prioridad {PRIORITY_LABELS[nextTask.priority]}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#3a3a3a' }}>
                {pendingCount === 0 && totalCount > 0 ? 'Todas completadas' : 'Sin tareas pendientes'}
              </p>
            )}
          </div>
        </>
      )}

      {/* ── MAINTENANCE ── */}
      {!isImpl && (
        <>
          {/* SLA badge */}
          {project.sla_status && (
            <div className="mb-4">
              <SLABadge status={project.sla_status} />
            </div>
          )}

          {/* Info grid */}
          <div className="space-y-2 mb-4">
            {project.renewal_date && (
              <div className="flex items-center gap-2 text-xs">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" style={{ color: '#6e6e73' }} />
                <span style={{ color: '#6e6e73' }}>Renovación</span>
                <span className="ml-auto" style={{ color: '#c0c0c0' }}>{formatDate(project.renewal_date)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: '#6e6e73' }} />
              <span style={{ color: '#6e6e73' }}>Tareas abiertas</span>
              <span className="ml-auto font-semibold"
                style={{ color: pendingCount > 5 ? '#ff453a' : pendingCount > 0 ? '#ff9f0a' : '#30d158' }}>
                {pendingCount}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#6e6e73' }} />
              <span style={{ color: '#6e6e73' }}>Tareas cerradas</span>
              <span className="ml-auto font-semibold" style={{ color: '#6e6e73' }}>
                {totalCount - pendingCount}
              </span>
            </div>
            {project.last_contact && (
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: '#6e6e73' }} />
                <span style={{ color: '#6e6e73' }}>Último contacto</span>
                <span className="ml-auto" style={{ color: '#c0c0c0' }}>{daysSince(project.last_contact)}</span>
              </div>
            )}
          </div>

          {/* Next task */}
          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {nextTask ? (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: PRIORITY_DOT[nextTask.priority] }} />
                <div className="min-w-0">
                  <p className="text-xs line-clamp-1" style={{ color: '#c0c0c0' }}>{nextTask.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>Prioridad {PRIORITY_LABELS[nextTask.priority]}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#3a3a3a' }}>Sin tareas pendientes</p>
            )}
          </div>
        </>
      )}
    </button>
  )
}
