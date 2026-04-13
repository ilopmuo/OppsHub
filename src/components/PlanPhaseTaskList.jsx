import { useState, useRef } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'

export default function PlanPhaseTaskList({ phase, isEditable, onAddTask, onUpdateTask, onDeleteTask }) {
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await onAddTask(phase.id, newTitle.trim())
    setNewTitle('')
    inputRef.current?.focus()
  }

  const tasks = phase.plan_tasks || []

  return (
    <div className="py-2 pl-6 pr-3 space-y-1">
      {tasks.map(task => (
        <div
          key={task.id}
          className="flex items-center gap-2 group py-1 px-2 rounded-lg"
          style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
        >
          {/* Checkbox */}
          <button
            onClick={() => isEditable && onUpdateTask(phase.id, task.id, { done: !task.done })}
            className="shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all"
            style={{
              border: task.done ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
              backgroundColor: task.done ? '#30d158' : 'transparent',
              cursor: isEditable ? 'pointer' : 'default',
            }}
          >
            {task.done && <Check className="w-2.5 h-2.5" style={{ color: '#000' }} />}
          </button>

          {/* Title */}
          {isEditable ? (
            <input
              value={task.title}
              onChange={e => onUpdateTask(phase.id, task.id, { title: e.target.value })}
              className="flex-1 min-w-0 text-xs bg-transparent outline-none"
              style={{
                color: task.done ? '#3a3a3a' : '#f5f5f7',
                textDecoration: task.done ? 'line-through' : 'none',
                border: 'none',
              }}
            />
          ) : (
            <span
              className="flex-1 min-w-0 text-xs truncate"
              style={{
                color: task.done ? '#3a3a3a' : '#f5f5f7',
                textDecoration: task.done ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </span>
          )}

          {/* Hours */}
          {isEditable ? (
            <input
              type="number"
              min="0"
              step="0.5"
              value={task.hours || ''}
              onChange={e => onUpdateTask(phase.id, task.id, { hours: parseFloat(e.target.value) || 0 })}
              placeholder="0h"
              className="text-xs bg-transparent outline-none text-right shrink-0"
              style={{
                width: 36,
                color: '#6e6e73',
                border: 'none',
              }}
            />
          ) : (
            task.hours > 0 && (
              <span className="text-xs shrink-0" style={{ color: '#6e6e73' }}>{task.hours}h</span>
            )
          )}

          {/* Delete */}
          {isEditable && (
            <button
              onClick={() => onDeleteTask(phase.id, task.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
              style={{ color: '#6e6e73' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Add task input */}
      {isEditable && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 py-1 px-2">
          <div className="w-4 h-4 shrink-0" />
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Añadir tarea..."
            className="flex-1 min-w-0 text-xs bg-transparent outline-none"
            style={{ color: '#6e6e73', border: 'none' }}
            onFocus={e => e.target.style.color = '#f5f5f7'}
            onBlur={e => e.target.style.color = '#6e6e73'}
          />
          {newTitle.trim() && (
            <button
              type="submit"
              className="shrink-0 p-0.5 rounded"
              style={{ color: '#30d158' }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      )}
    </div>
  )
}
