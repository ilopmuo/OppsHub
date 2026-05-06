import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { useLang } from '../contexts/LanguageContext'

export default function AuthPage() {
  const navigate = useNavigate()
  const { t, lang, toggleLang } = useLang()
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
        toast.success(t('auth.welcomeBack'))
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success(t('auth.accountCreated'))
      }
      // Redirect to pending invite if exists
      const pendingInvite = localStorage.getItem('pending_invite')
      if (pendingInvite) {
        localStorage.removeItem('pending_invite')
        navigate(`/join?token=${pendingInvite}`, { replace: true })
      }
    } catch (err) {
      toast.error(err.message || t('auth.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: '#000000' }}>
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 65%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 40% 30% at 80% 80%, rgba(48,209,88,0.04) 0%, transparent 60%)',
      }} />

      <div className="w-full max-w-sm relative page-enter">
        {/* Logo mark */}
        <div className="flex justify-center mb-10">
          <div className="logo-float" style={{ width: 44, height: 44 }}>
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
          {mode === 'login' ? t('auth.login') : t('auth.register')}
        </h1>
        <p className="text-center text-sm mb-10" style={{ color: '#6e6e73' }}>
          {mode === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('auth.email')}
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
            placeholder={t('auth.password')}
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
            {mode === 'login' ? t('auth.continue') : t('auth.register')}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm mt-8" style={{ color: '#6e6e73' }}>
          {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
          <button
            onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
            className="transition-colors"
            style={{ color: '#f5f5f7' }}
            onMouseEnter={e => e.target.style.color = '#6e6e73'}
            onMouseLeave={e => e.target.style.color = '#f5f5f7'}
          >
            {mode === 'login' ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </p>

        {/* Language toggle */}
        <div className="flex justify-center mt-10">
          <button
            onClick={toggleLang}
            className="text-xs transition-colors"
            style={{ color: '#3a3a3a' }}
            onMouseEnter={e => e.currentTarget.style.color = '#6e6e73'}
            onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}
          >
            {lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          </button>
        </div>
      </div>
    </div>
  )
}
