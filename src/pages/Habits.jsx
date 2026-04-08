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
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editHabit, setEditHabit] = useState(null)
  const [hovered, setHovered]   = useState(null)

  const days       = getDays(year, month)
  const weekGroups = getWeekGroups(days)
  const TODAY      = dateStr(now)

  useEffect(() => { fetchData() }, [year, month]) // eslint-disable-line

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
      supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('date', ds)
    } else {
      const tmp = { id: `tmp-${habit.id}-${ds}`, habit_id: habit.id, user_id: user.id, date: ds, completed: true }
      setLogs(p => [...p.filter(l => !(l.habit_id === habit.id && l.date === ds)), tmp])
      const { data } = await supabase.from('habit_logs')
        .upsert({ habit_id: habit.id, user_id: user.id, date: ds, completed: true }, { onConflict: 'habit_id,date' })
        .select().single()
      if (data) setLogs(p => [...p.filter(l => l.id !== tmp.id && !(l.habit_id === habit.id && l.date === ds)), data])
    }
  }

  async function deleteHabit(habit) {
    if (!confirm(`¿Eliminar "${habit.name}"? Se perderá el historial.`)) return
    const { error } = await supabase.from('habits').delete().eq('id', habit.id)
    if (!error) {
      setHabits(p => p.filter(h => h.id !== habit.id))
      setLogs(p => p.filter(l => l.habit_id !== habit.id))
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

          <button
            onClick={() => { setEditHabit(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{ backgroundColor: '#f5f5f7', color: '#000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
          ><Plus className="w-4 h-4" /> Nuevo hábito</button>
        </div>

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
              .slice(0, 5)
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
                              maxWidth: 110,
                            }}>{habit.name}</span>
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
