import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ── Date helpers ─────────────────────────────────────────────
// Format a Date object as YYYY-MM-DD using LOCAL time components.
// Never use toISOString() after date arithmetic — it outputs UTC and
// shifts the date one day back in UTC+ timezones (e.g. Spain UTC+1/+2).
function localDateStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── Madrid public holidays ────────────────────────────────────
// Covers national (Spain) + Comunidad de Madrid festivos.
// Uses the Anonymous Gregorian algorithm for Easter.
const _holidayCache = {}

function easterDate(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function getMadridHolidays(year) {
  if (_holidayCache[year]) return _holidayCache[year]
  const set = new Set()
  const add = (mo, d) =>
    set.add(`${year}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`)

  // Nacionales fijos
  add(1,  1)   // Año Nuevo
  add(1,  6)   // Reyes Magos
  add(5,  1)   // Día del Trabajo
  add(8,  15)  // Asunción de la Virgen
  add(10, 12)  // Fiesta Nacional de España
  add(11, 1)   // Todos los Santos
  add(12, 6)   // Día de la Constitución
  add(12, 8)   // Inmaculada Concepción
  add(12, 25)  // Navidad

  // Comunidad de Madrid
  add(5,  2)   // Día de la Comunidad de Madrid
  add(11, 9)   // Nuestra Señora de la Almudena

  // Semana Santa (variables)
  const easter  = easterDate(year)
  const jueves  = new Date(easter); jueves.setDate(easter.getDate() - 3)
  const viernes = new Date(easter); viernes.setDate(easter.getDate() - 2)
  set.add(localDateStr(jueves))   // Jueves Santo
  set.add(localDateStr(viernes))  // Viernes Santo (nacional)

  _holidayCache[year] = set
  return set
}

export function isHoliday(dateStr) {
  const year = parseInt(dateStr.slice(0, 4), 10)
  return getMadridHolidays(year).has(dateStr)
}

// ── Computed phase status ─────────────────────────────────────
// Auto-detects delay and risk from dates + progress.
// Rules (in priority order):
//   1. progress ≥ 100 → on_track (done)
//   2. today > end_date && progress < 100 → delayed
//   3. phase is active && expectedProgress – actualProgress > 25 → at_risk
//   4. fall back to stored manual status
export function computePhaseStatus(phase) {
  if (phase.is_milestone) return null
  const todayStr = today()
  const progress = phase.progress ?? 0
  if (progress >= 100) return 'on_track'
  if (todayStr > phase.end_date) return 'delayed'
  if (todayStr >= phase.start_date) {
    const elapsed     = daysBetween(phase.start_date, todayStr)
    const total       = Math.max(daysBetween(phase.start_date, phase.end_date), 1)
    const expectedPct = (elapsed / total) * 100
    if (expectedPct - progress > 25) return 'at_risk'
  }
  return phase.status ?? 'on_track'
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

export function daysBetween(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00')
  const b = new Date(bStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

export function today() {
  return localDateStr(new Date())
}

// ── Per-month coordinate helpers ──────────────────────────────
// monthHeaders is the array produced by buildMonthHeaders in GanttChart.
// Each entry has: { left, width, dayPx, days, startDate, monthKey }

export function mhDateToPixel(dateStr, monthHeaders) {
  if (!monthHeaders || monthHeaders.length === 0) return 0
  for (let i = 0; i < monthHeaders.length - 1; i++) {
    if (dateStr < monthHeaders[i + 1].startDate) {
      return monthHeaders[i].left + daysBetween(monthHeaders[i].startDate, dateStr) * monthHeaders[i].dayPx
    }
  }
  const last = monthHeaders[monthHeaders.length - 1]
  return last.left + daysBetween(last.startDate, dateStr) * last.dayPx
}

export function mhPixelToDate(px, monthHeaders) {
  if (!monthHeaders || monthHeaders.length === 0) return ''
  for (let i = 0; i < monthHeaders.length; i++) {
    const mh = monthHeaders[i]
    if (px < mh.left + mh.width || i === monthHeaders.length - 1) {
      const days = Math.round(Math.max(0, px - mh.left) / mh.dayPx)
      return addDays(mh.startDate, days)
    }
  }
  return monthHeaders[0].startDate
}

// Adds n working days (Mon–Fri, skipping Madrid holidays) to a date.
export function addWorkingDays(dateStr, n) {
  if (n <= 0) return dateStr
  const d = new Date(dateStr + 'T00:00:00')
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    const ds  = localDateStr(d)
    if (dow !== 0 && dow !== 6 && !isHoliday(ds)) added++
  }
  return localDateStr(d)
}

// Returns end_date given a start date, total hours and hours worked per day.
// Skips weekends. Returns null if inputs are invalid.
export function calcEndDateFromHours(startDate, hours, hoursPerDay) {
  if (!startDate || !(hours > 0) || !(hoursPerDay > 0)) return null
  const workingDays = Math.ceil(hours / hoursPerDay)
  return addWorkingDays(startDate, workingDays - 1) // start day counts as day 1
}

// Counts working days (Mon–Fri, skipping Madrid holidays) in [start, end] inclusive.
export function workingDaysBetween(startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00')
  const end   = new Date(endStr   + 'T00:00:00')
  if (end < start) return 0
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    const ds  = localDateStr(d)
    if (dow !== 0 && dow !== 6 && !isHoliday(ds)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ── Cascade: shift all phases after changedIndex by delta days ─
function cascadeFromIndex(phases, changedIndex, delta) {
  if (delta === 0) return phases
  return phases.map((phase, i) => {
    if (i <= changedIndex) return phase
    return {
      ...phase,
      start_date: addDays(phase.start_date, delta),
      end_date:   addDays(phase.end_date,   delta),
    }
  })
}

// ── Sprint overlap resolution ─────────────────────────────────
// Only sprint-marked phases enforce the no-overlap rule.
// If a sprint phase would start on the same day (or before) the previous
// phase ends, it shifts forward so it starts the day after.
// Non-sprint phases can overlap freely.
export function resolveSprintOverlaps(phases) {
  const result = phases.map(p => ({ ...p }))
  for (let i = 1; i < result.length; i++) {
    if (!result[i].is_sprint) continue
    const gap = daysBetween(result[i - 1].end_date, result[i].start_date)
    if (gap < 1) {
      const delta = 1 - gap
      for (let j = i; j < result.length; j++) {
        result[j] = {
          ...result[j],
          start_date: addDays(result[j].start_date, delta),
          end_date:   addDays(result[j].end_date,   delta),
        }
      }
    }
  }
  return result
}

// Returns the phases whose start_date or end_date changed vs. originals.
function diffPhases(original, updated) {
  return updated.filter(p => {
    const o = original.find(x => x.id === p.id)
    return !o || o.start_date !== p.start_date || o.end_date !== p.end_date
  })
}

// ── Main hook ────────────────────────────────────────────────
export default function usePlan(planId) {
  const [plan,             setPlan]             = useState(null)
  const [phases,           setPhases]           = useState([])
  const [loading,          setLoading]          = useState(true)
  const [saving,           setSaving]           = useState(false)
  const [snapshots,        setSnapshots]        = useState([])
  const [activeSnapshotId, setActiveSnapshotId] = useState(null)

  // ── Fetch ────────────────────────────────────────────────
  const fetchPlan = useCallback(async () => {
    if (!planId) return
    setLoading(true)

    const [planResult, snapshotsResult] = await Promise.all([
      supabase
        .from('project_plans')
        .select(`*, plan_phases(*, plan_tasks(*)), project:project_id(id, name, icon_url)`)
        .eq('id', planId)
        .single(),
      supabase
        .from('plan_snapshots')
        .select(`*, plan_snapshot_phases(*)`)
        .eq('plan_id', planId)
        .order('created_at', { ascending: true }),
    ])

    if (planResult.error) {
      toast.error('Error al cargar el plan')
      setLoading(false)
      return
    }

    const sortedPhases = (planResult.data.plan_phases || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(ph => ({
        ...ph,
        plan_tasks: (ph.plan_tasks || []).sort((a, b) => a.order_index - b.order_index),
      }))

    const loadedSnapshots = snapshotsResult.data || []

    setPlan(planResult.data)
    setPhases(sortedPhases)
    setSnapshots(loadedSnapshots)
    // Auto-select the most recent snapshot as the active comparison
    setActiveSnapshotId(prev => {
      if (prev) return prev  // keep user's selection across refetches
      return loadedSnapshots.length > 0
        ? loadedSnapshots[loadedSnapshots.length - 1].id
        : null
    })
    setLoading(false)
  }, [planId])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  // ── Plan metadata update ─────────────────────────────────
  async function updatePlan(fields) {
    setPlan(p => ({ ...p, ...fields }))
    const { error } = await supabase
      .from('project_plans')
      .update(fields)
      .eq('id', planId)
    if (error) { toast.error('Error al guardar'); fetchPlan() }
  }

  // ── Add phase ────────────────────────────────────────────
  async function addPhase() {
    const PHASE_COLORS = ['#bf5af2', '#64d2ff', '#30d158', '#ff9f0a', '#ff453a']
    const lastPhase = phases[phases.length - 1]
    const newStart = lastPhase ? addDays(lastPhase.end_date, 1) : (plan?.start_date || today())
    const newEnd   = addDays(newStart, 13) // 2 weeks default
    const newOrder = phases.length
    const color    = PHASE_COLORS[phases.length % PHASE_COLORS.length]

    const payload = {
      plan_id:       planId,
      name:          `Fase ${phases.length + 1}`,
      start_date:    newStart,
      end_date:      newEnd,
      hours:         0,
      hours_per_day: 8,
      is_sprint:     false,
      is_milestone:  false,
      progress:      0,
      status:        'on_track',
      description:   null,
      depends_on:    null,
      color,
      order_index:   newOrder,
    }

    // Optimistic
    const tempId = `temp-${Date.now()}`
    const optimistic = { ...payload, id: tempId, plan_tasks: [] }
    setPhases(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('plan_phases')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error('Error al añadir fase')
      setPhases(prev => prev.filter(p => p.id !== tempId))
      return
    }

    setPhases(prev => prev.map(p => p.id === tempId ? { ...data, plan_tasks: [] } : p))
  }

  // ── Add milestone ───────────────────────────────────────
  async function addMilestone() {
    const lastPhase = phases[phases.length - 1]
    const date      = lastPhase ? lastPhase.end_date : (plan?.start_date || today())
    const newOrder  = phases.length

    const payload = {
      plan_id:      planId,
      name:         `Hito ${phases.filter(p => p.is_milestone).length + 1}`,
      start_date:   date,
      end_date:     date,
      hours:        0,
      hours_per_day: 8,
      is_sprint:    false,
      is_milestone: true,
      progress:     0,
      status:       'on_track',
      description:  null,
      depends_on:   null,
      color:        '#ff9f0a',
      order_index:  newOrder,
    }

    const tempId = `temp-${Date.now()}`
    setPhases(prev => [...prev, { ...payload, id: tempId, plan_tasks: [] }])

    const { data, error } = await supabase
      .from('plan_phases').insert(payload).select().single()

    if (error) {
      toast.error('Error al añadir hito')
      setPhases(prev => prev.filter(p => p.id !== tempId))
      return
    }
    setPhases(prev => prev.map(p => p.id === tempId ? { ...data, plan_tasks: [] } : p))
  }

  // ── Update phase ─────────────────────────────────────────
  async function updatePhase(phaseId, fields, { cascade = false } = {}) {
    const idx = phases.findIndex(p => p.id === phaseId)
    if (idx === -1) return

    const current = phases[idx]
    let updatedFields = { ...fields }

    // Sprint constraint: if this phase is a sprint and its start_date is being
    // changed, clamp it to the day after the previous phase's end_date.
    if (updatedFields.start_date !== undefined && current.is_sprint && idx > 0) {
      const prevEnd = phases[idx - 1].end_date
      if (updatedFields.start_date <= prevEnd) {
        updatedFields.start_date = addDays(prevEnd, 1)
      }
    }

    // Milestone constraint: start and end must always be the same date.
    if (current.is_milestone) {
      if (updatedFields.start_date) updatedFields.end_date = updatedFields.start_date
      if (updatedFields.end_date)   updatedFields.start_date = updatedFields.end_date
    }

    const hoursChanged = fields.hours         !== undefined
    const hpdChanged   = fields.hours_per_day !== undefined
    const startChanged = fields.start_date    !== undefined
    const endChanged   = fields.end_date      !== undefined

    if (hoursChanged || hpdChanged) {
      // ── Hours → end_date ──────────────────────────────────
      const merged = { ...current, ...updatedFields }
      const newEnd = calcEndDateFromHours(merged.start_date, merged.hours, merged.hours_per_day)
      if (newEnd) { updatedFields.end_date = newEnd; cascade = true }

    } else if (startChanged && !endChanged) {
      // ── Start date moved ──────────────────────────────────
      const merged = { ...current, ...updatedFields }
      if (merged.hours > 0 && (merged.hours_per_day ?? 8) > 0) {
        // Shift end_date to preserve work estimate
        const newEnd = calcEndDateFromHours(merged.start_date, merged.hours, merged.hours_per_day ?? 8)
        if (newEnd) { updatedFields.end_date = newEnd; cascade = true }
      } else {
        // No hours yet: infer hours from the fixed date range
        const hpd  = merged.hours_per_day ?? 8
        const days = workingDaysBetween(merged.start_date, merged.end_date)
        updatedFields.hours = Math.round(days * hpd * 10) / 10
      }

    } else if (endChanged && !hoursChanged) {
      // ── End date moved manually → recalculate hours ───────
      const merged = { ...current, ...updatedFields }
      const hpd  = merged.hours_per_day ?? 8
      const days = workingDaysBetween(merged.start_date, merged.end_date)
      updatedFields.hours = Math.round(days * hpd * 10) / 10
    }

    let newPhases = phases.map((p, i) =>
      i === idx ? { ...p, ...updatedFields } : p
    )

    // If end_date changed and cascade enabled, shift subsequent phases
    if (cascade && updatedFields.end_date) {
      const oldEnd = phases[idx].end_date
      const delta  = daysBetween(oldEnd, updatedFields.end_date)
      newPhases = cascadeFromIndex(newPhases, idx, delta)
    }

    // Resolve sprint overlaps after cascade
    const finalPhases = resolveSprintOverlaps(newPhases)
    setPhases(finalPhases)

    // Always save the directly updated phase (non-date fields may have changed too).
    // Also save any other phases whose dates shifted due to cascade / sprint resolution.
    const toUpdate = finalPhases.filter((p, i) => {
      if (p.id === phaseId) return true
      const o = phases.find(x => x.id === p.id)
      return !o || o.start_date !== p.start_date || o.end_date !== p.end_date
    })
    if (toUpdate.length > 0) {
      const { error } = await supabase
        .from('plan_phases')
        .upsert(toUpdate.map(({ plan_tasks: _, ...ph }) => ph))
      if (error) { toast.error('Error al guardar fase'); fetchPlan() }
    }
  }

  // ── Move phase (drag) ────────────────────────────────────
  async function movePhase(phaseId, deltaDays, { cascade = true } = {}) {
    const idx = phases.findIndex(p => p.id === phaseId)
    if (idx === -1) return

    const phase = phases[idx]
    const newStart = addDays(phase.start_date, deltaDays)
    const newEnd   = addDays(phase.end_date,   deltaDays)
    const fields   = { start_date: newStart, end_date: newEnd }

    let newPhases = phases.map((p, i) =>
      i === idx ? { ...p, ...fields } : p
    )

    if (cascade) {
      // If moving forward, cascade subsequent phases
      // If moving backward, only cascade if they would overlap
      const nextPhase = newPhases[idx + 1]
      if (nextPhase) {
        const gap = daysBetween(newEnd, nextPhase.start_date)
        if (gap < 1) {
          // Overlap or touching: cascade
          newPhases = cascadeFromIndex(newPhases, idx, deltaDays)
        }
      }
    }

    const finalPhases = resolveSprintOverlaps(newPhases)
    setPhases(finalPhases)

    const toUpdate = diffPhases(phases, finalPhases)
    if (toUpdate.length > 0) {
      const { error } = await supabase
        .from('plan_phases')
        .upsert(toUpdate.map(({ plan_tasks: _, ...ph }) => ph))
      if (error) { toast.error('Error al mover fase'); fetchPlan() }
    }
  }

  // ── Resize phase (right edge drag) ───────────────────────
  async function resizePhase(phaseId, newEndDate) {
    const idx = phases.findIndex(p => p.id === phaseId)
    if (idx === -1) return

    const phase   = phases[idx]
    const oldEnd  = phase.end_date
    const delta   = daysBetween(oldEnd, newEndDate)

    // Recalculate hours from the new date range
    const hpd      = phase.hours_per_day ?? 8
    const days     = workingDaysBetween(phase.start_date, newEndDate)
    const newHours = Math.round(days * hpd * 10) / 10

    let newPhases = phases.map((p, i) =>
      i === idx ? { ...p, end_date: newEndDate, hours: newHours } : p
    )

    // Cascade if the new end overlaps with the next phase start
    const nextPhase = newPhases[idx + 1]
    if (nextPhase && delta > 0) {
      const gap = daysBetween(newEndDate, nextPhase.start_date)
      if (gap < 1) {
        newPhases = cascadeFromIndex(newPhases, idx, delta)
      }
    }

    const finalPhases = resolveSprintOverlaps(newPhases)
    setPhases(finalPhases)

    const toUpdate = diffPhases(phases, finalPhases)
    if (toUpdate.length > 0) {
      const { error } = await supabase
        .from('plan_phases')
        .upsert(toUpdate.map(({ plan_tasks: _, ...ph }) => ph))
      if (error) { toast.error('Error al redimensionar fase'); fetchPlan() }
    }
  }

  // ── Delete phase ─────────────────────────────────────────
  async function deletePhase(phaseId) {
    setPhases(prev => prev.filter(p => p.id !== phaseId))
    const { error } = await supabase
      .from('plan_phases')
      .delete()
      .eq('id', phaseId)
    if (error) { toast.error('Error al eliminar fase'); fetchPlan() }
  }

  // ── Reorder phases ───────────────────────────────────────
  async function reorderPhases(newPhases) {
    const reindexed = newPhases.map((p, i) => ({ ...p, order_index: i }))
    setPhases(reindexed)
    const { error } = await supabase
      .from('plan_phases')
      .upsert(reindexed.map(({ plan_tasks: _, ...ph }) => ph))
    if (error) { toast.error('Error al reordenar'); fetchPlan() }
  }

  // ── Phase tasks ──────────────────────────────────────────
  function updatePhaseTasks(phaseId, updater) {
    setPhases(prev => prev.map(p =>
      p.id === phaseId ? { ...p, plan_tasks: updater(p.plan_tasks) } : p
    ))
  }

  async function addTask(phaseId, title = '') {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase) return
    const newOrder = (phase.plan_tasks || []).length

    const payload = { phase_id: phaseId, title: title || 'Nueva tarea', hours: 0, done: false, order_index: newOrder }
    const tempId = `temp-${Date.now()}`

    updatePhaseTasks(phaseId, tasks => [...tasks, { ...payload, id: tempId }])

    const { data, error } = await supabase
      .from('plan_tasks')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error('Error al añadir tarea')
      updatePhaseTasks(phaseId, tasks => tasks.filter(t => t.id !== tempId))
      return null
    }

    updatePhaseTasks(phaseId, tasks => tasks.map(t => t.id === tempId ? data : t))
    return data
  }

  async function updateTask(phaseId, taskId, fields) {
    updatePhaseTasks(phaseId, tasks =>
      tasks.map(t => t.id === taskId ? { ...t, ...fields } : t)
    )
    const { error } = await supabase
      .from('plan_tasks')
      .update(fields)
      .eq('id', taskId)
    if (error) { toast.error('Error al guardar tarea'); fetchPlan() }
  }

  async function deleteTask(phaseId, taskId) {
    updatePhaseTasks(phaseId, tasks => tasks.filter(t => t.id !== taskId))
    const { error } = await supabase
      .from('plan_tasks')
      .delete()
      .eq('id', taskId)
    if (error) { toast.error('Error al eliminar tarea'); fetchPlan() }
  }

  // ── Snapshots (plan baselines) ───────────────────────────
  async function createSnapshot(name) {
    const trimmed = (name || '').trim()
    if (!trimmed) return

    const { data: snap, error } = await supabase
      .from('plan_snapshots')
      .insert({ plan_id: planId, name: trimmed })
      .select()
      .single()

    if (error) { toast.error('Error al guardar el plan base'); return }

    const snapPhases = phases.map(p => ({
      snapshot_id: snap.id,
      phase_id:    p.id,
      phase_name:  p.name,
      color:       p.color,
      start_date:  p.start_date,
      end_date:    p.end_date,
      hours:       p.hours ?? 0,
    }))

    const { error: err2 } = await supabase
      .from('plan_snapshot_phases')
      .insert(snapPhases)

    if (err2) { toast.error('Error al guardar fases del plan base'); return }

    const newSnap = { ...snap, plan_snapshot_phases: snapPhases }
    setSnapshots(prev => [...prev, newSnap])
    setActiveSnapshotId(newSnap.id)
    toast.success('Plan base guardado')
    return newSnap
  }

  async function deleteSnapshot(snapshotId) {
    setSnapshots(prev => prev.filter(s => s.id !== snapshotId))
    if (activeSnapshotId === snapshotId) {
      const remaining = snapshots.filter(s => s.id !== snapshotId)
      setActiveSnapshotId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
    }
    const { error } = await supabase
      .from('plan_snapshots')
      .delete()
      .eq('id', snapshotId)
    if (error) { toast.error('Error al eliminar plan base'); fetchPlan() }
  }

  // ── Delete plan ──────────────────────────────────────────
  async function deletePlan() {
    setSaving(true)
    const { error } = await supabase
      .from('project_plans')
      .delete()
      .eq('id', planId)
    setSaving(false)
    if (error) { toast.error('Error al eliminar plan'); return false }
    return true
  }

  return {
    plan, phases, loading, saving,
    updatePlan,
    addPhase, addMilestone, updatePhase, movePhase, resizePhase, deletePhase, reorderPhases,
    addTask, updateTask, deleteTask,
    deletePlan,
    snapshots, activeSnapshotId, setActiveSnapshotId,
    createSnapshot, deleteSnapshot,
    refetch: fetchPlan,
  }
}
