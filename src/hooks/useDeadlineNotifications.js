import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useDeadlineNotifications() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    checkDeadlines()
  }, [user?.id])

  async function checkDeadlines() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    // All non-done tasks with due_date today or tomorrow (RLS filters by user access)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, project_id')
      .neq('status', 'done')
      .gte('due_date', todayStr)
      .lte('due_date', tomorrowStr)

    if (!tasks || tasks.length === 0) return

    // Which ones already have a deadline_soon notification created today
    const taskIds = tasks.map(t => t.id)
    const { data: existing } = await supabase
      .from('notifications')
      .select('task_id')
      .eq('user_id', user.id)
      .eq('type', 'deadline_soon')
      .in('task_id', taskIds)
      .gte('created_at', todayStr)

    const alreadyNotified = new Set((existing || []).map(n => n.task_id))

    const toInsert = tasks
      .filter(t => !alreadyNotified.has(t.id))
      .map(t => {
        const due = new Date(t.due_date + 'T00:00:00')
        const diffDays = Math.ceil((due - today) / 86400000)
        const label = diffDays === 0 ? 'vence hoy' : 'vence mañana'
        return {
          user_id: user.id,
          type: 'deadline_soon',
          project_id: t.project_id,
          task_id: t.id,
          message: `"${t.title}" ${label}`,
        }
      })

    if (toInsert.length > 0) {
      await supabase.from('notifications').insert(toInsert)
    }
  }
}
