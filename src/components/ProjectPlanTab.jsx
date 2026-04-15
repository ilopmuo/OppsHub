import { useState, useEffect } from 'react'
import { Loader2, Plus, PanelRightOpen, PanelRightClose, LayoutList } from 'lucide-react'
import GanttChart from './GanttChart'
import PlanSidebar from './PlanSidebar'
import PlanPhaseCalendar from './PlanPhaseCalendar'
import PlanInsights from './PlanInsights'
import NewPlanModal from './NewPlanModal'
import usePlan from '../hooks/usePlan'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function ProjectPlanTab({ projectId }) {
  const { user } = useAuth()
  const [planId, setPlanId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [loadingPlanId, setLoadingPlanId] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [calendarPhase, setCalendarPhase] = useState(null)

  // Load plan ID from project
  useEffect(() => {
    if (!user?.id) return

    async function loadPlanId() {
      setLoadingPlanId(true)
      const { data, error } = await supabase
        .from('project_plans')
        .select('id')
        .eq('project_id', projectId)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        setPlanId(data.id)
      }
      setLoadingPlanId(false)
    }
    loadPlanId()
  }, [projectId, user?.id])

  // Use the plan hook to manage all plan operations
  const {
    plan, phases, loading,
    updatePlan,
    addPhase, addMilestone, updatePhase, movePhase, resizePhase, deletePhase, reorderPhases,
    addTask, updateTask, deleteTask,
    deletePlan,
    snapshots, activeSnapshotId, setActiveSnapshotId,
    createSnapshot, deleteSnapshot,
  } = usePlan(planId)

  async function handleDeletePlan() {
    const ok = await deletePlan()
    if (ok) {
      toast.success('Plan eliminado')
      setPlanId(null)
    }
  }

  if (loadingPlanId || loading) {
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
            onCreated={(newPlanId) => {
              setShowModal(false)
              setPlanId(newPlanId)
            }}
          />
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0 sticky top-0 z-20"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: '#000',
        }}
      >
        <h2 className="text-sm font-semibold truncate" style={{ color: '#f5f5f7' }}>
          {plan.name}
        </h2>
        {plan.client_name && (
          <span
            className="text-xs px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}
          >
            {plan.client_name}
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="flex items-center gap-1.5 text-xs transition-colors shrink-0"
          style={{ color: sidebarOpen ? '#bf5af2' : '#6e6e73', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
          onMouseEnter={e => { if (!sidebarOpen) e.currentTarget.style.color = '#f5f5f7' }}
          onMouseLeave={e => { if (!sidebarOpen) e.currentTarget.style.color = '#6e6e73' }}
          title={sidebarOpen ? 'Cerrar panel' : 'Abrir panel de edición'}
        >
          {sidebarOpen
            ? <PanelRightClose className="w-4 h-4" />
            : <PanelRightOpen  className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Main content: Gantt + optional side panel */}
      <div className="flex" style={{ alignItems: 'flex-start' }}>

        {/* Gantt column */}
        <div className="flex-1 min-w-0">
          <div className="p-6">
            <GanttChart
              plan={plan}
              phases={phases}
              isEditable={true}
              snapshots={snapshots}
              activeSnapshotId={activeSnapshotId}
              onMove={movePhase}
              onResize={resizePhase}
              onUpdatePhase={updatePhase}
              onOpenCalendar={setCalendarPhase}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onReorderPhases={reorderPhases}
            />
          </div>

          {/* Below-fold: charts + stats */}
          <PlanInsights plan={plan} phases={phases} />
        </div>

        {/* Collapsible side panel */}
        <div
          className="shrink-0"
          style={{
            width: sidebarOpen ? 360 : 0,
            overflow: 'hidden',
            transition: 'width 0.25s ease',
            position: 'sticky',
            top: 44,
            height: 'calc(100vh - 100px)',
            borderLeft: sidebarOpen ? '1px solid rgba(255,255,255,0.06)' : 'none',
            backgroundColor: '#000',
          }}
        >
          <div style={{ width: 360, height: '100%', overflowY: 'auto' }}>
            <PlanSidebar
              plan={plan}
              phases={phases}
              onUpdatePlan={updatePlan}
              onUpdatePhase={updatePhase}
              onAddPhase={addPhase}
              onDeletePhase={deletePhase}
              onOpenCalendar={setCalendarPhase}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onDeletePlan={handleDeletePlan}
              onAddMilestone={addMilestone}
              onReorderPhases={reorderPhases}
              snapshots={snapshots}
              activeSnapshotId={activeSnapshotId}
              onSetActiveSnapshot={setActiveSnapshotId}
              onCreateSnapshot={createSnapshot}
              onDeleteSnapshot={deleteSnapshot}
            />
          </div>
        </div>
      </div>

      {/* Phase calendar modal */}
      {calendarPhase && (
        <PlanPhaseCalendar
          phase={calendarPhase}
          onClose={() => setCalendarPhase(null)}
        />
      )}

      {showModal && (
        <NewPlanModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onCreated={(newPlanId) => {
            setShowModal(false)
            setPlanId(newPlanId)
          }}
        />
      )}
    </div>
  )
}
