import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Loader2, Plus, ExternalLink, LayoutList } from 'lucide-react'
import GanttChart from './GanttChart'
import NewPlanModal from './NewPlanModal'

export default function ProjectPlanTab({ projectId }) {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const [plan,        setPlan]        = useState(null)
  const [phases,      setPhases]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)

  useEffect(() => { fetchPlan() }, [projectId])

  async function fetchPlan() {
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
      .eq('project_id', projectId)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      const sortedPhases = (data.plan_phases || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(ph => ({
          ...ph,
          plan_tasks: (ph.plan_tasks || []).sort((a, b) => a.order_index - b.order_index),
        }))
      setPlan(data)
      setPhases(sortedPhases)
    } else {
      setPlan(null)
      setPhases([])
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#bf5af2' }} />
      </div>
    )
  }

  if (!plan) {
    return (
      <>
        <div
          className="flex flex-col items-center justify-center rounded-3xl py-16"
          style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <LayoutList className="w-7 h-7" style={{ color: '#3a3a3a' }} />
          </div>
          <p className="font-semibold mb-1.5" style={{ color: '#f5f5f7' }}>Sin plan de proyecto</p>
          <p className="text-sm mb-6 text-center max-w-xs" style={{ color: '#6e6e73' }}>
            Crea un plan Gantt para este proyecto y compártelo con el cliente.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: '#f5f5f7', color: '#000000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
          >
            <Plus className="w-4 h-4" />
            Crear plan
          </button>
        </div>

        {showModal && (
          <NewPlanModal
            projectId={projectId}
            onClose={() => setShowModal(false)}
            onCreated={() => { setShowModal(false); fetchPlan() }}
          />
        )}
      </>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: '#f5f5f7' }}>{plan.name}</h2>
          {plan.client_name && (
            <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>{plan.client_name}</p>
          )}
        </div>
        <button
          onClick={() => navigate(`/plans/${plan.id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#f5f5f7' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Editar plan completo
        </button>
      </div>

      {/* Gantt (read-only, compact) */}
      <GanttChart
        plan={plan}
        phases={phases}
        isEditable={false}
        compact={true}
      />
    </div>
  )
}
