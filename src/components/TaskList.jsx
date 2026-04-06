import { Trash2, Calendar } from 'lucide-react'

const PRIORITY_COLORS = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
}
const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' }

function formatDate(date) {
  if (!date) return null
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

function isOverdue(date) {
  if (!date) return false
  return new Date(date + 'T00:00:00') < new Date(new Date().toDateString())
}

export default function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) return null

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div
          key={task.id}
          className={`flex items-start gap-3 bg-gray-900 border rounded-xl px-4 py-3.5 group transition ${
            task.done ? 'border-gray-800/50 opacity-60' : 'border-gray-800'
          }`}
        >
          {/* Checkbox */}
          <button
            onClick={() => onToggle(task.id, !task.done)}
            className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition ${
              task.done
                ? 'bg-violet-600 border-violet-600'
                : 'border-gray-600 hover:border-violet-500'
            }`}
          >
            {task.done && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm text-white leading-snug ${task.done ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[task.priority]}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
              {task.due_date && (
                <span className={`flex items-center gap-1 text-xs ${isOverdue(task.due_date) && !task.done ? 'text-red-400' : 'text-gray-500'}`}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.due_date)}
                  {isOverdue(task.due_date) && !task.done && ' · Vencida'}
                </span>
              )}
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
