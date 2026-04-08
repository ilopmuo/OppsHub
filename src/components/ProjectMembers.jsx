import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { UserPlus, Copy, Check, X, Loader2, Crown } from 'lucide-react'

function initials(email) {
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

export default function ProjectMembers({ projectId, projectOwnerId }) {
  const { user } = useAuth()
  const isOwner = user?.id === projectOwnerId

  const [members, setMembers] = useState([])
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [inviteLink, setInviteLink] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchMembers() }, [projectId])

  async function fetchMembers() {
    const [{ data: pm }, { data: owner }] = await Promise.all([
      supabase.from('project_members').select('id, role, joined_at, user_id').eq('project_id', projectId),
      supabase.from('profiles').select('id, email, display_name, avatar_url').eq('id', projectOwnerId).single(),
    ])

    // fetch profiles for all members separately (user_id FK points to auth.users, not profiles)
    const userIds = (pm || []).map(m => m.user_id).filter(Boolean)
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, email, display_name, avatar_url').in('id', userIds)
      : { data: [] }

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    const membersWithProfiles = (pm || []).map(m => ({ ...m, profile: profileMap[m.user_id] || null }))

    setOwnerProfile(owner)
    setMembers(membersWithProfiles)
    setLoading(false)
  }

  useEffect(() => {
    const channel = supabase
      .channel(`project_members:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_members',
        filter: `project_id=eq.${projectId}`,
      }, () => fetchMembers())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [projectId])

  async function generateInvite() {
    setGenerating(true)
    const { data, error } = await supabase
      .from('project_invitations')
      .insert({ project_id: projectId, invited_by: user.id })
      .select('token')
      .single()

    if (error) {
      toast.error('Error al generar invitación')
    } else {
      setInviteLink(`${window.location.origin}/join?token=${data.token}`)
    }
    setGenerating(false)
  }

  async function copyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success('Link copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  async function removeMember(memberId) {
    if (!confirm('¿Eliminar este miembro del proyecto?')) return
    const { error } = await supabase.from('project_members').delete().eq('id', memberId)
    if (!error) setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const allMembers = [
    ownerProfile ? { profile: ownerProfile, role: 'owner', id: 'owner' } : null,
    ...members.filter(m => m.profile?.id !== projectOwnerId),
  ].filter(Boolean)

  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold" style={{ color: '#6e6e73' }}>Equipo</h2>
        {isOwner && (
          <button
            onClick={inviteLink ? copyLink : generateInvite}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ backgroundColor: '#1a1a1a', color: '#f5f5f7', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : inviteLink ? (
              copied ? <Check className="w-3.5 h-3.5" style={{ color: '#30d158' }} /> : <Copy className="w-3.5 h-3.5" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            {inviteLink ? (copied ? 'Copiado' : 'Copiar link') : 'Invitar miembro'}
          </button>
        )}
      </div>

      {inviteLink && (
        <div className="mb-4 px-3 py-2.5 rounded-xl flex items-center gap-2 text-xs overflow-hidden"
          style={{ backgroundColor: '#000000', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="flex-1 truncate" style={{ color: '#6e6e73' }}>{inviteLink}</span>
          <button onClick={copyLink} style={{ color: copied ? '#30d158' : '#6e6e73', flexShrink: 0 }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6e6e73' }} />
        </div>
      ) : (
        <div className="space-y-2">
          {allMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: m.profile?.avatar_url ? '#000' : avatarColor(m.profile?.email), color: '#000' }}>
                {m.profile?.avatar_url
                  ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : initials(m.profile?.email)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: '#f5f5f7' }}>
                  {m.profile?.display_name || m.profile?.email}
                </p>
              </div>
              {m.role === 'owner' ? (
                <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: '#ff9f0a' }} />
              ) : isOwner ? (
                <button onClick={() => removeMember(m.id)}
                  className="opacity-0 hover:opacity-100 transition-all p-1 rounded"
                  style={{ color: '#6e6e73' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}>
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-xs" style={{ color: '#3a3a3a' }}>miembro</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
