import StatusBadge from './StatusBadge'
import { Calendar, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' }
const PRIORITY_DOT = { high: '#ff453a', medium: '#ff9f0a', low: '#6e6e73' }

function getNextTask(tasks) {
  return tasks
    .filter(t => !t.done)
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))[0]
}

function isDeadlineSoon(deadline) {
  if (!deadline) return false
  return Math.ceil((new Date(deadline) - new Date()) / 86400000) <= 7
}

function formatDeadline(deadline) {
  if (!deadline) return null
  return new Date(deadline + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProjectCard({ project, onClick }) {
  const [hovered, setHovered] = useState(false)
  const nextTask = getNextTask(project.tasks || [])
  const soon = isDeadlineSoon(project.deadline)
  const pendingCount = (project.tasks || []).filter(t => !t.done).length
  const totalCount = (project.tasks || []).length
  const progress = totalCount > 0 ? Math.round((totalCount - pendingCount) / totalCount * 100) : 0

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-2xl p-5 transition-all duration-200"
      style={{
        backgroundColor: hovered ? '#161616' : '#111111',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 8px 30px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      {/* Name + status */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3
          className="font-semibold text-sm leading-snug line-clamp-2"
          style={{ color: '#f5f5f7' }}
        >
          {project.name}
        </h3>
        <StatusBadge status={project.status} />
      </div>

      {/* Deadline */}
      {project.deadline && (
        <div
          className="flex items-center gap-1.5 mb-4 text-xs"
          style={{ color: soon ? '#ff9f0a' : '#6e6e73' }}
        >
          {soon ? <AlertTriangle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
          {formatDeadline(project.deadline)}
          {soon && <span className="font-medium">· Próximo</span>}
        </div>
      )}

      {/* Progress */}
      {totalCount > 0 && (
        <div className="mb-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-xs" style={{ color: '#6e6e73' }}>{progress}% completado</span>
            <span className="text-xs" style={{ color: '#3a3a3a' }}>{totalCount - pendingCount}/{totalCount}</span>
          </div>
          <div className="h-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor: progress === 100 ? '#30d158' : 'rgba(255,255,255,0.3)',
              }}
            />
          </div>
        </div>
      )}

      {/* Next task */}
      <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {nextTask ? (
          <div className="flex items-start gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: PRIORITY_DOT[nextTask.priority] }}
            />
            <div className="min-w-0">
              <p className="text-xs line-clamp-1" style={{ color: '#c0c0c0' }}>{nextTask.title}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>
                Prioridad {PRIORITY_LABELS[nextTask.priority]}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ color: '#3a3a3a' }}>
            {pendingCount === 0 && totalCount > 0 ? 'Todas completadas' : 'Sin tareas pendientes'}
          </p>
        )}
      </div>
    </button>
  )
}
