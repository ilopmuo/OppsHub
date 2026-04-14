import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import NavBar from '../components/NavBar'
import GanttChart from '../components/GanttChart'
import PlanSidebar from '../components/PlanSidebar'
import PlanPhaseCalendar from '../components/PlanPhaseCalendar'
import usePlan from '../hooks/usePlan'
import toast from 'react-hot-toast'

export default function PlanEditor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const {
    plan, phases, loading,
    updatePlan,
    addPhase, addMilestone, updatePhase, movePhase, resizePhase, deletePhase, reorderPhases,
    addTask, updateTask, deleteTask,
    deletePlan,
    snapshots, activeSnapshotId, setActiveSnapshotId,
    createSnapshot, deleteSnapshot,
  } = usePlan(id)

  const [calendarPhase, setCalendarPhase] = useState(null)

  async function handleDeletePlan() {
    const ok = await deletePlan()
    if (ok) {
      toast.success('Plan eliminado')
      navigate('/plans')
    }
  }

  function handlePrint() {
    if (plan) document.title = `${plan.name} — Plan`
    window.print()
    setTimeout(() => { document.title = 'OppsHub' }, 1000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
        <NavBar />
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 56px)' }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#bf5af2' }} />
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
        <NavBar />
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 56px)' }}>
          <p style={{ color: '#6e6e73' }}>Plan no encontrado.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      <NavBar breadcrumb={plan.name} />

      <main
        className="no-print"
        style={{
          height: 'calc(100vh - 56px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Sub-header */}
        <div
          className="flex items-center gap-3 px-6 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={() => navigate('/plans')}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
            onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
          >
            <ArrowLeft className="w-4 h-4" />
            Planes
          </button>
          <span style={{ color: '#3a3a3a' }}>/</span>
          <h1 className="text-sm font-semibold truncate" style={{ color: '#f5f5f7' }}>{plan.name}</h1>
          {plan.client_name && (
            <span
              className="text-xs px-2 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}
            >
              {plan.client_name}
            </span>
          )}
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Gantt chart */}
          <div
            className="flex-1 p-6 overflow-y-auto gantt-print-area"
            style={{ minWidth: 0 }}
          >
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

          {/* Right: Sidebar */}
          <div
            className="shrink-0 overflow-y-auto p-5 no-print"
            style={{
              width: 320,
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              backgroundColor: '#000',
            }}
          >
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
              onPrint={handlePrint}
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
      </main>

      {/* Phase calendar modal */}
      {calendarPhase && (
        <PlanPhaseCalendar
          phase={calendarPhase}
          onClose={() => setCalendarPhase(null)}
        />
      )}

      {/* Print-only area */}
      <div className="print-only" style={{ display: 'none' }}>
        <div style={{ padding: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{plan.name}</h1>
          {plan.client_name && <p style={{ color: '#555', marginBottom: 16 }}>{plan.client_name}</p>}
          <GanttChart
            plan={plan}
            phases={phases}
            isEditable={false}
            compact={false}
          />
        </div>
      </div>
    </div>
  )
}
