'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('Check je e-mail voor een bevestigingslink.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/picker')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        background: 'var(--s1)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 420,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
          <span style={{ color: 'var(--text)' }}>Samen</span>{' '}
          <span style={{ color: 'var(--accent)' }}>Even</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Welkom terug</div>
        <div className="caption" style={{ marginBottom: 28 }}>Jouw gedeelde financiële inzichten</div>

        <button onClick={handleGoogle} className="btn-google" style={{
          width: '100%',
          background: 'var(--s2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text)',
          padding: '11px 12px',
          fontSize: 13,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 0,
          transition: 'border-color .15s'
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.5 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 10-1.9 13.6-5.1l-6.3-5.2C29.5 35.5 26.9 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.6 4.9C9.7 39.5 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.3 5.2C41.1 36.1 44 30.5 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Inloggen met Google
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '18px 0',
          fontSize: 11,
          color: 'var(--muted)'
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          of met e-mail
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <input
            className="inp-auth"
            type="email"
            placeholder="E-mailadres"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              marginBottom: 10,
              display: 'block',
              boxSizing: 'border-box'
            }}
          />
          <input
            className="inp-auth"
            type="password"
            placeholder="Wachtwoord"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              marginBottom: 10,
              display: 'block',
              boxSizing: 'border-box'
            }}
          />
          {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%',
            background: 'var(--accent)',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 6,
            padding: 11,
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            display: 'block',
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Laden...' : isRegister ? 'Registreren' : 'Inloggen'}
          </button>
        </form>

        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
          {isRegister ? 'Al een account? ' : 'Nog geen account? '}
          <span
            onClick={() => setIsRegister(!isRegister)}
            style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {isRegister ? 'Inloggen' : 'Registreer hier'}
          </span>
        </div>
      </div>
    </main>
  )
}