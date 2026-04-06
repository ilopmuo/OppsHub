import StatusBadge from './StatusBadge'
import { Calendar, ChevronRight, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

const C = {
  surface: '#1b263b',
  border: '#415a77',
  muted: '#778da9',
  text: '#e0e1dd',
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' }
const PRIORITY_DOT = { high: '#f87171', medium: '#fbbf24', low: '#778da9' }

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
      className="w-full text-left rounded-2xl p-5 transition-all duration-200 cursor-pointer"
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${hovered ? C.border : `${C.border}30`}`,
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? `0 8px 24px rgba(13,27,42,0.6)` : 'none',
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 transition-colors" style={{ color: hovered ? C.text : C.text }}>
          {project.name}
        </h3>
        <ChevronRight
          className="w-4 h-4 shrink-0 mt-0.5 transition-all"
          style={{ color: hovered ? C.muted : `${C.border}50`, transform: hovered ? 'translateX(2px)' : 'none' }}
        />
      </div>

      {/* Status badge */}
      <StatusBadge status={project.status} />

      {/* Deadline */}
      {project.deadline && (
        <div
          className="flex items-center gap-1.5 mt-3 text-xs"
          style={{ color: soon ? '#fbbf24' : C.muted }}
        >
          {soon ? <AlertTriangle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
          {formatDeadline(project.deadline)}
          {soon && <span className="font-semibold">· Próximo</span>}
        </div>
      )}

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: C.muted }}>{progress}% completado</span>
            <span className="text-xs" style={{ color: `${C.border}80` }}>{totalCount - pendingCount}/{totalCount}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${C.border}20` }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#34d399' : C.border }}
            />
          </div>
        </div>
      )}

      {/* Divider + next task */}
      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}20` }}>
        {nextTask ? (
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: PRIORITY_DOT[nextTask.priority] }} />
            <div className="min-w-0">
              <p className="text-xs line-clamp-1" style={{ color: C.text }}>{nextTask.title}</p>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                Prioridad {PRIORITY_LABELS[nextTask.priority]}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ color: `${C.border}60` }}>
            {pendingCount === 0 && totalCount > 0 ? 'Todas las tareas completadas' : 'Sin tareas pendientes'}
          </p>
        )}
      </div>
    </button>
  )
}
