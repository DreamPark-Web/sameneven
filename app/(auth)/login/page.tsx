'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BRAND_COLOR = '#E8C49A'

function lightenColor(hex: string, factor = 0.15) {
  const clean = (hex || BRAND_COLOR).replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) || 0
  const g = parseInt(clean.slice(2, 4), 16) || 0
  const b = parseInt(clean.slice(4, 6), 16) || 0
  const lr = Math.min(255, Math.round(r + (255 - r) * factor))
  const lg = Math.min(255, Math.round(g + (255 - g) * factor))
  const lb = Math.min(255, Math.round(b + (255 - b) * factor))
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

function hexToRgb(hex: string) {
  const clean = (hex || BRAND_COLOR).replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

function applyThemeVars(color: string) {
  if (typeof document === 'undefined') return
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  let hex = (color || BRAND_COLOR).toLowerCase()
  if (isLight && hex === '#e8c49a') hex = '#a0622a'
  const light = lightenColor(hex, 0.15)
  const { r, g, b } = hexToRgb(hex)
  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent2', light)
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
}

export default function LoginPage() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('se_theme')
    return stored ? stored === 'dark' : true
  })
  const [isThemeHovered, setIsThemeHovered] = useState(false)
  const [isGoogleHovered, setIsGoogleHovered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [magicEmail, setMagicEmail] = useState('')
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [magicError, setMagicError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('se_theme', isDark ? 'dark' : 'light')
    applyThemeVars(BRAND_COLOR)
  }, [isDark])

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/picker')
    }
    checkAuth()
  }, [])

  async function handleGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleMagicLink() {
    setMagicError('')
    if (!magicEmail.trim()) return
    setMagicLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setMagicError(error.message)
    } else {
      setMagicSent(true)
    }
    setMagicLoading(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background diamond decoration */}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          right: -585,
          bottom: -280,
          width: 1200,
          height: 1200,
          opacity: 0.06,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <defs>
          <linearGradient id="loginAmberFillBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8C49A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#E8C49A" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <polygon points="65,18 135,18 192,62 100,175 8,62" fill="url(#loginAmberFillBg)" />
        <polyline points="65,18 135,18 192,62 100,175 8,62 65,18" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
        <line x1="65" y1="18" x2="48" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
        <line x1="135" y1="18" x2="152" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
        <line x1="65" y1="18" x2="100" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
        <line x1="135" y1="18" x2="100" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
        <polyline points="8,62 48,66 100,66 152,66 192,62" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
        <line x1="48" y1="66" x2="100" y2="175" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
        <line x1="152" y1="66" x2="100" y2="175" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
        <line x1="100" y1="66" x2="100" y2="175" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
        <line x1="8" y1="118" x2="192" y2="118" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
      </svg>

      {/* Topbar */}
      <header
        style={{
          background: 'var(--s1)',
          boxShadow: '0 2px 0 0 rgba(var(--accent-rgb), 0.35)',
          paddingLeft: 24,
          paddingRight: 24,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 27 }}>
          <svg
            width="38"
            height="38"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ display: 'block', flexShrink: 0 }}
          >
            <defs>
              <linearGradient id="loginAmberFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <polygon points="65,18 135,18 192,62 100,175 8,62" fill="url(#loginAmberFill)" />
            <polyline points="65,18 135,18 192,62 100,175 8,62 65,18" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
            <line x1="65" y1="18" x2="48" y2="66" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
            <line x1="135" y1="18" x2="152" y2="66" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
            <line x1="65" y1="18" x2="100" y2="66" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
            <line x1="135" y1="18" x2="100" y2="66" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
            <polyline points="8,62 48,66 100,66 152,66 192,62" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
            <line x1="48" y1="66" x2="100" y2="175" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
            <line x1="152" y1="66" x2="100" y2="175" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
            <line x1="100" y1="66" x2="100" y2="175" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
            <line x1="8" y1="118" x2="192" y2="118" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
          </svg>

          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-.3px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text)' }}>Get&nbsp;</span>
            <span style={{ color: 'var(--accent)' }}>Clear</span>
          </div>
        </div>

        <button
          onClick={() => setIsDark(d => !d)}
          onMouseEnter={() => setIsThemeHovered(true)}
          onMouseLeave={() => setIsThemeHovered(false)}
          type="button"
          title={isDark ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
          aria-label={isDark ? 'Lichte modus' : 'Donkere modus'}
          style={{
            width: 40,
            height: 40,
            background: isThemeHovered ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent',
            border: '1px solid rgba(var(--accent-rgb), 0.2)',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isThemeHovered ? 'var(--accent)' : 'var(--muted)',
            flexShrink: 0,
            transition: 'background .15s, color .15s',
          }}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </header>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: 'var(--s1)',
            border: '1px solid var(--card-border)',
            borderRadius: 16,
            padding: '44px 40px 36px',
            width: '100%',
            maxWidth: 400,
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,.32)',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <svg
              width="72"
              height="72"
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="loginFormFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8C49A" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#E8C49A" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <polygon points="65,18 135,18 192,62 100,175 8,62" fill="url(#loginFormFill)" />
              <polyline points="65,18 135,18 192,62 100,175 8,62 65,18" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
              <line x1="65" y1="18" x2="48" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
              <line x1="135" y1="18" x2="152" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
              <line x1="65" y1="18" x2="100" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
              <line x1="135" y1="18" x2="100" y2="66" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
              <polyline points="8,62 48,66 100,66 152,66 192,62" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
              <line x1="48" y1="66" x2="100" y2="175" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
              <line x1="152" y1="66" x2="100" y2="175" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
              <line x1="100" y1="66" x2="100" y2="175" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
              <line x1="8" y1="118" x2="192" y2="118" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 14,
              color: 'rgba(245,245,245,0.45)',
              marginBottom: 32,
              fontFamily: 'var(--font-body)',
              letterSpacing: '.02em',
            }}
          >
            Financieel inzicht, samen.
          </div>

          {/* Google button */}
          <button
            onClick={() => void handleGoogle()}
            onMouseEnter={() => setIsGoogleHovered(true)}
            onMouseLeave={() => setIsGoogleHovered(false)}
            disabled={loading}
            type="button"
            style={{
              width: '100%',
              background: 'var(--s1)',
              border: `1px solid rgba(232,196,154,${isGoogleHovered ? '0.65' : '0.4'})`,
              borderRadius: 10,
              color: '#F5F5F5',
              padding: '13px 16px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 0,
              transition: 'border-color .15s, transform .15s',
              transform: isGoogleHovered && !loading ? 'translateY(-1px)' : 'none',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.5 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 10-1.9 13.6-5.1l-6.3-5.2C29.5 35.5 26.9 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.6 4.9C9.7 39.5 16.3 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.3 5.2C41.1 36.1 44 30.5 44 24c0-1.3-.1-2.7-.4-4z" />
            </svg>
            {loading ? 'Bezig...' : 'Inloggen met Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,196,154,0.12)' }} />
            <span style={{ fontSize: 11, color: 'rgba(245,245,245,0.3)', fontFamily: 'var(--font-body)' }}>of</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,196,154,0.12)' }} />
          </div>

          {/* Magic link */}
          {magicSent ? (
            <div style={{ background: 'rgba(232,196,154,0.08)', border: '1px solid rgba(232,196,154,0.25)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#E8C49A', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: 24 }}>
              Check je inbox! We hebben een inloglink gestuurd naar <strong>{magicEmail}</strong>.
            </div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              <input
                type="email"
                placeholder="Jouw e-mailadres"
                value={magicEmail}
                onChange={e => setMagicEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleMagicLink() }}
                autoComplete="email"
                style={{
                  width: '100%',
                  background: 'var(--s2)',
                  border: '1px solid rgba(232,196,154,0.2)',
                  borderRadius: 10,
                  color: '#F5F5F5',
                  padding: '13px 16px',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 10,
                }}
              />
              {magicError && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8, textAlign: 'left' }}>{magicError}</div>
              )}
              <button
                onClick={() => void handleMagicLink()}
                disabled={magicLoading || !magicEmail.trim()}
                type="button"
                style={{
                  width: '100%',
                  background: 'rgba(232,196,154,0.08)',
                  border: '1px solid rgba(232,196,154,0.4)',
                  borderRadius: 10,
                  color: '#E8C49A',
                  padding: '13px 16px',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  cursor: magicLoading || !magicEmail.trim() ? 'not-allowed' : 'pointer',
                  opacity: magicLoading || !magicEmail.trim() ? 0.5 : 1,
                  transition: 'opacity .15s',
                }}
              >
                {magicLoading ? 'Bezig...' : 'Stuur inloglink'}
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <div
            style={{
              fontSize: 11,
              color: 'rgba(245,245,245,0.3)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
            }}
          >
            Door in te loggen ga je akkoord met onze voorwaarden.
          </div>
        </div>
      </div>
    </div>
  )
}
