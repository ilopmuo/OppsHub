import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Bell } from 'lucide-react'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

const TYPE_ICON = {
  task_assigned: '👤',
  comment_added: '💬',
  member_joined: '🤝',
}

export default function NotificationsPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!user) return
    fetchNotifications()

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
    setUnread((data || []).filter(n => !n.read).length)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  async function handleClick(notif) {
    if (!notif.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    }
    setOpen(false)
    if (notif.project_id) navigate(`/project/${notif.project_id}`)
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead() }}
        className="relative p-1.5 rounded-lg transition-all"
        style={{ color: unread > 0 ? '#f5f5f7' : '#6e6e73' }}
        onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
        onMouseLeave={e => e.currentTarget.style.color = unread > 0 ? '#f5f5f7' : '#6e6e73'}
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: '#ff453a', color: '#fff', fontSize: 9 }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-80 rounded-2xl overflow-hidden z-50"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>Notificaciones</span>
            {notifications.some(n => !n.read) && (
              <button onClick={markAllRead} className="text-xs transition-colors" style={{ color: '#6e6e73' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
                onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
                Marcar todo leído
              </button>
            )}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {notifications.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: '#6e6e73' }}>Sin notificaciones</p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all"
                  style={{ backgroundColor: n.read ? 'transparent' : 'rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = n.read ? 'transparent' : 'rgba(255,255,255,0.03)'}
                >
                  <span className="text-base mt-0.5 shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: n.read ? '#6e6e73' : '#f5f5f7' }}>{n.message}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#3a3a3a' }}>{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: '#30d158' }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
