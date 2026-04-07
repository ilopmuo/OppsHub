import { useState, useEffect, useRef } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const TOGGLES = [
  { key: 'notify_task_assigned', label: 'Tarea asignada' },
  { key: 'notify_task_completed', label: 'Tarea completada' },
  { key: 'notify_deadline_soon', label: 'Deadline próximo (≤7 días)' },
  { key: 'notify_member_joined', label: 'Nuevo miembro' },
  { key: 'notify_status_changed', label: 'Cambio de estado del proyecto' },
]

const DEFAULT_SETTINGS = {
  enabled: true,
  notify_task_assigned: true,
  notify_task_completed: true,
  notify_deadline_soon: true,
  notify_member_joined: true,
  notify_status_changed: false,
}

export default function ProjectNotificationSettings({ projectId }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (user && projectId) fetchSettings()
  }, [user, projectId])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchSettings() {
    const { data } = await supabase
      .from('project_notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .single()

    if (data) {
      setSettings(data)
    } else {
      // Create default settings on first open
      const { data: created } = await supabase
        .from('project_notification_settings')
        .insert({ user_id: user.id, project_id: projectId, ...DEFAULT_SETTINGS })
        .select()
        .single()
      setSettings(created || { ...DEFAULT_SETTINGS })
    }
  }

  async function updateSetting(key, value) {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    setSaving(true)
    const { error } = await supabase
      .from('project_notification_settings')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('project_id', projectId)
    if (error) {
      toast.error('Error al guardar')
      setSettings(settings) // revert
    }
    setSaving(false)
  }

  const isActive = settings?.enabled

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!settings) fetchSettings() }}
        title={isActive ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
        className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
        style={{
          backgroundColor: '#1a1a1a',
          color: isActive ? '#f5f5f7' : '#6e6e73',
          border: `1px solid ${isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#f5f5f7' }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'
          e.currentTarget.style.color = isActive ? '#f5f5f7' : '#6e6e73'
        }}
      >
        {isActive ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
      </button>

      {open && settings && (
        <div
          className="absolute right-0 top-10 w-72 rounded-2xl z-50"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>Notificaciones</span>
            {saving && <span className="text-xs" style={{ color: '#6e6e73' }}>Guardando…</span>}
          </div>

          <div className="px-4 py-3 space-y-4">
            {/* Master toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: '#f5f5f7' }}>Activar notificaciones</p>
                <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>Para este proyecto</p>
              </div>
              <Toggle value={settings.enabled} onChange={v => updateSetting('enabled', v)} />
            </div>

            {/* Individual toggles */}
            {settings.enabled && (
              <div className="space-y-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {TOGGLES.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#c0c0c0' }}>{label}</span>
                    <Toggle value={settings[key]} onChange={v => updateSetting(key, v)} small />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ value, onChange, small }) {
  const size = small ? { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' } : { track: 'w-10 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-5' }
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex items-center rounded-full transition-colors ${size.track}`}
      style={{ backgroundColor: value ? '#30d158' : 'rgba(255,255,255,0.12)' }}
    >
      <span
        className={`inline-block rounded-full bg-white shadow transition-transform ${size.thumb} ${value ? size.translate : 'translate-x-0.5'}`}
      />
    </button>
  )
}
