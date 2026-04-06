import StatusBadge from './StatusBadge'
import { Calendar, ChevronRight, AlertTriangle } from 'lucide-react'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function getNextTask(tasks) {
  return tasks
    .filter(t => !t.done)
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))[0]
}

function isDeadlineSoon(deadline) {
  if (!deadline) return false
  const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))
  return days <= 7
}

function formatDeadline(deadline) {
  if (!deadline) return null
  return new Date(deadline + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' }
const PRIORITY_COLORS = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-gray-400',
}

export default function ProjectCard({ project, onClick }) {
  const nextTask = getNextTask(project.tasks || [])
  const soon = isDeadlineSoon(project.deadline)
  const pendingCount = (project.tasks || []).filter(t => !t.done).length

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition group cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-white text-base leading-tight group-hover:text-violet-300 transition line-clamp-2">
          {project.name}
        </h3>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition shrink-0 mt-0.5" />
      </div>

      {/* Status */}
      <StatusBadge status={project.status} />

      {/* Deadline */}
      {project.deadline && (
        <div className={`flex items-center gap-1.5 mt-3 text-xs ${soon ? 'text-amber-400' : 'text-gray-500'}`}>
          {soon ? <AlertTriangle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
          {formatDeadline(project.deadline)}
          {soon && <span className="font-medium">· Próximo</span>}
        </div>
      )}

      {/* Next task */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        {nextTask ? (
          <div>
            <p className="text-xs text-gray-500 mb-1">Próxima tarea</p>
            <p className="text-sm text-gray-300 line-clamp-1">{nextTask.title}</p>
            <span className={`text-xs ${PRIORITY_COLORS[nextTask.priority]}`}>
              Prioridad {PRIORITY_LABELS[nextTask.priority]}
            </span>
          </div>
        ) : (
          <p className="text-xs text-gray-600">
            {pendingCount === 0 && (project.tasks || []).length > 0
              ? 'Todas las tareas completadas'
              : 'Sin tareas pendientes'}
          </p>
        )}
      </div>
    </button>
  )
}
