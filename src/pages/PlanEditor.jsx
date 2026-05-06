import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { useLang } from '../contexts/LanguageContext'
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

  const { t } = useLang()
  const p = t('plans')
  const [calendarPhase, setCalendarPhase] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleDeletePlan() {
    const ok = await deletePlan()
    if (ok) {
      toast.success(p.deleted)
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
          <p style={{ color: '#6e6e73' }}>{p.notFound}</p>
        </div>
      </div>
    )
  }

  // ── Print-specific values ─────────────────────────────────
  // A4 landscape usable area at 96 CSS dpi with 12mm top/bottom + 15mm left/right margins:
  //   width : (297 - 30) mm  = 267 mm = ~1009 px
  //   height: (210 - 24) mm  = 186 mm = ~703  px
  const PRINT_LABEL_W  = 220
  const PRINT_PAGE_W   = 1009
  const PRINT_PAGE_H   = 620  // conservative: browser chrome + page footer eat ~80px of the theoretical 703px
  const PRINT_HEADER_H = 110  // plan-name header + branding + some breathing room

  const printLastEnd    = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, plan.start_date)
  const printTotalDays  = Math.max(daysBetween(plan.start_date, printLastEnd) + 1, 14)
  const printDayPx      = Math.max(2, Math.floor((PRINT_PAGE_W - PRINT_LABEL_W) / (printTotalDays + 7)))
  const printTotalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)

  // How tall the Gantt rows will be (headers + one 44px row per phase)
  const printGanttH = 32 + (printDayPx >= 24 ? 20 : 0) + phases.length * 44
  // Scale factor so total content fits in PRINT_PAGE_H (never scale up, only down)
  const printZoom   = Math.min(1, PRINT_PAGE_H / (PRINT_HEADER_H + printGanttH))

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
            {p.backToPlans}
          </button>
          <span style={{ color: '#3a3a3a' }}>/</span>
          {/* Project logo — white bg wrapper because most project icons have white background */}
          {plan.project?.icon_url && (
            <div
              className="shrink-0 rounded-lg overflow-hidden"
              style={{ width: 22, height: 22, backgroundColor: '#fff', padding: 2 }}
            >
              <img src={plan.project.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            </div>
          )}
          <h1 className="text-sm font-semibold truncate" style={{ color: '#f5f5f7' }}>{plan.name}</h1>
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
            title={sidebarOpen ? p.closePanel : p.openPanel}
          >
            {sidebarOpen
              ? <PanelRightClose className="w-4 h-4" />
              : <PanelRightOpen  className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Main content: Gantt + optional sticky side panel */}
        <div className="flex flex-1 min-h-0" style={{ alignItems: 'flex-start' }}>

          {/* Gantt column — expands to fill available width */}
          <div className="flex-1 min-w-0">
            <div className="p-6 gantt-print-area">
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
            className="no-print shrink-0"
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
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '0 8px', zoom: printZoom, transformOrigin: 'top left' }}>
          {/* Header */}
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '2px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {/* Plan info */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {plan.project?.icon_url && (
                <img
                  src={plan.project.icon_url}
                  alt=""
                  style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, flexShrink: 0, marginTop: 2 }}
                />
              )}
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
