import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/NavBar'
import NewHabitModal from '../components/habits/NewHabitModal'
import { Plus, Flame, BarChart2, Pencil, Trash2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function dateStr(d) {
  return d.toISOString().slice(0, 10)
}

function computeStreak(logs, habit) {
  // logs: sorted array of {date, completed} desc
  const done = new Set(logs.filter(l => l.completed).map(l => l.date))
  let streak = 0
  const d = new Date()
  // if today not done yet, start from yesterday for current streak
  if (!done.has(dateStr(d))) d.setDate(d.getDate() - 1)
  while (true) {
    const s = dateStr(d)
    const dayOfWeek = d.getDay()
    const shouldCount = habit.type === 'daily' ||
      (habit.days_of_week || []).includes(dayOfWeek)
    if (!shouldCount) { d.setDate(d.getDate() - 1); continue }
    if (!done.has(s)) break
    streak++
    d.setDate(d.getDate() - 1)
    if (streak > 365) break
  }
  return streak
}

function computeMaxStreak(logs, habit) {
  const done = new Set(logs.filter(l => l.completed).map(l => l.date))
  let max = 0
  let cur = 0
  // iterate over last 365 days
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const s = dateStr(d)
    const dayOfWeek = d.getDay()
    const shouldCount = habit.type === 'daily' ||
      (habit.days_of_week || []).includes(dayOfWeek)
    if (shouldCount) {
      if (done.has(s)) {
        cur++
        if (cur > max) max = cur
      } else {
        cur = 0
      }
    }
    d.setDate(d.getDate() - 1)
  }
  return max
}

// 28-day grid: most recent 28 days
function CalendarGrid({ logs, habit }) {
  const done = new Set(logs.filter(l => l.completed).map(l => l.date))
  const cells = []
  const today = new Date()
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const s = dateStr(d)
    const dayOfWeek = d.getDay()
    const active = habit.type === 'daily' || (habit.days_of_week || []).includes(dayOfWeek)
    cells.push({ s, active, done: done.has(s), isToday: s === todayStr() })
  }

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
      {DAY_LABELS.map(l => (
        <div key={l} className="text-center text-xs" style={{ color: '#3a3a3a' }}>{l}</div>
      ))}
      {/* Offset: find what day of week the first cell is */}
      {(() => {
        const firstDay = new Date(today)
        firstDay.setDate(firstDay.getDate() - 27)
        const offset = firstDay.getDay()
        const offsets = Array.from({ length: offset }, (_, i) => i)
        return offsets.map(i => <div key={`off-${i}`} />)
      })()}
      {cells.map(({ s, active, done: isDone, isToday }) => (
        <div
          key={s}
          className="rounded-md aspect-square"
          title={s}
          style={{
            backgroundColor: !active
              ? 'transparent'
              : isDone
              ? habit.color
              : isToday
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.04)',
            border: isToday && !isDone ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
            opacity: !active ? 0.15 : 1,
          }}
        />
      ))}
    </div>
  )
}

