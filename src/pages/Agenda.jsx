import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, X, ExternalLink } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

const PRIORITY_COLOR = { high: '#ff453a', medium: '#ff9f0a', low: '#6e6e73' }
const PRIORITY_LABEL = { high: 'Alta', medium: 'Media', low: 'Baja' }

function pad(n) { return String(n).padStart(2, '0') }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }
function today() { const n = new Date(); return dateKey(n.getFullYear(), n.getMonth(), n.getDate()) }
function isOverdue(date) { return date && date < today() }

function formatFull(ds) {
  if (!ds) return ''
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── AddNoteInput ──────────────────────────────────────────────────────────────
function AddNoteInput({ onAdd, onCancel }) {
  const [val, setVal] = useState('')
  const ref = useRef()
  useEffect(() => { ref.current?.focus() }, [])
  function submit() { if (val.trim()) { onAdd(val.trim()); setVal('') } }
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Nueva nota…"
        className="flex-1 text-xs outline-none rounded-lg px-2.5 py-1.5"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f5f5f7', fontFamily: 'inherit' }}
      />
      <button onClick={submit}
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: '#f5f5f7', color: '#000' }}>
        <Check size={10} strokeWidth={3} />
      </button>
      <button onClick={onCancel}
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,255,255,0.08)', color: '#6e6e73' }}>
        <X size={10} strokeWidth={3} />
      </button>
    </div>
  )
}

