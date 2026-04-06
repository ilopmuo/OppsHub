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
        toast.success('Cuenta creada. Revisa tu email.')
      }
    } catch (err) {
      toast.error(err.message || 'Ha ocurrido un error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#000000' }}>
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex justify-center mb-10">
          <div style={{ width: 44, height: 44 }}>
            <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="44" height="44" rx="10" fill="#1a1a1a"/>
              <rect x="10" y="10" width="10" height="10" rx="2" fill="white"/>
              <rect x="24" y="10" width="10" height="10" rx="2" fill="white" opacity="0.5"/>
              <rect x="10" y="24" width="10" height="10" rx="2" fill="white" opacity="0.5"/>
              <rect x="24" y="24" width="10" height="10" rx="2" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-semibold text-center mb-2 tracking-tight" style={{ color: '#f5f5f7' }}>
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>
        <p className="text-center text-sm mb-10" style={{ color: '#6e6e73' }}>
          {mode === 'login' ? 'Accede a OpsHub' : 'Empieza a gestionar tus proyectos'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f5f5f7',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña"
            minLength={6}
            className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f5f5f7',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all mt-1"
            style={{
              backgroundColor: loading ? '#e5e5e5' : '#f5f5f7',
              color: '#000000',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#ffffff' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#f5f5f7' }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#666' }} />}
            {mode === 'login' ? 'Continuar' : 'Crear cuenta'}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm mt-8" style={{ color: '#6e6e73' }}>
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
            className="transition-colors"
            style={{ color: '#f5f5f7' }}
            onMouseEnter={e => e.target.style.color = '#6e6e73'}
            onMouseLeave={e => e.target.style.color = '#f5f5f7'}
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
