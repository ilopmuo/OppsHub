import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/NavBar'
import toast from 'react-hot-toast'
import { Loader2, Camera, Save } from 'lucide-react'

const inputStyle = {
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f5f5f7',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
}
const fi = e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'
const fo = e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'

const COLORS = ['#ff453a', '#ff9f0a', '#30d158', '#64d2ff', '#bf5af2', '#f5f5f7']
function avatarColor(email) {
  if (!email) return COLORS[5]
  let hash = 0
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) % COLORS.length
  return COLORS[Math.abs(hash)]
}
function initials(email, name) {
  if (name) return name.slice(0, 2).toUpperCase()
  if (!email) return '?'
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

export default function ProfileSettings() {
  const { user } = useAuth()
  const fileRef = useRef(null)

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [original, setOriginal] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchProfile() }, [user])

  async function fetchProfile() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setDisplayName(data.display_name || '')
      setAvatarUrl(data.avatar_url || null)
      setOriginal({ display_name: data.display_name || '', avatar_url: data.avatar_url || null })
    }
    setLoading(false)
  }

  const isDirty = displayName !== original.display_name || avatarUrl !== original.avatar_url

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('La imagen no puede superar 2MB'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      toast.error('Error al subir la imagen')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(publicUrl + '?t=' + Date.now()) // cache bust
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim() || null,
      avatar_url: avatarUrl,
    }).eq('id', user.id)

    if (error) {
      toast.error('Error al guardar')
    } else {
      setOriginal({ display_name: displayName.trim() || '', avatar_url: avatarUrl })
      toast.success('Perfil actualizado')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <NavBar />
      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>Cuenta</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
            Mi perfil
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6e6e73' }} />
          </div>
        ) : (
          <div className="rounded-2xl p-8 space-y-8" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div
                  className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: avatarUrl ? '#000' : avatarColor(user?.email), color: '#000' }}
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : initials(user?.email, displayName)
                  }
                </div>

                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                  style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                >
                  {uploading
                    ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#fff' }} />
                    : <Camera className="w-5 h-5" style={{ color: '#fff' }} />
                  }
                </button>

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="text-center">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-sm transition-colors"
                  style={{ color: '#6e6e73' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
                >
                  {uploading ? 'Subiendo...' : 'Cambiar foto'}
                </button>
                <p className="text-xs mt-1" style={{ color: '#3a3a3a' }}>JPG, PNG o GIF · máx. 2MB</p>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Email</label>
                <input
                  value={user?.email || ''}
                  disabled
                  style={{ ...inputStyle, color: '#3a3a3a', cursor: 'not-allowed' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>
                  Nombre de usuario <span style={{ color: '#3a3a3a' }}>(opcional)</span>
                </label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="¿Cómo quieres que te llamen?"
                  style={inputStyle}
                  onFocus={fi}
                  onBlur={fo}
                />
                <p className="text-xs mt-1.5" style={{ color: '#3a3a3a' }}>
                  Aparecerá en el equipo del proyecto y en las tareas asignadas
                </p>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: isDirty && !saving ? '#f5f5f7' : 'rgba(245,245,247,0.1)',
                  color: isDirty && !saving ? '#000000' : '#6e6e73',
                  cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