function HabitTodayCard({ habit, log, onToggle, onNumericSave }) {
  const [hovered, setHovered] = useState(false)
  const [numVal, setNumVal] = useState(log?.value ?? '')
  const isDone = log?.completed
  const isNumeric = habit.goal_type === 'numeric'

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{
        backgroundColor: '#111',
        border: `1px solid ${isDone ? habit.color + '44' : hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-3">
        {/* Color dot */}
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: isDone ? '#6e6e73' : '#f5f5f7', textDecoration: isDone ? 'line-through' : 'none' }}>
            {habit.name}
          </p>
          {isNumeric && habit.goal_value && (
            <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>
              Meta: {habit.goal_value}{habit.goal_unit ? ` ${habit.goal_unit}` : ''}
            </p>
          )}
        </div>

        {/* Numeric input or toggle */}
        {isNumeric ? (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min="0"
              value={numVal}
              onChange={e => setNumVal(e.target.value)}
              className="w-16 px-2 py-1 rounded-lg text-xs text-center outline-none"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#f5f5f7' }}
              placeholder="0"
            />
            {habit.goal_unit && <span className="text-xs" style={{ color: '#6e6e73' }}>{habit.goal_unit}</span>}
            <button
              onClick={() => onNumericSave(habit, Number(numVal))}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{ backgroundColor: isDone ? habit.color + '33' : 'rgba(255,255,255,0.06)', color: isDone ? habit.color : '#6e6e73' }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onToggle(habit, log)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{
              backgroundColor: isDone ? habit.color + '22' : 'rgba(255,255,255,0.06)',
              border: `2px solid ${isDone ? habit.color : 'rgba(255,255,255,0.12)'}`,
            }}
          >
            {isDone && <Check className="w-4 h-4" style={{ color: habit.color }} />}
          </button>
        )}
      </div>
    </div>
  )
}

function HabitManageCard({ habit, logs, onEdit, onDelete }) {
  const streak = computeStreak(logs, habit)
  const maxStreak = computeMaxStreak(logs, habit)
  const total = logs.filter(l => l.completed).length
  const last28 = logs.filter(l => {
    const d = new Date(); d.setDate(d.getDate() - 28)
    return new Date(l.date) >= d && l.completed
  }).length

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>{habit.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>
              {habit.type === 'daily' ? 'Diario' : (habit.days_of_week || []).map(d => DAY_LABELS[d]).join(', ')}
              {habit.goal_type === 'numeric' && habit.goal_value ? ` · ${habit.goal_value}${habit.goal_unit ? ' ' + habit.goal_unit : ''}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(habit)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: '#6e6e73', backgroundColor: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f5f5f7' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6e6e73' }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(habit)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: '#6e6e73', backgroundColor: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.12)'; e.currentTarget.style.color = '#ff453a' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6e6e73' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Racha actual', value: streak, icon: <Flame className="w-3 h-3" />, color: streak > 0 ? '#ff9f0a' : '#6e6e73' },
          { label: 'Racha máx.', value: maxStreak, icon: <BarChart2 className="w-3 h-3" />, color: '#6e6e73' },
          { label: 'Últimos 28d', value: last28, icon: null, color: '#6e6e73' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl p-2.5 text-center" style={{ backgroundColor: '#1a1a1a' }}>
            <div className="flex items-center justify-center gap-1 mb-1" style={{ color }}>
              {icon}
              <span className="text-base font-bold" style={{ color }}>{value}</span>
            </div>
            <p className="text-xs" style={{ color: '#4a4a4a' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* 28-day calendar */}
      <CalendarGrid logs={logs} habit={habit} />
    </div>
  )
}

