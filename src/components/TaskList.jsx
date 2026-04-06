import { Trash2, Calendar } from 'lucide-react'

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  color: '#ff453a', bg: 'rgba(255,69,58,0.08)',   border: 'rgba(255,69,58,0.18)' },
  medium: { label: 'Media', color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)',  border: 'rgba(255,159,10,0.18)' },
  low:    { label: 'Baja',  color: '#6e6e73', bg: 'rgba(110,110,115,0.08)', border: 'rgba(110,110,115,0.18)' },
}

const STATUS_CYCLE = { todo: 'in_progress', in_progress: 'done', done: 'todo' }

function formatDate(date) {
  if (!date) return null
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function isOverdue(date) {
  if (!date) return false
  return new Date(date + 'T00:00:00') < new Date(new Date().toDateString())
}

function StatusButton({ status, onChange }) {
  const isDone = status === 'done'
  const isProgress = status === 'in_progress'

  return (
    <button
      onClick={() => onChange(STATUS_CYCLE[status])}
      className="mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all"
      title={isDone ? 'Marcar pendiente' : isProgress ? 'Marcar hecho' : 'Marcar en progreso'}
      style={{
        backgroundColor: isDone ? '#f5f5f7' : 'transparent',
        border: `1.5px solid ${isDone ? '#f5f5f7' : isProgress ? '#ff9f0a' : 'rgba(255,255,255,0.2)'}`,
      }}
      onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)' }}
      onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = isDone ? '#f5f5f7' : isProgress ? '#ff9f0a' : 'rgba(255,255,255,0.2)' }}
    >
      {isDone && (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {isProgress && (
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ff9f0a' }} />
      )}
    </button>
  )
}

export default function TaskList({ tasks, onChangeStatus, onDelete, onClickTask }) {
  if (tasks.length === 0) return null

  return (
    <div className="space-y-1.5">
      {tasks.map(task => {
        const p = PRIORITY_CONFIG[task.priority]
        const isDone = task.status === 'done'

        return (
          <div
            key={task.id}
            onClick={() => onClickTask?.(task)}
            className="flex items-start gap-3.5 px-4 py-3.5 rounded-xl group transition-all"
            style={{
              backgroundColor: '#111111',
              border: '1px solid rgba(255,255,255,0.06)',
              opacity: isDone ? 0.45 : 1,
              cursor: onClickTask ? 'pointer' : 'default',
            }}
          >
            <div onClick={e => e.stopPropagation()}>
              <StatusButton status={task.status} onChange={s => onChangeStatus(task.id, s)} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug"
                style={{ color: isDone ? '#6e6e73' : '#f5f5f7', textDecoration: isDone ? 'line-through' : 'none' }}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                  {p.label}
                </span>
                {task.status === 'in_progress' && (
                  <span className="text-xs" style={{ color: '#ff9f0a' }}>En progreso</span>
                )}
                {task.due_date && (
                  <span className="flex items-center gap-1 text-xs"
                    style={{ color: isOverdue(task.due_date) && !isDone ? '#ff453a' : '#6e6e73' }}>
                    <Calendar className="w-3 h-3" />
                    {formatDate(task.due_date)}
                    {isOverdue(task.due_date) && !isDone && ' · Vencida'}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={e => { e.stopPropagation(); onDelete(task.id) }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
              style={{ color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
