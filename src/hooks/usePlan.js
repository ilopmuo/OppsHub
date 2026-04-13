import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ── Date helpers ─────────────────────────────────────────────
export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00')
  const b = new Date(bStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
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

// ── Main hook ────────────────────────────────────────────────
export default function usePlan(planId) {
  const [plan,    setPlan]    = useState(null)
  const [phases,  setPhases]  = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // ── Fetch ────────────────────────────────────────────────
  const fetchPlan = useCallback(async () => {
    if (!planId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('project_plans')
      .select(`
        *,
        plan_phases (
          *,
          plan_tasks ( * )
        )
      `)
      .eq('id', planId)
      .single()

    if (error) {
      toast.error('Error al cargar el plan')
      setLoading(false)
      return
    }

    const sortedPhases = (data.plan_phases || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(ph => ({
        ...ph,
        plan_tasks: (ph.plan_tasks || []).sort((a, b) => a.order_index - b.order_index),
      }))

    setPlan(data)
    setPhases(sortedPhases)
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
      plan_id:     planId,
      name:        `Fase ${phases.length + 1}`,
      start_date:  newStart,
      end_date:    newEnd,
      hours:       0,
      color,
      order_index: newOrder,
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

  // ── Update phase ─────────────────────────────────────────
  async function updatePhase(phaseId, fields, { cascade = false } = {}) {
    const idx = phases.findIndex(p => p.id === phaseId)
    if (idx === -1) return

    let newPhases = phases.map((p, i) =>
      i === idx ? { ...p, ...fields } : p
    )

    // If end_date changed and cascade enabled, shift subsequent phases
    if (cascade && fields.end_date) {
      const oldEnd = phases[idx].end_date
      const delta  = daysBetween(oldEnd, fields.end_date)
      newPhases = cascadeFromIndex(newPhases, idx, delta)
    }

    setPhases(newPhases)

    // Persist: only update affected phases
    const toUpdate = cascade
      ? newPhases.slice(idx)
      : [newPhases[idx]]

    const { error } = await supabase
      .from('plan_phases')
      .upsert(toUpdate.map(({ plan_tasks: _, ...ph }) => ph))

    if (error) { toast.error('Error al guardar fase'); fetchPlan() }
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

    setPhases(newPhases)

    const toUpdate = newPhases.slice(idx)
    const { error } = await supabase
      .from('plan_phases')
      .upsert(toUpdate.map(({ plan_tasks: _, ...ph }) => ph))

    if (error) { toast.error('Error al mover fase'); fetchPlan() }
  }

  // ── Resize phase (right edge drag) ───────────────────────
  async function resizePhase(phaseId, newEndDate) {
    const idx = phases.findIndex(p => p.id === phaseId)
    if (idx === -1) return

    const phase   = phases[idx]
    const oldEnd  = phase.end_date
    const delta   = daysBetween(oldEnd, newEndDate)

    let newPhases = phases.map((p, i) =>
      i === idx ? { ...p, end_date: newEndDate } : p
    )

    // Cascade if the new end overlaps with the next phase start
    const nextPhase = newPhases[idx + 1]
    if (nextPhase && delta > 0) {
      const gap = daysBetween(newEndDate, nextPhase.start_date)
      if (gap < 1) {
        newPhases = cascadeFromIndex(newPhases, idx, delta)
      }
    }

    setPhases(newPhases)

    const toUpdate = newPhases.slice(idx)
    const { error } = await supabase
      .from('plan_phases')
      .upsert(toUpdate.map(({ plan_tasks: _, ...ph }) => ph))

    if (error) { toast.error('Error al redimensionar fase'); fetchPlan() }
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
    addPhase, updatePhase, movePhase, resizePhase, deletePhase, reorderPhases,
    addTask, updateTask, deleteTask,
    deletePlan,
    refetch: fetchPlan,
  }
}
