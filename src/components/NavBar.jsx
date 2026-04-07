import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Search } from 'lucide-react'
import SearchOverlay from './SearchOverlay'

const NAV = [
  {
    label: 'Proyectos',
    path: '/',
    icon: (
      <svg width="14" height="14" viewBox="0 0 44 44" fill="none">
        <rect x="3" y="3" width="17" height="17" rx="3" fill="currentColor"/>
        <rect x="24" y="3" width="17" height="17" rx="3" fill="currentColor" opacity="0.4"/>
        <rect x="3" y="24" width="17" height="17" rx="3" fill="currentColor" opacity="0.4"/>
        <rect x="24" y="24" width="17" height="17" rx="3" fill="currentColor"/>
      </svg>
    ),
  },
  {
    label: 'Agenda',
    path: '/agenda',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
]

export default function NavBar({ breadcrumb }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <>
    <header
      className="sticky top-0 z-20"
      style={{
        backgroundColor: 'rgba(0,0,0,0.72)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 shrink-0"
        >
          <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
            <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
            <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
            <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
            <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
          </svg>
          <span className="font-semibold text-sm" style={{ color: '#f5f5f7' }}>OppsHub</span>
        </button>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV.map(({ label, path, icon }) => {
            const active = location.pathname === path ||
              (path === '/' && location.pathname.startsWith('/project'))
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  color: active ? '#f5f5f7' : '#6e6e73',
                  backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#f5f5f7' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#6e6e73' }}
              >
                {icon}
                {label}
              </button>
            )
          })}
        </nav>

        {/* Breadcrumb (ProjectDetail) */}
        {breadcrumb && (
          <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
            <span style={{ color: '#3a3a3a' }}>/</span>
            <span className="truncate font-medium" style={{ color: '#6e6e73' }}>{breadcrumb}</span>
          </div>
        )}

        {/* Spacer */}
        {!breadcrumb && <div className="flex-1" />}

        {/* User */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f5f5f7'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6e6e73'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
            title="Buscar (⌘K)"
          >
            <Search className="w-3.5 h-3.5" />
            <kbd className="text-xs hidden sm:block" style={{ color: '#3a3a3a' }}>⌘K</kbd>
          </button>
          <span className="text-xs hidden sm:block" style={{ color: '#6e6e73' }}>{user?.email}</span>
          <button
            onClick={handleLogout}
            className="transition-colors"
            style={{ color: '#6e6e73' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f5f5f7'}
            onMouseLeave={e => e.currentTarget.style.color = '#6e6e73'}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>

    {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
  </>
  )
}
