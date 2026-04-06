import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('Bienvenido de vuelta')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Cuenta creada. Revisa tu email para confirmar.')
      }
    } catch (err) {
      toast.error(err.message || 'Ha ocurrido un error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: '#0d1b2a' }}
    >
      {/* Left panel — branding (hidden on mobile) */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 relative overflow-hidden"
        style={{ backgroundColor: '#1b263b' }}
      >
        {/* Decorative gradient orb */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #415a77, transparent)' }}
        />
        <div
          className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #778da9, transparent)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#415a77' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e0e1dd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ color: '#e0e1dd' }}>OpsHub</span>
          </div>

          <h1 className="text-3xl font-bold leading-snug mb-4" style={{ color: '#e0e1dd' }}>
            Gestión de proyectos<br />sin fricción
          </h1>
          <p className="text-base leading-relaxed" style={{ color: '#778da9' }}>
            Centraliza el estado de todos tus clientes. Sabe en tiempo real qué está bloqueado, qué está en riesgo y qué va según plan.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4">
          {[
            { icon: '◉', text: 'Dashboard visual con estado por proyecto' },
            { icon: '◎', text: 'Gestión de tareas por prioridad' },
            { icon: '◈', text: 'Alertas de deadline automáticas' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-base" style={{ color: '#415a77' }}>{icon}</span>
              <span className="text-sm" style={{ color: '#778da9' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#415a77' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e0e1dd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight" style={{ color: '#e0e1dd' }}>OpsHub</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#e0e1dd' }}>
              {mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta'}
            </h2>
            <p className="text-sm" style={{ color: '#778da9' }}>
              {mode === 'login'
                ? 'Introduce tus credenciales para continuar'
                : 'Completa los datos para empezar'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#778da9' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl px-4 py-3 text-sm transition-all outline-none"
                style={{
                  backgroundColor: '#1b263b',
                  border: '1px solid #415a77',
                  color: '#e0e1dd',
                }}
                onFocus={e => e.target.style.borderColor = '#778da9'}
                onBlur={e => e.target.style.borderColor = '#415a77'}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#778da9' }}>
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                className="w-full rounded-xl px-4 py-3 text-sm transition-all outline-none"
                style={{
                  backgroundColor: '#1b263b',
                  border: '1px solid #415a77',
                  color: '#e0e1dd',
                }}
                onFocus={e => e.target.style.borderColor = '#778da9'}
                onBlur={e => e.target.style.borderColor = '#415a77'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold transition-all mt-2"
              style={{
                backgroundColor: '#415a77',
                color: '#e0e1dd',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!loading) e.target.style.backgroundColor = '#4e6d8f' }}
              onMouseLeave={e => e.target.style.backgroundColor = '#415a77'}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm mt-8" style={{ color: '#778da9' }}>
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
              className="font-medium transition-colors"
              style={{ color: '#e0e1dd' }}
              onMouseEnter={e => e.target.style.color = '#778da9'}
              onMouseLeave={e => e.target.style.color = '#e0e1dd'}
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
