import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, X, Folder, CheckSquare, Loader2 } from 'lucide-react'

const PRIORITY_COLOR = { high: '#ff453a', medium: '#ff9f0a', low: '#6e6e73' }
const STATUS_LABEL = { todo: 'Por hacer', in_progress: 'En progreso', done: 'Hecho' }

export default function SearchOverlay({ onClose }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [closing, setClosing] = useState(false)
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  function handleClose() { setClosing(true); setTimeout(onClose, 170) }

  useEffect(() => {
    inputRef.current?.focus()
    fetchAll()

    function onKey(e) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function fetchAll() {
    const { data } = await supabase
      .from('projects')
      .select('id, name, status, type, tasks(id, title, status, priority)')
      .order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  const q = query.trim().toLowerCase()

  const matchedProjects = q
    ? projects.filter(p => p.name.toLowerCase().includes(q))
    : []

  const matchedTasks = q
    ? projects.flatMap(p =>
        (p.tasks || [])
          .filter(t => t.title.toLowerCase().includes(q))
          .map(t => ({ ...t, projectName: p.name, projectId: p.id }))
      )
    : []

  const hasResults = matchedProjects.length > 0 || matchedTasks.length > 0

  function goToProject(id) {
    navigate(`/project/${id}`)
    onClose()
  }

  const anim = closing ? 'modal-out' : 'modal-in'
  const dur  = closing ? '0.17s ease' : '0.22s cubic-bezier(0.16,1,0.3,1)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: `${closing ? 'backdrop-out' : 'backdrop-in'} 0.17s ease both` }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', animation: `${anim} ${dur} both` }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: q ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          {loading ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: '#6e6e73' }} />
          ) : (
            <Search className="w-4 h-4 shrink-0" style={{ color: '#6e6e73' }} />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar proyectos y tareas..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#f5f5f7' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: '#6e6e73' }}>
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2a2a2a', color: '#6e6e73' }}>Esc</kbd>
        </div>

        {/* Results */}
        {q && (
          <div className="max-h-96 overflow-y-auto">
            {!hasResults ? (
              <p className="text-sm text-center py-10" style={{ color: '#6e6e73' }}>Sin resultados para "{query}"</p>
            ) : (
              <div className="p-2 space-y-1">

                {matchedProjects.length > 0 && (
                  <>
                    <p className="text-xs px-3 pt-2 pb-1 font-medium" style={{ color: '#6e6e73' }}>Proyectos</p>
                    {matchedProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => goToProject(p.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Folder className="w-4 h-4 shrink-0" style={{ color: '#6e6e73' }} />
                        <span className="text-sm flex-1" style={{ color: '#f5f5f7' }}>{p.name}</span>
                        <span className="text-xs" style={{ color: '#3a3a3a' }}>
                          {p.type === 'maintenance' ? 'Mant.' : 'Impl.'}
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {matchedTasks.length > 0 && (
                  <>
                    <p className="text-xs px-3 pt-3 pb-1 font-medium" style={{ color: '#6e6e73' }}>Tareas</p>
                    {matchedTasks.slice(0, 8).map(t => (
                      <button
                        key={t.id}
                        onClick={() => goToProject(t.projectId)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR[t.priority] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{
                            color: t.status === 'done' ? '#6e6e73' : '#f5f5f7',
                            textDecoration: t.status === 'done' ? 'line-through' : 'none',
                          }}>{t.title}</p>
                          <p className="text-xs" style={{ color: '#6e6e73' }}>{t.projectName}</p>
                        </div>
                        <span className="text-xs shrink-0" style={{ color: '#3a3a3a' }}>{STATUS_LABEL[t.status]}</span>
                      </button>
                    ))}
                    {matchedTasks.length > 8 && (
                      <p className="text-xs text-center py-2" style={{ color: '#6e6e73' }}>
                        +{matchedTasks.length - 8} más
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state hint */}
        {!q && !loading && (
          <p className="text-xs text-center py-6" style={{ color: '#3a3a3a' }}>
            Escribe para buscar proyectos o tareas
          </p>
        )}
      </div>
    </div>
  )
}
