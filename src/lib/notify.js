import { supabase } from './supabase'

const TYPE_TO_SETTING = {
  task_assigned:  'notify_task_assigned',
  task_completed: 'notify_task_completed',
  deadline_soon:  'notify_deadline_soon',
  member_joined:  'notify_member_joined',
  status_changed: 'notify_status_changed',
}

export async function notify({ userId, type, projectId, taskId, message }) {
  const { data: settings } = await supabase
    .from('project_notification_settings')
    .select('enabled, notify_task_assigned, notify_task_completed, notify_deadline_soon, notify_member_joined, notify_status_changed')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  if (settings) {
    if (!settings.enabled) return
    const key = TYPE_TO_SETTING[type]
    if (key && settings[key] === false) return
  }

  await supabase.from('notifications').insert({ user_id: userId, type, project_id: projectId, task_id: taskId, message })
}
