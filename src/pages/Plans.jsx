import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LanguageContext'
import toast from 'react-hot-toast'
import { Plus, LayoutList, Calendar, Clock, Building2, ExternalLink } from 'lucide-react'
import NavBar from '../components/NavBar'
import NewPlanModal from '../components/NewPlanModal'

function formatDate(dateStr, locale) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function PlanCard({ plan, onClick, locale, p }) {
  const phaseCount = plan.phase_count || 0
  const totalHours = plan.total_hours || 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-5 transition-all group"
      style={{
        backgroundColor: '#111111',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#161616'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <LayoutList className="w-4 h-4" style={{ color: '#bf5af2' }} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: '#f5f5f7' }}>{plan.name}</p>
            {plan.client_name && (
              <div className="flex items-center gap-1 mt-0.5">
                <Building2 className="w-2.5 h-2.5" style={{ color: '#6e6e73' }} />
                <p className="text-xs truncate" style={{ color: '#6e6e73' }}>{plan.client_name}</p>
              </div>
            )}
          </div>
        </div>
        <ExternalLink
          className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#6e6e73' }}
        />
      </div>

      {/* Linked project badge */}
      {plan.projects?.name && (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg mb-3 text-xs"
          style={{ backgroundColor: 'rgba(100,210,255,0.08)', color: '#64d2ff' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#64d2ff' }} />
          {plan.projects.name}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3" style={{ color: '#6e6e73' }} />
          <span className="text-xs" style={{ color: '#6e6e73' }}>{formatDate(plan.start_date, locale)}</span>
        </div>
        {phaseCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: '#6e6e73' }}>
              {phaseCount} {phaseCount !== 1 ? p.phases : p.phase}
            </span>
          </div>
        )}
        {totalHours > 0 && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" style={{ color: '#6e6e73' }} />
            <span className="text-xs" style={{ color: '#6e6e73' }}>{totalHours}h</span>
          </div>
        )}
      </div>
    </button>
  )
}

function SkeletonPlanCard() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="skeleton w-8 h-8 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-3.5 rounded" style={{ width: '55%' }} />
          <div className="skeleton h-3 rounded" style={{ width: '35%' }} />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="skeleton h-3 rounded" style={{ width: 80 }} />
        <div className="skeleton h-3 rounded" style={{ width: 50 }} />
      </div>
    </div>
  )
}

export default function Plans() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, t } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const p = t('plans')
  const [plans,     setPlans]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchPlans() }, [])

  async function fetchPlans() {
    setLoading(true)
    const { data, error } = await supabase
      .from('project_plans')
      .select(`
        *,
        projects ( id, name ),
        plan_phases ( id, hours )
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(p.errorLoading)
    } else {
      const enriched = (data || []).map(p => ({
        ...p,
        phase_count: (p.plan_phases || []).length,
        total_hours: (p.plan_phases || []).reduce((s, ph) => s + Number(ph.hours || 0), 0),
      }))
      setPlans(enriched)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#f5f5f7' }}>{p.title}</h1>
            <p className="text-sm" style={{ color: '#6e6e73' }}>{p.subtitle}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
          >
            <Plus className="w-4 h-4" />
            {p.newPlan}
          </button>
        </div>

        {/* Plans grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <SkeletonPlanCard key={i} />)}
          </div>
        ) : plans.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-3xl py-20"
            style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <LayoutList className="w-8 h-8" style={{ color: '#3a3a3a' }} />
            </div>
            <p className="font-semibold mb-2" style={{ color: '#f5f5f7' }}>{p.empty}</p>
            <p className="text-sm mb-6 text-center max-w-xs" style={{ color: '#6e6e73' }}>{p.emptyDesc}</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
            >
              <Plus className="w-4 h-4" />
              {p.createFirst}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClick={() => navigate(`/plans/${plan.id}`)}
                locale={locale}
                p={p}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewPlanModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchPlans() }}
        />
      )}
    </div>
  )
}