// ── Day panel ─────────────────────────────────────────────────────────────────
function DayPanel({ ds, projectTasks, notes, onAddNote, onToggleNote, onDeleteNote, onClose, onNavigate }) {
  const [adding, setAdding] = useState(false)
  const isToday = ds === today()
  const label = formatFull(ds)
  const pendingTasks  = projectTasks.filter(t => t.status !== 'done')
  const pendingNotes  = notes.filter(n => !n.done)
  const doneNotes     = notes.filter(n => n.done)

  return (
    <div style={{
      width: 300, minWidth: 300, flexShrink: 0,
      background: '#0a0a0a',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column',
      borderRadius: '0 20px 20px 0',
    }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span style={{ fontSize: 26, fontWeight: 900, color: '#f5f5f7', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {parseInt(ds.split('-')[2])}
            </span>
            {isToday && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f5f5f7', color: '#000', fontWeight: 700 }}>Hoy</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#4a4a4a', fontWeight: 500, textTransform: 'capitalize' }}>{label}</p>
          {(pendingTasks.length > 0 || pendingNotes.length > 0) && (
            <p style={{ fontSize: 11, color: '#6e6e73', marginTop: 4 }}>
              {pendingTasks.length + pendingNotes.length} pendiente{pendingTasks.length + pendingNotes.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{ color: '#3a3a3a', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ maxHeight: 'calc(100vh - 260px)' }}>

        {/* Project tasks */}
        {projectTasks.length > 0 && (
          <div className="mb-5">
            <p style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Tareas de proyecto</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {projectTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => onNavigate(task.projectId)}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group w-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: PRIORITY_COLOR[task.priority] ?? '#6e6e73', flexShrink: 0, marginTop: 4 }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 12, color: task.status === 'done' ? '#3a3a3a' : '#f5f5f7', fontWeight: 500, textDecoration: task.status === 'done' ? 'line-through' : 'none' }} className="truncate">
                      {task.title}
                    </p>
                    <p style={{ fontSize: 10, color: '#3a3a3a', marginTop: 1 }}>{task.projectName}</p>
                  </div>
                  <ExternalLink size={10} style={{ color: '#3a3a3a', flexShrink: 0, marginTop: 3 }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Personal notes */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Notas personales</p>

          {notes.length === 0 && !adding && (
            <p style={{ fontSize: 11, color: '#3a3a3a', marginBottom: 8 }}>Sin notas para este día</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...pendingNotes, ...doneNotes].map(note => (
              <div key={note.id}
                className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-all"
                style={{ background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <button
                  onClick={() => onToggleNote(note.id, note.done)}
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all"
                  style={{ border: `1.5px solid ${note.done ? '#f5f5f7' : 'rgba(255,255,255,0.2)'}`, background: note.done ? '#f5f5f7' : 'transparent' }}
                >
                  {note.done && <Check size={9} color="#000" strokeWidth={3} />}
                </button>
                <span style={{ flex: 1, fontSize: 12, color: note.done ? '#3a3a3a' : '#f5f5f7', textDecoration: note.done ? 'line-through' : 'none', fontWeight: 500, wordBreak: 'break-word' }}>
                  {note.text}
                </span>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ color: '#3a3a3a' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                  onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>

          {adding && (
            <AddNoteInput onAdd={t => { onAddNote(ds, t); setAdding(false) }} onCancel={() => setAdding(false)} />
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all"
          style={{ background: adding ? 'rgba(255,255,255,0.04)' : '#f5f5f7', color: adding ? '#6e6e73' : '#000', fontWeight: 700, border: adding ? '1px dashed rgba(255,255,255,0.1)' : 'none' }}
        >
          <Plus size={13} />
          Añadir nota
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Agenda() {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const now       = new Date()

  const [year, setYear]       = useState(now.getFullYear())
  const [month, setMonth]     = useState(now.getMonth())
  const [projects, setProjects] = useState([])
  const [notes, setNotes]     = useState([])   // calendar_notes for current month
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(dateKey(now.getFullYear(), now.getMonth(), now.getDate()))

  // Derived
  const firstDow   = (new Date(year, month, 1).getDay() + 6) % 7  // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells      = Array.from({ length: firstDow + daysInMonth }, (_, i) => i < firstDow ? null : i - firstDow + 1)

  const allProjectTasks = projects.flatMap(p =>
    (p.tasks || []).filter(t => t.due_date).map(t => ({ ...t, projectId: p.id, projectName: p.name }))
  )

  function tasksByDay(ds) { return allProjectTasks.filter(t => t.due_date === ds) }
  function notesByDay(ds)  { return notes.filter(n => n.date === ds).sort((a, b) => a.position - b.position) }

  // Fetch
  useEffect(() => { fetchAll() }, [year, month]) // eslint-disable-line

  async function fetchAll() {
    setLoading(true)
    const first = dateKey(year, month, 1)
    const last  = dateKey(year, month, daysInMonth)
    const [{ data: proj }, { data: n }] = await Promise.all([
      supabase.from('projects').select('*, tasks(*)').order('created_at', { ascending: false }),
      supabase.from('calendar_notes').select('*').eq('user_id', user.id).gte('date', first).lte('date', last).order('position'),
    ])
    setProjects(proj || [])
    setNotes(n || [])
    setLoading(false)
  }

  // Notes CRUD
  async function addNote(ds, text) {
    const position = notes.filter(n => n.date === ds).length
    const { data, error } = await supabase
      .from('calendar_notes')
      .insert({ user_id: user.id, date: ds, text, done: false, position })
      .select().single()
    if (!error && data) setNotes(prev => [...prev, data])
    else if (error) toast.error('Error al guardar nota')
  }

  async function toggleNote(id, done) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, done: !done } : n))
    const { error } = await supabase.from('calendar_notes').update({ done: !done }).eq('id', id)
    if (error) { toast.error('Error'); setNotes(prev => prev.map(n => n.id === id ? { ...n, done } : n)) }
  }

  async function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id))
    await supabase.from('calendar_notes').delete().eq('id', id)
  }

  // Navigation
  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }
  function goToday()   { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); setSelected(dateKey(n.getFullYear(), n.getMonth(), n.getDate())) }

  const todayKey = today()
  const selectedTasks = selected ? tasksByDay(selected) : []
  const selectedNotes = selected ? notesByDay(selected) : []

  // Stats
  const monthTasks  = allProjectTasks.filter(t => t.due_date >= dateKey(year, month, 1) && t.due_date <= dateKey(year, month, daysInMonth))
  const pendingMonth = monthTasks.filter(t => t.status !== 'done').length
  const overdueMonth = monthTasks.filter(t => isOverdue(t.due_date) && t.status !== 'done').length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000' }}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-6 py-10 page-enter">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>Calendario</p>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{ color: '#6e6e73' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6e6e73' }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em', minWidth: 240 }}>
                {MONTHS[month]} <span style={{ color: '#4a4a4a' }}>{year}</span>
              </h1>
              <button onClick={nextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{ color: '#6e6e73' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6e6e73' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {overdueMonth > 0 && (
              <span style={{ fontSize: 12, color: '#ff453a', fontWeight: 600 }}>
                {overdueMonth} vencida{overdueMonth !== 1 ? 's' : ''}
              </span>
            )}
            {pendingMonth > 0 && (
              <span style={{ fontSize: 12, color: '#6e6e73', fontWeight: 500 }}>
                {pendingMonth} pendiente{pendingMonth !== 1 ? 's' : ''} este mes
              </span>
            )}
            <button
              onClick={goToday}
              className="text-xs px-3.5 py-1.5 rounded-xl transition-all font-medium"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#f5f5f7' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Calendar + panel */}
        <div
          className="flex rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#111' }}
        >
          {/* Grid */}
          <div className="flex-1 min-w-0">
            {/* Day headers */}
            <div className="grid grid-cols-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {DAYS.map(d => (
                <div key={d} className="py-2.5 text-center" style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.08em' }}>
                  {d.toUpperCase()}
                </div>
              ))}
            </div>

            {/* Cells */}
            {loading ? (
              <div className="flex items-center justify-center" style={{ height: 320 }}>
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#3a3a3a', borderTopColor: '#f5f5f7' }} />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  if (!day) return (
                    <div key={i} style={{ minHeight: 80, borderRight: (i + 1) % 7 !== 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', borderBottom: i < cells.length - 7 ? '1px solid rgba(255,255,255,0.04)' : 'none' }} />
                  )

                  const ds        = dateKey(year, month, day)
                  const dayTasks  = tasksByDay(ds)
                  const dayNotes  = notesByDay(ds)
                  const isToday   = ds === todayKey
                  const isSel     = ds === selected
                  const hasPending = dayTasks.some(t => t.status !== 'done') || dayNotes.some(n => !n.done)
                  const hasOverdue = dayTasks.some(t => isOverdue(t.due_date) && t.status !== 'done')

                  return (
                    <div
                      key={i}
                      onClick={() => setSelected(isSel ? null : ds)}
                      className="cursor-pointer transition-all"
                      style={{
                        minHeight: 80, padding: '8px 6px 6px',
                        borderRight: (i + 1) % 7 !== 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        borderBottom: i < cells.length - 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: isSel ? 'rgba(255,255,255,0.05)' : isToday ? 'rgba(255,255,255,0.025)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isToday ? 'rgba(255,255,255,0.025)' : 'transparent' }}
                    >
                      {/* Day number */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: '50%',
                          fontSize: 12, fontWeight: isToday ? 800 : hasPending ? 600 : 400,
                          background: isToday ? '#f5f5f7' : 'transparent',
                          color: isToday ? '#000' : hasPending ? '#f5f5f7' : '#3a3a3a',
                        }}>
                          {day}
                        </span>
                        {hasOverdue && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff453a' }} />}
                      </div>

                      {/* Task chips */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayTasks.slice(0, 2).map(t => (
                          <div key={t.id} style={{
                            fontSize: 9, fontWeight: 600, lineHeight: '13px',
                            padding: '1px 5px', borderRadius: 4,
                            background: t.status === 'done' ? 'rgba(255,255,255,0.04)' : `${PRIORITY_COLOR[t.priority] ?? '#6e6e73'}22`,
                            color: t.status === 'done' ? '#3a3a3a' : '#f5f5f7',
                            textDecoration: t.status === 'done' ? 'line-through' : 'none',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            borderLeft: `2px solid ${t.status === 'done' ? 'rgba(255,255,255,0.08)' : PRIORITY_COLOR[t.priority] ?? '#6e6e73'}`,
                          }}>
                            {t.title}
                          </div>
                        ))}
                        {dayNotes.slice(0, dayTasks.length >= 2 ? 0 : 2 - dayTasks.length).map(n => (
                          <div key={n.id} style={{
                            fontSize: 9, fontWeight: 500, lineHeight: '13px',
                            padding: '1px 5px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.04)',
                            color: n.done ? '#3a3a3a' : '#6e6e73',
                            textDecoration: n.done ? 'line-through' : 'none',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            borderLeft: '2px solid rgba(255,255,255,0.1)',
                          }}>
                            {n.text}
                          </div>
                        ))}
                        {(dayTasks.length + dayNotes.length) > 2 && (
                          <p style={{ fontSize: 9, color: '#3a3a3a', paddingLeft: 5 }}>+{dayTasks.length + dayNotes.length - 2} más</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Day panel */}
          {selected && (
            <DayPanel
              ds={selected}
              projectTasks={selectedTasks}
              notes={selectedNotes}
              onAddNote={addNote}
              onToggleNote={toggleNote}
              onDeleteNote={deleteNote}
              onClose={() => setSelected(null)}
              onNavigate={id => navigate(`/project/${id}`)}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4">
          {Object.entries(PRIORITY_COLOR).map(([k, c]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c + '44', borderLeft: `2px solid ${c}` }} />
              <span style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 500 }}>{PRIORITY_LABEL[k]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 500 }}>Nota personal</span>
          </div>
        </div>

      </main>
    </div>
  )
}
