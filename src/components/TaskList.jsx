import { Trash2, Calendar } from 'lucide-react'

const C = {
  surface: '#1b263b',
  border: '#415a77',
  muted: '#778da9',
  text: '#e0e1dd',
}

const PRIORITY_CONFIG = {
  high: { label: 'Alta', color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  medium: { label: 'Media', color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  low: { label: 'Baja', color: '#778da9', bg: 'rgba(119,141,169,0.08)', border: 'rgba(119,141,169,0.2)' },
}

function formatDate(date) {
  if (!date) return null
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function isOverdue(date) {
  if (!date) return false
  return new Date(date + 'T00:00:00') < new Date(new Date().toDateString())
}

export default function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) return null

  return (
    <div className="space-y-2">
      {tasks.map(task => {
        const p = PRIORITY_CONFIG[task.priority]
        return (
          <div
            key={task.id}
            className="flex items-start gap-3.5 px-4 py-3.5 rounded-xl group transition-all"
            style={{
              backgroundColor: C.surface,
              border: `1px solid ${task.done ? `${C.border}15` : `${C.border}25`}`,
              opacity: task.done ? 0.55 : 1,
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => onToggle(task.id, !task.done)}
              className="mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center transition-all"
              style={{
                backgroundColor: task.done ? C.border : 'transparent',
                border: `2px solid ${task.done ? C.border : `${C.border}60`}`,
              }}
              onMouseEnter={e => { if (!task.done) e.currentTarget.style.borderColor = C.muted }}
              onMouseLeave={e => { if (!task.done) e.currentTarget.style.borderColor = `${C.border}60` }}
            >
              {task.done && (
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#e0e1dd" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm leading-snug"
                style={{
                  color: task.done ? C.muted : C.text,
                  textDecoration: task.done ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: p.bg, color: p.color, border: `1px solid ${p.border}` }}
                >
                  {p.label}
                </span>
                {task.due_date && (
                  <span
                    className="flex items-center gap-1 text-xs"
                    style={{ color: isOverdue(task.due_date) && !task.done ? '#f87171' : C.muted }}
                  >
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
              className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              style={{ color: C.muted }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = C.muted}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
