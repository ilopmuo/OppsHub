import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/NavBar'
import NewHabitModal from '../components/habits/NewHabitModal'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const DOW_ES = ['D','L','M','X','J','V','S'] // 0=Dom

function pad(n) { return String(n).padStart(2, '0') }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

function getDays(year, month) {
  const days = [], d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

// Group days by Mon–Sun weeks
function getWeekGroups(days) {
  const groups = []; let cur = []
  for (const d of days) {
    if (d.getDay() === 1 && cur.length) { groups.push(cur); cur = [] }
    cur.push(d)
  }
  if (cur.length) groups.push(cur)
  return groups
}

function isScheduled(habit, day) {
  return habit.type === 'daily' || (habit.days_of_week || []).includes(day.getDay())
}

// ── Streak helpers ────────────────────────────────────────────────────────────
function computeStreaks(habit, allLogs, todayStr) {
  const done = new Set(allLogs.filter(l => l.habit_id === habit.id && l.completed).map(l => l.date))
  const limit = new Date(); limit.setFullYear(limit.getFullYear() - 1)

  // Current streak: walk backwards from today
  let current = 0
  const cursor = new Date()
  while (cursor >= limit) {
    const ds = dateStr(cursor)
    if (isScheduled(habit, cursor)) {
      if (done.has(ds)) { current++ }
      else if (ds < todayStr) { break }
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  // Best streak: walk forward through all past days
  let best = 0, run = 0
  const start = new Date(limit)
  const fwd = new Date(start)
  while (dateStr(fwd) <= todayStr) {
    const ds = dateStr(fwd)
    if (isScheduled(habit, fwd)) {
      if (done.has(ds)) { run++; best = Math.max(best, run) }
      else if (ds < todayStr) { run = 0 }
    }
    fwd.setDate(fwd.getDate() + 1)
  }

  return { current, best }
}

// at-risk: scheduled today and not completed
function isAtRisk(habit, allLogs, todayStr) {
  const done = new Set(allLogs.filter(l => l.habit_id === habit.id && l.completed).map(l => l.date))
  const today = new Date()
  if (isScheduled(habit, today) && !done.has(todayStr)) return true
  return false
}

// streak broken: scheduled yesterday and missed
function isStreakBroken(habit, allLogs, todayStr) {
  const done = new Set(allLogs.filter(l => l.habit_id === habit.id && l.completed).map(l => l.date))
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  return isScheduled(habit, yesterday) && !done.has(dateStr(yesterday))
}

const COL_W  = 38   // px per day column
const NAME_W = 200  // px for habit name column
const BG     = '#111111'

export default function Habits() {
  const { user } = useAuth()
  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth())
  const [habits, setHabits]     = useState([])
  const [logs, setLogs]         = useState([])
  const [allLogs, setAllLogs]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editHabit, setEditHabit] = useState(null)
  const [hovered, setHovered]   = useState(null)

  const days       = getDays(year, month)
  const weekGroups = getWeekGroups(days)
  const TODAY      = dateStr(now)

  useEffect(() => { fetchData() }, [year, month]) // eslint-disable-line
  useEffect(() => { fetchAllLogs() }, [])         // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    const first = dateStr(days[0])
    const last  = dateStr(days[days.length - 1])
    const [{ data: h }, { data: l }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('habit_logs').select('*').gte('date', first).lte('date', last),
    ])
    setHabits(h || [])
    setLogs(l || [])
    setLoading(false)
  }

  async function fetchAllLogs() {
    const since = new Date(); since.setFullYear(since.getFullYear() - 1)
    const { data } = await supabase
      .from('habit_logs').select('*')
      .gte('date', dateStr(since)).eq('completed', true)
    setAllLogs(data || [])
  }

  function getLog(habitId, day) {
    const ds = dateStr(day)
    return logs.find(l => l.habit_id === habitId && l.date === ds)
  }

  function dayProgress(day) {
    const ds        = dateStr(day)
    const scheduled = habits.filter(h => isScheduled(h, day))
    if (!scheduled.length) return null
    const done = scheduled.filter(h =>
      logs.some(l => l.habit_id === h.id && l.date === ds && l.completed)
    ).length
    return { done, total: scheduled.length, pct: Math.round((done / scheduled.length) * 100) }
  }

  async function toggle(habit, day) {
    const ds = dateStr(day)
    if (ds > TODAY) return
    const existing = logs.find(l => l.habit_id === habit.id && l.date === ds)
    if (existing?.completed) {
      setLogs(p => p.filter(l => !(l.habit_id === habit.id && l.date === ds)))
      setAllLogs(p => p.filter(l => !(l.habit_id === habit.id && l.date === ds)))
      supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('date', ds)
    } else {
      const tmp = { id: `tmp-${habit.id}-${ds}`, habit_id: habit.id, user_id: user.id, date: ds, completed: true }
      setLogs(p => [...p.filter(l => !(l.habit_id === habit.id && l.date === ds)), tmp])
      setAllLogs(p => [...p.filter(l => !(l.habit_id === habit.id && l.date === ds)), tmp])
      const { data } = await supabase.from('habit_logs')
        .upsert({ habit_id: habit.id, user_id: user.id, date: ds, completed: true }, { onConflict: 'habit_id,date' })
        .select().single()
      if (data) {
        setLogs(p => [...p.filter(l => l.id !== tmp.id && !(l.habit_id === habit.id && l.date === ds)), data])
        setAllLogs(p => [...p.filter(l => l.id !== tmp.id && !(l.habit_id === habit.id && l.date === ds)), data])
      }
    }
  }

  async function deleteHabit(habit) {
    if (!confirm(`¿Eliminar "${habit.name}"? Se perderá el historial.`)) return
    const { error } = await supabase.from('habits').delete().eq('id', habit.id)
    if (!error) {
      setHabits(p => p.filter(h => h.id !== habit.id))
      setLogs(p => p.filter(l => l.habit_id !== habit.id))
      setAllLogs(p => p.filter(l => l.habit_id !== habit.id))
      toast.success('Hábito eliminado')
    }
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  // Shared style for day header/data cells
  function dayCell(day, di) {
    const isWeekStart = day.getDay() === 1 && di > 0
    const isToday     = dateStr(day) === TODAY
    return {
      width: COL_W, minWidth: COL_W, maxWidth: COL_W,
      textAlign: 'center',
      borderLeft: isWeekStart ? '1px solid rgba(255,255,255,0.08)' : 'none',
      backgroundColor: isToday ? 'rgba(255,255,255,0.025)' : 'transparent',
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000' }}>
      <NavBar />

      <main className="max-w-[1400px] mx-auto px-6 py-10 page-enter">

        {/* ── Page header ── */}
        {(() => {
          // Month progress: scheduled vs completed up to today
          let totalScheduled = 0, totalDone = 0
          for (const d of days) {
            const ds = dateStr(d)
            for (const h of habits) {
              if (!isScheduled(h, d)) continue
              totalScheduled++
              if (logs.some(l => l.habit_id === h.id && l.date === ds && l.completed)) totalDone++
            }
          }
          const pct = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0
          const pctColor = pct >= 80 ? '#30d158' : pct >= 50 ? '#ff9f0a' : '#ff453a'

          return (
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>Hábitos</p>
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: '#6e6e73' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f5f5f7' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6e6e73' }}
                  ><ChevronLeft className="w-4 h-4" /></button>

                  <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em', minWidth: 260 }}>
                    {MONTH_NAMES[month]} <span style={{ color: '#4a4a4a' }}>{year}</span>
                  </h1>

                  <button onClick={nextMonth}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: '#6e6e73' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f5f5f7' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6e6e73' }}
                  ><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>

              {/* ── Month progress ── */}
              {!loading && totalScheduled > 0 && (
                <div style={{
                  flex: 1, maxWidth: 340, margin: '0 40px',
                  backgroundColor: '#111', borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.07)',
                  padding: '16px 20px',
                }}>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Progreso del mes</p>
                      <p style={{ fontSize: 28, fontWeight: 800, color: '#f5f5f7', letterSpacing: '-0.03em', lineHeight: 1 }}>{pct}<span style={{ fontSize: 14, fontWeight: 600, color: '#4a4a4a' }}>%</span></p>
                    </div>
                    <p style={{ fontSize: 12, color: '#4a4a4a', fontWeight: 500, paddingBottom: 2 }}>
                      <span style={{ color: '#f5f5f7', fontWeight: 700 }}>{totalDone}</span> / {totalScheduled}
                    </p>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: 'linear-gradient(90deg, #3a3a3a, #f5f5f7)', transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              )}

              <button
                onClick={() => { setEditHabit(null); setShowModal(true) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ backgroundColor: '#f5f5f7', color: '#000' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
              ><Plus className="w-4 h-4" /> Nuevo hábito</button>
            </div>
          )
        })()}

        {/* ── Stats pills ── */}
        {!loading && habits.length > 0 && (() => {
          const perfectDays = days.filter(d => {
            const ds = dateStr(d)
            if (ds > TODAY) return false
            const scheduled = habits.filter(h => isScheduled(h, d))
            if (!scheduled.length) return false
            return scheduled.every(h => logs.some(l => l.habit_id === h.id && l.date === ds && l.completed))
          }).length
          const atRiskCount = habits.filter(h => isAtRisk(h, allLogs, TODAY)).length
          const brokenCount = habits.filter(h => isStreakBroken(h, allLogs, TODAY)).length
          return (
            <div className="flex items-center gap-3 mb-6">
              <div style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⭐</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#f5f5f7', lineHeight: 1 }}>{perfectDays}</p>
                  <p style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>Días perfectos</p>
                </div>
              </div>
              {atRiskCount > 0 && (
                <div style={{ backgroundColor: '#111', border: '1px solid rgba(255,180,0,0.2)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#ff9f0a', lineHeight: 1 }}>{atRiskCount}</p>
                    <p style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>Pendientes hoy</p>
                  </div>
                </div>
              )}
              {brokenCount > 0 && (
                <div style={{ backgroundColor: '#111', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>💔</span>
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#ff453a', lineHeight: 1 }}>{brokenCount}</p>
                    <p style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>Rachas rotas</p>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Loading ── */}
        {loading ? (
          <div className="skeleton rounded-2xl" style={{ height: 320 }} />
        ) : habits.length === 0 ? (

          /* ── Empty state ── */
          <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: BG, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <p className="font-semibold mb-1.5 text-sm" style={{ color: '#f5f5f7' }}>Sin hábitos todavía</p>
            <p className="text-sm mb-7" style={{ color: '#6e6e73' }}>Crea tu primer hábito para empezar a construir rachas</p>
            <button
              onClick={() => { setEditHabit(null); setShowModal(true) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#f5f5f7', color: '#000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
            ><Plus className="w-4 h-4" /> Crear hábito</button>
          </div>

        ) : (
          <>
          {/* ── Top Habits ── */}
          {(() => {
            const top = habits
              .map(h => ({ habit: h, count: logs.filter(l => l.habit_id === h.id && l.completed).length }))
              .filter(x => x.count > 0)
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
            if (!top.length) return null
            return (
              <div className="mb-3 flex items-center gap-4 flex-wrap">
                <span style={{ fontSize: 10, fontWeight: 600, color: '#3a3a3a', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>Top</span>
                {top.map(({ habit, count }, i) => (
                  <div key={habit.id} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 600 }}>{i + 1}.</span>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: habit.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#6e6e73', fontWeight: 500 }}>{habit.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: habit.color }}>{count}</span>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── Main grid ── */}
          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              tableLayout: 'fixed',
              width: NAME_W + days.length * COL_W,
              backgroundColor: BG,
            }}>
              <thead>

                {/* ── Row 1: Week group headers ── */}
                <tr>
                  {/* Top-left corner cell — spans rows 1-3 */}
                  <th rowSpan={3} style={{
                    position: 'sticky', left: 0, zIndex: 4,
                    width: NAME_W, minWidth: NAME_W,
                    backgroundColor: BG,
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    padding: '16px 20px 14px',
                    textAlign: 'left', verticalAlign: 'bottom',
                  }}>
                    <span style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.08em' }}>HÁBITO</span>
                  </th>

                  {weekGroups.map((g, gi) => (
                    <th key={gi} colSpan={g.length} style={{
                      textAlign: 'center',
                      padding: '14px 0 6px',
                      borderLeft: gi > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      backgroundColor: BG,
                      fontSize: 10, fontWeight: 500,
                      color: '#3a3a3a',
                      letterSpacing: '0.05em',
                    }}>
                      SEM {gi + 1} · {g[0].getDate()}–{g[g.length - 1].getDate()}
                    </th>
                  ))}
                </tr>

                {/* ── Row 2: Day-of-week labels ── */}
                <tr>
                  {days.map((day, di) => {
                    const isToday   = dateStr(day) === TODAY
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
                    return (
                      <th key={di} style={{
                        ...dayCell(day, di),
                        padding: '6px 0 2px',
                        fontSize: 10,
                        color: isToday ? '#f5f5f7' : isWeekend ? '#4a4a4a' : '#3a3a3a',
                        fontWeight: isToday ? 700 : 400,
                      }}>
                        {DOW_ES[day.getDay()]}
                      </th>
                    )
                  })}
                </tr>

                {/* ── Row 3: Day numbers ── */}
                <tr>
                  {days.map((day, di) => {
                    const isToday = dateStr(day) === TODAY
                    return (
                      <th key={di} style={{
                        ...dayCell(day, di),
                        padding: '2px 0 10px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: '50%',
                          fontSize: 11, fontWeight: isToday ? 700 : 400,
                          backgroundColor: isToday ? '#f5f5f7' : 'transparent',
                          color: isToday ? '#000' : '#6e6e73',
                        }}>
                          {day.getDate()}
                        </span>
                      </th>
                    )
                  })}
                </tr>

                {/* ── Row 4: Vertical progress bars ── */}
                <tr>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    backgroundColor: BG,
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    padding: '10px 20px',
                  }}>
                    <span style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.08em' }}>PROGRESO</span>
                  </td>

                  {days.map((day, di) => {
                    const isToday  = dateStr(day) === TODAY
                    const isFuture = dateStr(day) > TODAY
                    const prog     = dayProgress(day)
                    const pct      = prog?.pct ?? 0
                    const barColor = pct === 100 ? '#30d158' : isToday ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'

                    return (
                      <td key={di} style={{
                        ...dayCell(day, di),
                        padding: '6px 0 8px',
                        verticalAlign: 'bottom',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {/* Percentage label */}
                          <span style={{
                            fontSize: 8, lineHeight: 1, fontWeight: 600,
                            color: pct === 100 ? '#30d158' : '#4a4a4a',
                            minHeight: 9,
                            visibility: (!isFuture && pct > 0) ? 'visible' : 'hidden',
                          }}>
                            {pct}%
                          </span>

                          {/* Bar container */}
                          <div style={{
                            width: 14, height: 44,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 4,
                            display: 'flex', alignItems: 'flex-end',
                            overflow: 'hidden',
                          }}>
                            {!isFuture && pct > 0 && (
                              <div style={{
                                width: '100%',
                                height: `${pct}%`,
                                minHeight: 3,
                                backgroundColor: barColor,
                                borderRadius: 4,
                                transition: 'height 0.4s ease',
                              }} />
                            )}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {habits.map((habit, hi) => {
                  const isHovered = hovered === habit.id
                  const isLast    = hi === habits.length - 1
                  const atRisk    = isAtRisk(habit, allLogs, TODAY)
                  const broken    = isStreakBroken(habit, allLogs, TODAY)
                  return (
                    <tr
                      key={habit.id}
                      onMouseEnter={() => setHovered(habit.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* ── Habit name cell ── */}
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 1,
                        width: NAME_W, minWidth: NAME_W,
                        backgroundColor: isHovered ? '#161616' : BG,
                        borderRight: '1px solid rgba(255,255,255,0.08)',
                        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        padding: '10px 20px',
                        transition: 'background-color 0.1s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: habit.color, flexShrink: 0 }} />
                            <span style={{
                              fontSize: 13, color: '#f5f5f7',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: 90,
                            }}>{habit.name}</span>
                            {broken && <span title="Racha rota ayer" style={{ fontSize: 11, lineHeight: 1 }}>💔</span>}
                            {!broken && atRisk && <span title="Pendiente hoy" style={{ fontSize: 11, lineHeight: 1 }}>⚠️</span>}
                          </div>

                          {/* Edit / delete shown on row hover */}
                          <div style={{
                            display: 'flex', gap: 2, flexShrink: 0,
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.15s',
                          }}>
                            <button
                              onClick={() => { setEditHabit(habit); setShowModal(true) }}
                              style={{
                                width: 22, height: 22, borderRadius: 6,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: '#6e6e73', backgroundColor: 'rgba(255,255,255,0.06)',
                                border: 'none', cursor: 'pointer',
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
                              onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
                            >
                              <Pencil style={{ width: 11, height: 11 }} />
                            </button>
                            <button
                              onClick={() => deleteHabit(habit)}
                              style={{
                                width: 22, height: 22, borderRadius: 6,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: '#6e6e73', backgroundColor: 'rgba(255,255,255,0.06)',
                                border: 'none', cursor: 'pointer',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#ff453a'; e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.12)' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                            >
                              <Trash2 style={{ width: 11, height: 11 }} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* ── Day cells ── */}
                      {days.map((day, di) => {
                        const isToday     = dateStr(day) === TODAY
                        const isFuture    = dateStr(day) > TODAY
                        const scheduled   = isScheduled(habit, day)
                        const log         = getLog(habit.id, day)
                        const done        = log?.completed

                        return (
                          <td key={di} style={{
                            ...dayCell(day, di),
                            padding: '9px 0',
                            borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                            backgroundColor: isToday
                              ? (isHovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)')
                              : isHovered ? 'rgba(255,255,255,0.01)' : 'transparent',
                          }}>
                            {scheduled && (
                              <button
                                onClick={() => toggle(habit, day)}
                                style={{
                                  width: 20, height: 20,
                                  borderRadius: 5,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  backgroundColor: done ? habit.color + '28' : 'rgba(255,255,255,0.04)',
                                  border: `1.5px solid ${done ? habit.color + 'bb' : 'rgba(255,255,255,0.1)'}`,
                                  cursor: isFuture ? 'default' : 'pointer',
                                  opacity: isFuture ? 0.2 : 1,
                                  transition: 'border-color 0.12s, background-color 0.12s',
                                }}
                              >
                                {done && (
                                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke={habit.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Habit Reports ── */}
          {(() => {
            const BG2 = '#111'
            const pastDays = days.filter(d => dateStr(d) <= TODAY)

            // ── Data: completion % per habit (full month scheduled) ──────────
            const habitStats = habits.map(h => {
              const scheduled = days.filter(d => isScheduled(h, d)).length
              const done      = logs.filter(l => l.habit_id === h.id && l.completed).length
              const pct       = scheduled > 0 ? Math.round(done / scheduled * 100) : 0
              return { habit: h, scheduled, done, pct }
            }).sort((a, b) => b.pct - a.pct)

            // ── Data: daily total completions (past days only) ────────────────
            const dailyData = pastDays.map(d => {
              const ds   = dateStr(d)
              const done = logs.filter(l => l.date === ds && l.completed).length
              const sched = habits.filter(h => isScheduled(h, d)).length
              return { day: d.getDate(), done, sched, pct: sched > 0 ? done / sched : 0 }
            })

            // ── Data: avg completion % by day of week (0=Mon…6=Sun) ──────────
            const DOW_LABEL = ['L','M','X','J','V','S','D']
            const dowStats = DOW_LABEL.map((label, i) => {
              const dowIndex = i === 6 ? 0 : i + 1 // Mon=1…Sun=0
              const relevant = pastDays.filter(d => d.getDay() === dowIndex)
              let sched = 0, done = 0
              relevant.forEach(d => {
                const ds = dateStr(d)
                habits.forEach(h => {
                  if (!isScheduled(h, d)) return
                  sched++
                  if (logs.some(l => l.habit_id === h.id && l.date === ds && l.completed)) done++
                })
              })
              const pct = sched > 0 ? Math.round(done / sched * 100) : 0
              return { label, pct, sched }
            })

            if (!habits.length) return null

            // ── SVG helpers ───────────────────────────────────────────────────
            const W = 340, H = 100, PAD = { t: 8, r: 8, b: 24, l: 28 }
            const chartW = W - PAD.l - PAD.r
            const chartH = H - PAD.t - PAD.b

            // Line chart path for daily trend
            const maxDone = Math.max(...dailyData.map(d => d.done), 1)
            const linePoints = dailyData.map((d, i) => {
              const x = PAD.l + (i / Math.max(dailyData.length - 1, 1)) * chartW
              const y = PAD.t + chartH - (d.done / maxDone) * chartH
              return `${x},${y}`
            }).join(' ')
            const areaPath = dailyData.length > 1
              ? `M ${PAD.l},${PAD.t + chartH} ` +
                dailyData.map((d, i) => {
                  const x = PAD.l + (i / (dailyData.length - 1)) * chartW
                  const y = PAD.t + chartH - (d.done / maxDone) * chartH
                  return `L ${x},${y}`
                }).join(' ') +
                ` L ${PAD.l + chartW},${PAD.t + chartH} Z`
              : ''

            return (
              <div className="mt-8">
                <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: '#3a3a3a' }}>Habit Reports</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

                  {/* ── Chart 1: Tasa por hábito ── */}
                  <div style={{ backgroundColor: BG2, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 14 }}>Completado por hábito</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {habitStats.map(({ habit, pct, done, scheduled }) => (
                        <div key={habit.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: habit.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#f5f5f7', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73' }}>{done}/{scheduled}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: habit.color, opacity: 0.85, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Chart 2: Tendencia diaria ── */}
                  <div style={{ backgroundColor: BG2, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 8 }}>Tendencia diaria</p>
                    {dailyData.length < 2 ? (
                      <p style={{ fontSize: 11, color: '#3a3a3a', marginTop: 24, textAlign: 'center' }}>Sin datos suficientes</p>
                    ) : (
                      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                        {/* Y axis ticks */}
                        {[0, Math.round(maxDone / 2), maxDone].map((v, i) => {
                          const y = PAD.t + chartH - (v / maxDone) * chartH
                          return (
                            <g key={i}>
                              <line x1={PAD.l - 4} y1={y} x2={PAD.l + chartW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                              <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="8" fill="#3a3a3a">{v}</text>
                            </g>
                          )
                        })}
                        {/* Area fill */}
                        {areaPath && <path d={areaPath} fill="rgba(255,255,255,0.04)" />}
                        {/* Line */}
                        <polyline points={linePoints} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        {/* Dots */}
                        {dailyData.map((d, i) => {
                          const x = PAD.l + (i / (dailyData.length - 1)) * chartW
                          const y = PAD.t + chartH - (d.done / maxDone) * chartH
                          return <circle key={i} cx={x} cy={y} r="2.5" fill="#f5f5f7" />
                        })}
                        {/* X axis labels: first, mid, last */}
                        {[0, Math.floor((dailyData.length - 1) / 2), dailyData.length - 1].map(i => {
                          const x = PAD.l + (i / (dailyData.length - 1)) * chartW
                          return <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize="8" fill="#3a3a3a">{dailyData[i]?.day}</text>
                        })}
                      </svg>
                    )}
                  </div>

                  {/* ── Chart 3: Día de la semana ── */}
                  <div style={{ backgroundColor: BG2, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 8 }}>Rendimiento por día</p>
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                      {/* Y grid */}
                      {[0, 50, 100].map(v => {
                        const y = PAD.t + chartH - (v / 100) * chartH
                        return (
                          <g key={v}>
                            <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="8" fill="#3a3a3a">{v}</text>
                          </g>
                        )
                      })}
                      {/* Bars */}
                      {dowStats.map(({ label, pct, sched }, i) => {
                        const barW  = chartW / 7 - 4
                        const x     = PAD.l + i * (chartW / 7) + 2
                        const barH  = (pct / 100) * chartH
                        const y     = PAD.t + chartH - barH
                        const alpha = sched === 0 ? 0.08 : 0.7
                        return (
                          <g key={i}>
                            <rect x={x} y={PAD.t} width={barW} height={chartH} rx="3" fill="rgba(255,255,255,0.03)" />
                            {sched > 0 && <rect x={x} y={y} width={barW} height={barH} rx="3" fill={`rgba(245,245,247,${alpha})`} />}
                            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="8" fill={sched > 0 ? '#6e6e73' : '#3a3a3a'}>{label}</text>
                            {sched > 0 && pct > 0 && (
                              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="7" fill="#4a4a4a">{pct}%</text>
                            )}
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                </div>

                {/* ── Second row: Rachas + Heatmap ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginTop: 12 }}>

                  {/* ── Chart 4: Rachas por hábito ── */}
                  <div style={{ backgroundColor: BG2, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 14 }}>Rachas</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {habits.map(h => {
                        const { current, best } = computeStreaks(h, allLogs, TODAY)
                        return (
                          <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: h.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#f5f5f7', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{h.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 14, fontWeight: 800, color: current > 0 ? '#f5f5f7' : '#3a3a3a', lineHeight: 1 }}>{current}</p>
                                <p style={{ fontSize: 8, color: '#3a3a3a', marginTop: 1 }}>actual</p>
                              </div>
                              <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 14, fontWeight: 800, color: '#4a4a4a', lineHeight: 1 }}>{best}</p>
                                <p style={{ fontSize: 8, color: '#3a3a3a', marginTop: 1 }}>récord</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Chart 5: Heatmap anual ── */}
                  {(() => {
                    const WEEKS = 52
                    const CELL  = 11
                    const GAP   = 2
                    const totalW = WEEKS * (CELL + GAP)
                    const totalH = 7 * (CELL + GAP) + 20

                    // Build map: date → pct
                    const heatData = {}
                    const heatStart = new Date(); heatStart.setDate(heatStart.getDate() - WEEKS * 7 + 1)

                    const cursor2 = new Date(heatStart)
                    while (dateStr(cursor2) <= TODAY) {
                      const ds = dateStr(cursor2)
                      const scheduled = habits.filter(h => isScheduled(h, cursor2))
                      if (scheduled.length) {
                        const done = scheduled.filter(h => allLogs.some(l => l.habit_id === h.id && l.date === ds && l.completed)).length
                        heatData[ds] = done / scheduled.length
                      }
                      cursor2.setDate(cursor2.getDate() + 1)
                    }

                    // Build week columns (Mon=0 at top)
                    const weeks = []
                    const startCursor = new Date(heatStart)
                    // Align to Monday
                    const startDow = (startCursor.getDay() + 6) % 7
                    startCursor.setDate(startCursor.getDate() - startDow)
                    for (let w = 0; w < WEEKS; w++) {
                      const col = []
                      for (let d = 0; d < 7; d++) {
                        const ds = dateStr(startCursor)
                        col.push({ ds, pct: heatData[ds] ?? null, isFuture: ds > TODAY, isOutRange: ds < dateStr(heatStart) })
                        startCursor.setDate(startCursor.getDate() + 1)
                      }
                      weeks.push(col)
                    }

                    // Month labels
                    const monthLabels = []
                    weeks.forEach((col, wi) => {
                      const firstReal = col.find(c => !c.isOutRange && !c.isFuture)
                      if (firstReal) {
                        const d = new Date(firstReal.ds)
                        if (d.getDate() <= 7) monthLabels.push({ wi, label: MONTH_NAMES[d.getMonth()].slice(0, 3) })
                      }
                    })

                    return (
                      <div style={{ backgroundColor: BG2, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 12 }}>Actividad anual</p>
                        <div style={{ overflowX: 'auto' }}>
                          <svg width={totalW} height={totalH} style={{ display: 'block' }}>
                            {/* Month labels */}
                            {monthLabels.map(({ wi, label }) => (
                              <text key={wi} x={wi * (CELL + GAP)} y={10} fontSize="8" fill="#3a3a3a">{label}</text>
                            ))}
                            {/* Cells */}
                            {weeks.map((col, wi) =>
                              col.map(({ ds, pct, isFuture, isOutRange }, di) => {
                                const x = wi * (CELL + GAP)
                                const y = 14 + di * (CELL + GAP)
                                let fill = 'rgba(255,255,255,0.04)'
                                if (!isFuture && !isOutRange && pct !== null) {
                                  const alpha = pct === 0 ? 0.06 : 0.1 + pct * 0.7
                                  fill = `rgba(245,245,247,${alpha.toFixed(2)})`
                                }
                                return <rect key={ds} x={x} y={y} width={CELL} height={CELL} rx="2" fill={fill} />
                              })
                            )}
                          </svg>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                          <span style={{ fontSize: 8, color: '#3a3a3a' }}>Menos</span>
                          {[0.06, 0.2, 0.45, 0.65, 0.85].map((a, i) => (
                            <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: `rgba(245,245,247,${a})` }} />
                          ))}
                          <span style={{ fontSize: 8, color: '#3a3a3a' }}>Más</span>
                        </div>
                      </div>
                    )
                  })()}

                </div>

              </div>
            )
          })()}

          </>
        )}
      </main>

      {showModal && (
        <NewHabitModal
          habit={editHabit}
          onClose={() => { setShowModal(false); setEditHabit(null) }}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}
