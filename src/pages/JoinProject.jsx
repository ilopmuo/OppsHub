import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Loader2, FolderOpen, CheckCircle } from 'lucide-react'

export default function JoinProject() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const token = params.get('token')

  const [invitation, setInvitation] = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    if (!token) { navigate('/'); return }
    if (!authLoading) fetchInvitation()
  }, [token, authLoading])

  async function fetchInvitation() {
    const { data, error } = await supabase
      .from('project_invitations')
      .select('*, projects(id, name, type)')
      .eq('token', token)
      .single()

    if (error || !data) {
      toast.error('Invitación no válida o expirada')
      navigate('/')
      return
    }

    setInvitation(data)
    setProject(data.projects)

    // Check if already a member
    if (user) {
      const { data: existing } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', data.project_id)
        .eq('user_id', user.id)
        .single()

      if (existing || data.projects.user_id === user.id) {
        setAlreadyMember(true)
      }
    }

    setLoading(false)
  }

  function handleLoginRedirect() {
    localStorage.setItem('pending_invite', token)
    navigate('/auth')
  }

  async function handleJoin() {
    if (!user) { handleLoginRedirect(); return }
    setJoining(true)

    const { error } = await supabase.from('project_members').insert({
      project_id: invitation.project_id,
      user_id: user.id,
      role: 'member',
    })

    if (error && error.code !== '23505') { // ignore duplicate
      toast.error('Error al unirse al proyecto')
      setJoining(false)
      return
    }

    // Mark invitation as accepted
    await supabase.from('project_invitations').update({ accepted_at: new Date().toISOString() }).eq('id', invitation.id)

    toast.success(`Te has unido a "${project.name}"`)
    navigate(`/project/${invitation.project_id}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#000000' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6e6e73' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#000000' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <svg viewBox="0 0 44 44" fill="none" width="44" height="44">
            <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
            <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
            <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
            <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
            <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
          </svg>
        </div>

        <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
            <FolderOpen className="w-5 h-5" style={{ color: '#f5f5f7' }} />
          </div>

          <h1 className="text-xl font-bold mb-1 tracking-tight" style={{ color: '#f5f5f7' }}>
            {alreadyMember ? 'Ya eres miembro' : 'Invitación al proyecto'}
          </h1>
          <p className="text-sm mb-1" style={{ color: '#6e6e73' }}>
            {alreadyMember ? 'Ya tienes acceso a' : 'Te han invitado a'}
          </p>
          <p className="text-base font-semibold mb-6" style={{ color: '#f5f5f7' }}>
            {project?.name}
          </p>

          {alreadyMember ? (
            <button
              onClick={() => navigate(`/project/${invitation.project_id}`)}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
            >
              Ir al proyecto
            </button>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: '#6e6e73' }}>
                Inicia sesión o crea una cuenta para unirte
              </p>
              <button
                onClick={handleLoginRedirect}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
              >
                Iniciar sesión / Registrarse
              </button>
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
              onMouseEnter={e => { if (!joining) e.currentTarget.style.backgroundColor = '#ffffff' }}
              onMouseLeave={e => { if (!joining) e.currentTarget.style.backgroundColor = '#f5f5f7' }}
            >
              {joining
                ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#666' }} />
                : <CheckCircle className="w-4 h-4" />}
              Aceptar invitación
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
