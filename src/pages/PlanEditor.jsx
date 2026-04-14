import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import NavBar from '../components/NavBar'
import GanttChart from '../components/GanttChart'
import PlanSidebar from '../components/PlanSidebar'
import PlanPhaseCalendar from '../components/PlanPhaseCalendar'
import usePlan, { daysBetween } from '../hooks/usePlan'
import PlanInsights from '../components/PlanInsights'
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

  // ── Print-specific values ─────────────────────────────────
  const PRINT_LABEL_W  = 150
  const PRINT_PAGE_PX  = 1009 // A4 landscape CSS px: (297-30)mm * 96/25.4
  const printLastEnd   = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, plan.start_date)
  const printTotalDays = Math.max(daysBetween(plan.start_date, printLastEnd) + 1, 14)
  const printDayPx     = Math.max(2, Math.floor((PRINT_PAGE_PX - PRINT_LABEL_W) / (printTotalDays + 7)))
  const printTotalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      <NavBar breadcrumb={plan.name} />

      <main
        className="no-print"
        style={{
          height: 'calc(100vh - 56px)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Sub-header — sticky so stays visible when scrolling to sidebar */}
        <div
          className="flex items-center gap-3 px-6 py-3 shrink-0 sticky top-0 z-20"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backgroundColor: '#000',
          }}
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

        {/* Gantt: expands to fit all phases, no internal vertical scroll */}
        <div className="shrink-0 p-6 gantt-print-area">
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
        <div className="shrink-0 no-print">
          <PlanInsights plan={plan} phases={phases} />
        </div>

        {/* Below-fold: wide plan editing panel */}
        <div
          className="shrink-0 no-print"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <PlanSidebar
            wide
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
      </main>

      {/* Phase calendar modal */}
      {calendarPhase && (
        <PlanPhaseCalendar
          phase={calendarPhase}
          onClose={() => setCalendarPhase(null)}
        />
      )}

      {/* Print-only area — landscape A4 */}
      <div className="print-only" style={{ display: 'none' }}>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '0 8px' }}>
          {/* Header */}
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '2px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {/* Plan info */}
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: '#111' }}>{plan.name}</h1>
              {plan.client_name && (
                <p style={{ color: '#666', margin: '3px 0 0', fontSize: 12 }}>{plan.client_name}</p>
              )}
              <div style={{ display: 'flex', gap: 20, marginTop: 4, fontSize: 11, color: '#999' }}>
                <span>{plan.start_date} — {printLastEnd}</span>
                {printTotalHours > 0 && <span>{printTotalHours}h planificadas</span>}
                <span>{phases.length} fase{phases.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {/* OppsHub branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 44 44" fill="none">
                <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
                <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
                <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
                <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
                <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#333', letterSpacing: '-0.01em' }}>OppsHub</span>
            </div>
          </div>
          {/* Gantt scaled to fit the page */}
          <GanttChart
            plan={plan}
            phases={phases}
            isEditable={false}
            printMode={true}
            forceDayPx={printDayPx}
            forceLabelW={PRINT_LABEL_W}
          />
        </div>
      </div>
    </div>
  )
}
