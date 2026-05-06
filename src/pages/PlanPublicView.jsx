import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, Calendar, Clock, Building2 } from 'lucide-react'
import GanttChart from '../components/GanttChart'
import PlanInsights from '../components/PlanInsights'
import PlanScope from '../components/PlanScope'
import { useLang } from '../contexts/LanguageContext'

function formatDate(dateStr, locale) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function PlanPublicView() {
  const { token } = useParams()
  const { lang, toggleLang, t } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const p = t('plans')
  const [plan,      setPlan]      = useState(null)
  const [phases,    setPhases]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [activeTab, setActiveTab] = useState('gantt')

  useEffect(() => {
    async function fetchPlan() {
      const { data, error } = await supabase
        .from('project_plans')
        .select(`
          *,
          plan_phases (
            *,
            plan_tasks ( * )
          )
        `)
        .eq('share_token', token)
        .single()

      if (error || !data) {
        setError(p.notFoundPublic)
        setLoading(false)
        return
      }

      const sortedPhases = (data.plan_phases || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(ph => ({
          ...ph,
          plan_tasks: (ph.plan_tasks || []).sort((a, b) => a.order_index - b.order_index),
        }))

      setPlan(data)
      setPhases(sortedPhases)
      setLoading(false)
    }

    fetchPlan()
  }, [token])

  function handlePrint() {
    if (plan) document.title = `${plan.name} — Plan`
    window.print()
    setTimeout(() => { document.title = 'Plan de proyecto' }, 1000)
  }

  const totalHours = phases.reduce((s, p) => s + Number(p.hours || 0), 0)
  const lastEnd    = phases.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, '')

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#000000' }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#bf5af2' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: '#000000' }}
      >
        <p className="text-lg font-semibold" style={{ color: '#f5f5f7' }}>404</p>
        <p className="text-sm" style={{ color: '#6e6e73' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 no-print"
        style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
              <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
              <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
              <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
              <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>OppsHub</span>
            <span style={{ color: '#3a3a3a' }}>/</span>
            <span className="text-sm truncate max-w-xs" style={{ color: '#6e6e73' }}>{plan.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
              {[{ id: 'gantt', label: 'Gantt' }, { id: 'scope', label: 'Alcance' }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: activeTab === tab.id ? '#2a2a2a' : 'transparent',
                    color: activeTab === tab.id ? '#f5f5f7' : '#6e6e73',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={toggleLang}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
            >
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-10">
        {/* Plan header */}
        <div className="mb-8 gantt-print-header">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#f5f5f7' }}>{plan.name}</h1>
          {plan.description && (
            <p className="text-sm mb-4" style={{ color: '#6e6e73' }}>{plan.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {plan.client_name && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" style={{ color: '#6e6e73' }} />
                <span className="text-sm" style={{ color: '#f5f5f7' }}>{plan.client_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" style={{ color: '#6e6e73' }} />
              <span className="text-sm" style={{ color: '#6e6e73' }}>
                {formatDate(plan.start_date, locale)}
                {lastEnd && lastEnd !== plan.start_date && (
                  <> → {formatDate(lastEnd, locale)}</>
                )}
              </span>
            </div>
            {totalHours > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" style={{ color: '#6e6e73' }} />
                <span className="text-sm" style={{ color: '#6e6e73' }}>{totalHours}h {p.estimated}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'gantt' ? (
          <>
            <div className="mb-8 gantt-print-area" style={{ minHeight: 200 }}>
              <GanttChart plan={plan} phases={phases} isEditable={false} />
            </div>
            <PlanInsights plan={plan} phases={phases} hideExport />
          </>
        ) : (
          <PlanScope plan={plan} phases={phases} isEditable={false} onUpdatePhase={null} />
        )}

        {/* Phase list (print-friendly summary) */}
        {phases.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="px-5 py-3"
              style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>
                {p.projectPhases}
              </h2>
            </div>
            {phases.map((phase, idx) => {
              const phaseTasks = phase.plan_tasks || []
              const done = phaseTasks.filter(t => t.done).length
              return (
                <div
                  key={phase.id}
                  className="px-5 py-4"
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#0a0a0a' : '#111111',
                    borderBottom: idx < phases.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: phase.color || '#bf5af2' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="font-medium text-sm" style={{ color: '#f5f5f7' }}>{phase.name}</p>
                        <div className="flex items-center gap-3 shrink-0">
                          {phase.hours > 0 && (
                            <span className="text-xs" style={{ color: '#6e6e73' }}>{phase.hours}h</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs" style={{ color: '#6e6e73' }}>
                        {formatDate(phase.start_date, locale)} → {formatDate(phase.end_date, locale)}
                      </p>
                      {phaseTasks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {phaseTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2">
                              <div
                                className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center"
                                style={{
                                  border: task.done ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                  backgroundColor: task.done ? '#30d158' : 'transparent',
                                }}
                              >
                                {task.done && (
                                  <svg width="8" height="8" viewBox="0 0 10 10">
                                    <polyline points="1.5,5 4,7.5 8.5,2" stroke="#000" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                                  </svg>
                                )}
                              </div>
                              <span
                                className="text-xs"
                                style={{
                                  color: task.done ? '#3a3a3a' : '#6e6e73',
                                  textDecoration: task.done ? 'line-through' : 'none',
                                }}
                              >{task.title}</span>
                              {task.hours > 0 && (
                                <span className="text-xs ml-auto shrink-0" style={{ color: '#3a3a3a' }}>{task.hours}h</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="mt-16 py-6 no-print"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="px-6 flex items-center justify-center gap-2">
          <svg width="14" height="14" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
            <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
            <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
            <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
            <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
          </svg>
          <span className="text-xs" style={{ color: '#3a3a3a' }}>{p.generatedWith}</span>
        </div>
      </footer>
    </div>
  )
}
