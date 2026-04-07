import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

const ACTION_LABELS = {
  task_created:    (m) => `Creó la tarea "${m.task_title}"`,
  task_moved:      (m) => `Movió "${m.task_title}" → ${STATUS_LABEL[m.to] || m.to}`,
  task_completed:  (m) => `Completó "${m.task_title}"`,
  task_deleted:    (m) => `Eliminó la tarea "${m.task_title}"`,
  task_assigned:   (m) => `Asignó "${m.task_title}" a ${m.assignee}`,
  milestone_done:  (m) => `Completó el hito "${m.title}"`,
  member_joined:   (m) => `Se unió al proyecto`,
  member_removed:  (m) => `Eliminó a ${m.email} del equipo`,
  comment_added:   (m) => `Comentó en "${m.task_title}"`,
}

const STATUS_LABEL = {
  backlog: 'Backlog', todo: 'Por hacer', in_progress: 'En progreso', done: 'Hecho',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}

function initials(email, name) {
  if (name) return name.slice(0, 2).toUpperCase()
  if (!email) return '?'
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

const COLORS = ['#ff453a', '#ff9f0a', '#30d158', '#64d2ff', '#bf5af2', '#f5f5f7']
function avatarColor(email) {
  if (!email) return COLORS[5]
  let hash = 0
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) % COLORS.length
  return COLORS[Math.abs(hash)]
}

export default function ActivityLog({ projectId }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [newIds, setNewIds] = useState(new Set())

  useEffect(() => {
    fetchActivity()

    // Real-time subscription
    const channel = supabase
      .channel(`activity-${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'project_activity',
        filter: `project_id=eq.${projectId}`,
      }, payload => {
        const newId = payload.new?.id
        fetchActivity()
        if (newId) {
          setNewIds(prev => new Set([...prev, newId]))
          setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(newId); return s }), 2100)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [projectId])

  async function fetchActivity() {
    const { data } = await supabase
      .from('project_activity')
      .select('*, profile:user_id(email, display_name, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50)
    setActivities(data || [])
    setLoading(false)
  }

  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <h2 className="text-sm font-semibold mb-5" style={{ color: '#6e6e73' }}>Actividad reciente</h2>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6e6e73' }} />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.08)' }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <p className="text-xs" style={{ color: '#3a3a3a' }}>Sin actividad todavía</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 320 }}>
          {activities.map(a => {
            const label = ACTION_LABELS[a.action]?.(a.metadata || {}) || a.action
            const profile = a.profile
            return (
              <div key={a.id} className={`flex items-start gap-3 ${newIds.has(a.id) ? 'activity-new' : ''}`}>
                <div
                  className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden"
                  style={{ backgroundColor: profile?.avatar_url ? '#000' : avatarColor(profile?.email), color: '#000' }}
                >
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : initials(profile?.email, profile?.display_name)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: '#f5f5f7' }}>
                    <span className="font-medium">{profile?.display_name || profile?.email?.split('@')[0] || 'Alguien'}</span>
                    {' '}{label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#3a3a3a' }}>{timeAgo(a.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
