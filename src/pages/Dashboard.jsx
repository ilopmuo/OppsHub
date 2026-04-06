import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, LogOut, Sun, Moon, LayoutDashboard } from 'lucide-react'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'
import { useTheme } from '../hooks/useTheme'

const STATUS_ORDER = { blocked: 0, at_risk: 1, on_track: 2 }

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        tasks (
          id, title, done, priority, due_date
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Error al cargar proyectos')
    } else {
      const sorted = (data || []).sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      )
      setProjects(sorted)
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
  }

  function onProjectCreated(project) {
    setProjects(prev => {
      const updated = [{ ...project, tasks: [] }, ...prev]
      return updated.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    })
    setShowModal(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 p-1.5 rounded-lg">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">OpsHub</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm hidden sm:block">{user?.email}</span>
            <button
              onClick={toggle}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              title="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Title row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Proyectos activos</h1>
            <p className="text-gray-400 text-sm mt-1">
              {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo proyecto</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-44 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-white font-semibold text-lg mb-2">Sin proyectos todavía</h2>
            <p className="text-gray-400 text-sm mb-6">
              Crea tu primer proyecto para empezar a gestionar tus clientes
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Crear proyecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={onProjectCreated}
        />
      )}
    </div>
  )
}