export default function Habits() {
  const { user } = useAuth()
  const [tab, setTab] = useState('today')
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([]) // all logs for current user
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editHabit, setEditHabit] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: habitsData }, { data: logsData }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at', { ascending: true }),
      supabase.from('habit_logs').select('*').gte('date', (() => {
        const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10)
      })()),
    ])
    setHabits(habitsData || [])
    setLogs(logsData || [])
    setLoading(false)
  }

  // Filter habits scheduled for today
  const today = new Date()
  const todayDow = today.getDay()
  const todayHabits = habits.filter(h =>
    h.type === 'daily' || (h.days_of_week || []).includes(todayDow)
  )

  function getLog(habitId) {
    return logs.find(l => l.habit_id === habitId && l.date === todayStr()) || null
  }

  function getLogsForHabit(habitId) {
    return logs.filter(l => l.habit_id === habitId)
  }

  async function handleToggle(habit, log) {
    const date = todayStr()
    if (log?.completed) {
      // Remove completion
      const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('date', date)
      if (!error) setLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.date === date)))
    } else {
      // Mark complete
      const { data, error } = await supabase.from('habit_logs')
        .upsert({ habit_id: habit.id, user_id: user.id, date, completed: true }, { onConflict: 'habit_id,date' })
        .select().single()
      if (!error && data) {
        setLogs(prev => [...prev.filter(l => !(l.habit_id === habit.id && l.date === date)), data])
      }
    }
  }

  async function handleNumericSave(habit, value) {
    const date = todayStr()
    const completed = habit.goal_value ? value >= habit.goal_value : value > 0
    const { data, error } = await supabase.from('habit_logs')
      .upsert({ habit_id: habit.id, user_id: user.id, date, completed, value }, { onConflict: 'habit_id,date' })
      .select().single()
    if (!error && data) {
      setLogs(prev => [...prev.filter(l => !(l.habit_id === habit.id && l.date === date)), data])
      toast.success(completed ? '¡Meta alcanzada!' : 'Progreso guardado')
    }
  }

  async function handleDelete(habit) {
    if (!confirm(`¿Eliminar "${habit.name}"? Se perderá todo el historial.`)) return
    const { error } = await supabase.from('habits').delete().eq('id', habit.id)
    if (!error) {
      setHabits(prev => prev.filter(h => h.id !== habit.id))
      setLogs(prev => prev.filter(l => l.habit_id !== habit.id))
      toast.success('Hábito eliminado')
    }
  }

  const completedToday = todayHabits.filter(h => getLog(h.id)?.completed).length
  const totalToday = todayHabits.length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000' }}>
      <NavBar />

      <main className="max-w-2xl mx-auto px-6 py-12 page-enter">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>Hábitos</p>
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
              {tab === 'today' ? 'Hoy' : 'Mis hábitos'}
            </h1>
            {tab === 'today' && totalToday > 0 && (
              <p className="text-sm" style={{ color: '#6e6e73' }}>
                {completedToday} de {totalToday} completados
              </p>
            )}
          </div>
          <button
            onClick={() => { setEditHabit(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] shrink-0"
            style={{ backgroundColor: '#f5f5f7', color: '#000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
          >
            <Plus className="w-4 h-4" />
            Nuevo hábito
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: '#111' }}>
          {[{ v: 'today', l: 'Hoy' }, { v: 'manage', l: 'Hábitos' }].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: tab === v ? '#1a1a1a' : 'transparent',
                color: tab === v ? '#f5f5f7' : '#6e6e73',
                boxShadow: tab === v ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
              }}
            >{l}</button>
          ))}
        </div>

        {/* Progress bar (Today tab) */}
        {tab === 'today' && totalToday > 0 && (
          <div className="mb-6">
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${totalToday ? (completedToday / totalToday) * 100 : 0}%`,
                  background: completedToday === totalToday
                    ? 'linear-gradient(90deg,#30d158,#4cd964)'
                    : 'linear-gradient(90deg,rgba(255,255,255,0.2),rgba(255,255,255,0.5))',
                }}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl h-20 skeleton" style={{ backgroundColor: '#111' }} />
            ))}
          </div>
        ) : habits.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
              <Flame className="w-5 h-5" style={{ color: '#6e6e73' }} />
            </div>
            <p className="font-semibold mb-1.5 text-sm" style={{ color: '#f5f5f7' }}>Sin hábitos todavía</p>
            <p className="text-sm mb-7" style={{ color: '#6e6e73' }}>Crea tu primer hábito para empezar a construir rachas</p>
            <button
              onClick={() => { setEditHabit(null); setShowModal(true) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
            >
              <Plus className="w-4 h-4" /> Crear hábito
            </button>
          </div>
        ) : tab === 'today' ? (
          <div className="space-y-2">
            {todayHabits.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm" style={{ color: '#6e6e73' }}>No tienes hábitos programados para hoy</p>
              </div>
            ) : (
              todayHabits.map((h, i) => (
                <div key={h.id} style={{ animation: `card-in 0.3s cubic-bezier(0.16,1,0.3,1) ${i * 45}ms both` }}>
                  <HabitTodayCard
                    habit={h}
                    log={getLog(h.id)}
                    onToggle={handleToggle}
                    onNumericSave={handleNumericSave}
                  />
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {habits.map((h, i) => (
              <div key={h.id} style={{ animation: `card-in 0.3s cubic-bezier(0.16,1,0.3,1) ${i * 55}ms both` }}>
                <HabitManageCard
                  habit={h}
                  logs={getLogsForHabit(h.id)}
                  onEdit={h => { setEditHabit(h); setShowModal(true) }}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewHabitModal
          habit={editHabit}
          onClose={() => { setShowModal(false); setEditHabit(null) }}
          onSaved={fetchAll}
        />
      )}
    </div>
  )
}
