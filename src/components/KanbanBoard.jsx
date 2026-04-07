import { useState, useRef } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, Calendar, Plus } from 'lucide-react'

const COLUMNS = [
  { id: 'todo',        label: 'Por hacer',    color: '#6e6e73' },
  { id: 'in_progress', label: 'En progreso',  color: '#ff9f0a' },
  { id: 'done',        label: 'Hecho',        color: '#30d158' },
]

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  color: '#ff453a', bg: 'rgba(255,69,58,0.1)',   border: 'rgba(255,69,58,0.2)' },
  medium: { label: 'Media', color: '#ff9f0a', bg: 'rgba(255,159,10,0.1)',  border: 'rgba(255,159,10,0.2)' },
  low:    { label: 'Baja',  color: '#6e6e73', bg: 'rgba(110,110,115,0.1)', border: 'rgba(110,110,115,0.2)' },
}

function formatDate(date) {
  if (!date) return null
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function isOverdue(date) {
  if (!date) return false
  return new Date(date + 'T00:00:00') < new Date(new Date().toDateString())
}

/* ── Card ── */
function KanbanCard({ task, onDelete, onClickTask, wasDraggingRef, overlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const p = PRIORITY_CONFIG[task.priority]

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => { if (!overlay && !wasDraggingRef?.current) onClickTask?.(task) }}
      className="group rounded-xl p-3.5 select-none"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        cursor: overlay ? 'grabbing' : 'grab',
        backgroundColor: overlay ? '#222' : '#1a1a1a',
        border: `1px solid ${overlay ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: overlay ? '0 12px 40px rgba(0,0,0,0.6)' : 'none',
        touchAction: 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-sm leading-snug" style={{
          color: task.status === 'done' ? '#6e6e73' : '#f5f5f7',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
        }}>
          {task.title}
        </p>
        {task.description && !overlay && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#6e6e73' }}>{task.description}</p>
        )}
        {!overlay && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(task.id) }}
            className="opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded shrink-0"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
            onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {task.assignee && (
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}>
            {task.assignee}
          </span>
        )}
        <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
          {p.label}
        </span>
        {task.due_date && (
          <span className="flex items-center gap-1 text-xs"
            style={{ color: isOverdue(task.due_date) && task.status !== 'done' ? '#ff453a' : '#6e6e73' }}>
            <Calendar className="w-3 h-3" />
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Column ── */
function KanbanColumn({ column, tasks, onDelete, onAddTask, onClickTask, wasDraggingRef }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col min-w-0" style={{ minHeight: 200 }}>
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-sm font-medium" style={{ color: '#f5f5f7' }}>{column.label}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(column.id)}
          className="p-1 rounded-lg transition-all"
          style={{ color: '#6e6e73' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
          onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
          title={`Añadir tarea en ${column.label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 rounded-2xl p-2 space-y-2 transition-all"
        style={{
          backgroundColor: isOver ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${isOver ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
          minHeight: 120,
        }}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <KanbanCard key={task.id} task={task} onDelete={onDelete} onClickTask={onClickTask} wasDraggingRef={wasDraggingRef} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center py-8">
            <p className="text-xs" style={{ color: '#3a3a3a' }}>Sin tareas</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Board ── */
export default function KanbanBoard({ tasks, onUpdateStatus, onDelete, onAddTask, onClickTask }) {
  const [activeTask, setActiveTask] = useState(null)
  const wasDraggingRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const tasksByColumn = {
    todo:        tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done:        tasks.filter(t => t.status === 'done'),
  }

  function handleDragStart({ active }) {
    wasDraggingRef.current = true
    setActiveTask(tasks.find(t => t.id === active.id) || null)
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null)
    setTimeout(() => { wasDraggingRef.current = false }, 0)
    if (!over) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    // Determine target column id
    let targetStatus
    const columnIds = ['todo', 'in_progress', 'done']
    if (columnIds.includes(over.id)) {
      targetStatus = over.id
    } else {
      // over.id is another task — find its column
      const overTask = tasks.find(t => t.id === over.id)
      targetStatus = overTask?.status
    }

    if (targetStatus && targetStatus !== task.status) {
      onUpdateStatus(task.id, targetStatus)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn[col.id]}
            onDelete={onDelete}
            onAddTask={onAddTask}
            onClickTask={onClickTask}
            wasDraggingRef={wasDraggingRef}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <KanbanCard task={activeTask} overlay />}
      </DragOverlay>
    </DndContext>
  )
}
