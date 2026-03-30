'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BRAND_THEME = '#E8C49A'

function lightenColor(hex: string, factor = 0.15) {
  const clean = (hex || BRAND_THEME).replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) || 0
  const g = parseInt(clean.slice(2, 4), 16) || 0
  const b = parseInt(clean.slice(4, 6), 16) || 0

  const lr = Math.min(255, Math.round(r + (255 - r) * factor))
  const lg = Math.min(255, Math.round(g + (255 - g) * factor))
  const lb = Math.min(255, Math.round(b + (255 - b) * factor))

  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

function hexToRgb(hex: string) {
  const clean = (hex || BRAND_THEME).replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

function applyThemeVars(color: string) {
  if (typeof document === 'undefined') return

  const hex = (color || BRAND_THEME).toLowerCase()
  const light = lightenColor(hex, 0.15)
  const { r, g, b } = hexToRgb(hex)

  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent2', light)
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
}

type Profile = {
  display_name?: string | null
  avatar_url?: string | null
}

export default function PickerPage() {
  const [households, setHouseholds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showAccount, setShowAccount] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      setProfile(prof)

      const { data: memberships } = await supabase
        .from('household_members')
        .select('*, households(*)')
        .eq('user_id', user.id)

      const baseHouseholds =
        memberships?.map((m: any) => m.households).filter(Boolean) || []

      setHouseholds(baseHouseholds)
      applyThemeVars(BRAND_THEME)

      setLoading(false)
    }

    load()
  }, [router, supabase])

  async function createInsight() {
    const name = prompt('Naam van je nieuwe Insight:')
    if (!name?.trim() || !user?.id) return

    const { data: hh } = await supabase
      .from('households')
      .insert({ name, created_by: user.id })
      .select()
      .single()

    if (hh) {
      await supabase
        .from('household_members')
        .insert({
          household_id: hh.id,
          user_id: user.id,
          role: 'owner',
          slot: 'user1',
        })

      await supabase
        .from('household_data')
        .insert({
          household_id: hh.id,
          data: { theme: '#00dcc8' },
        })

      applyThemeVars(BRAND_THEME)
      router.push(`/insight/${hh.id}`)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function openInsight(hh: any) {
    applyThemeVars(BRAND_THEME)
    router.push(`/insight/${hh.id}`)
  }

  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'Gebruiker'
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function openAccount() {
    setAccountName(displayName)
    setShowAccount(true)
  }

  async function saveAccount() {
    if (!accountName.trim() || !user?.id) return

    const nextName = accountName.trim()
    setIsSavingAccount(true)

    try {
      await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: nextName }, { onConflict: 'id' })

      setProfile((prev: Profile | null) => (prev ? { ...prev, display_name: nextName } : prev))
      setShowAccount(false)
    } finally {
      setIsSavingAccount(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0F0F0F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#888888', fontSize: 14 }}>Laden...</div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F0F0F',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
          <linearGradient id="amberFillBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8C49A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#E8C49A" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <polygon
          points="65,18 135,18 192,62 100,175 8,62"
          fill="url(#amberFillBg)"
          style={{
            stroke: 'none',
            color: 'rgb(255, 255, 255)',
            strokeWidth: 1,
            strokeLinecap: 'butt',
            strokeLinejoin: 'miter',
            opacity: 1,
          }}
        />

        <polyline
          points="65,18 135,18 192,62 100,175 8,62 65,18"
          fill="none"
          stroke="#E8C49A"
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line x1="65" y1="18" x2="48" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="135" y1="18" x2="152" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="65" y1="18" x2="100" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="135" y1="18" x2="100" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

        <polyline
          points="8,62 48,66 100,66 152,66 192,62"
          fill="none"
          stroke="#E8C49A"
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line x1="48" y1="66" x2="100" y2="175" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="152" y1="66" x2="100" y2="175" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="100" y1="66" x2="100" y2="175" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

        <line x1="8" y1="118" x2="192" y2="118" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
      </svg>

      <header
        style={{
          background: '#141414',
          boxShadow: '0 2px 0 0 rgba(232,196,154,0.35)',
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 0,
          paddingBottom: 0,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 0, paddingTop: 0 }}>
          <svg
            width="38"
            height="38"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ display: 'block', flexShrink: 0, alignSelf: 'center' }}
          >
            <defs>
              <linearGradient id="amberFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8C49A" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#E8C49A" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            <polygon
              points="65,18 135,18 192,62 100,175 8,62"
              fill="url(#amberFill)"
              style={{ stroke: 'none', color: 'rgb(255, 255, 255)', strokeWidth: 1 }}
            />

            <polyline
              points="65,18 135,18 192,62 100,175 8,62 65,18"
              fill="none"
              stroke="#E8C49A"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <line x1="65" y1="18" x2="48" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="135" y1="18" x2="152" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="65" y1="18" x2="100" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="135" y1="18" x2="100" y2="66" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

            <polyline
              points="8,62 48,66 100,66 152,66 192,62"
              fill="none"
              stroke="#E8C49A"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <line x1="48" y1="66" x2="100" y2="175" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="152" y1="66" x2="100" y2="175" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="100" y1="66" x2="100" y2="175" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

            <line x1="8" y1="118" x2="192" y2="118" fill="none" stroke="#E8C49A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
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
            <span style={{ color: '#F5F5F5' }}>Get&nbsp;</span>
            <span style={{ color: '#E8C49A' }}>Clear</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, paddingTop: 0 }}>
          <button
            onClick={openAccount}
            type="button"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: '1px solid rgba(232,196,154,0.2)',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              lineHeight: 0,
              padding: 0,
              cursor: 'pointer',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            title="Google profiel / hoofdmenu"
            aria-label="Google profiel / hoofdmenu"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                alt={displayName}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#E8C49A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#0F0F0F',
                }}
              >
                {initials}
              </div>
            )}
          </button>
        </div>
      </header>

      {showAccount && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.75)',
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAccount(false)
          }}
        >
          <div
            style={{
              background: '#1A1A1A',
              border: '1px solid rgba(232,196,154,0.2)',
              borderRadius: 14,
              padding: 28,
              width: '100%',
              maxWidth: 520,
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,.42)',
            }}
          >
            <button
              onClick={() => setShowAccount(false)}
              type="button"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                background: 'transparent',
                border: '1px solid rgba(232,196,154,0.2)',
                borderRadius: 8,
                color: '#888888',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Sluiten"
            >
              ×
            </button>

            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 20,
                fontFamily: 'var(--font-heading)',
                color: '#F5F5F5',
              }}
            >
              Mijn account
            </div>

            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: '#888888',
                marginBottom: 6,
                display: 'block',
              }}
            >
              Jouw naam
            </label>
            <input
              style={{
                width: '100%',
                background: '#141414',
                border: '1px solid rgba(232,196,154,0.2)',
                borderRadius: 6,
                color: '#F5F5F5',
                padding: '9px 11px',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                marginBottom: 14,
              }}
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />

            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: '#888888',
                marginBottom: 6,
                display: 'block',
              }}
            >
              E-mailadres
            </label>
            <input
              style={{
                width: '100%',
                background: '#141414',
                border: '1px solid rgba(232,196,154,0.2)',
                borderRadius: 6,
                color: '#F5F5F5',
                padding: '9px 11px',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                marginBottom: 22,
                opacity: 0.8,
              }}
              type="email"
              value={user?.email || ''}
              disabled
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={() => {
                  setShowAccount(false)
                  void logout()
                }}
                type="button"
                style={{
                  background: 'rgba(232,196,154,.06)',
                  color: '#E8C49A',
                  border: '1px solid rgba(232,196,154,0.2)',
                  borderRadius: 5,
                  padding: '11px 16px',
                  fontSize: 11,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Uitloggen
              </button>

              <button
                onClick={() => void saveAccount()}
                type="button"
                disabled={isSavingAccount}
                style={{
                  background: '#E8C49A',
                  color: '#0F0F0F',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 16px',
                  fontSize: 12,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  cursor: isSavingAccount ? 'wait' : 'pointer',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  opacity: isSavingAccount ? 0.75 : 1,
                }}
              >
                {isSavingAccount ? 'Bezig...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '36px 28px', maxWidth: 1320, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            lineHeight: 1.15,
            marginBottom: 16,
            color: '#F5F5F5',
            marginLeft: 0,
            paddingLeft: 0,
          }}
        >
          {greeting}, {displayName.split(' ')[0]}
        </div>

        <div style={{ fontSize: 12, color: '#888888', marginBottom: 32, textAlign: 'left', marginLeft: 0, paddingLeft: 0 }}>
          Kies een Insight of maak een nieuwe aan.
        </div>

        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {households.map((hh) => {
            return (
              <button
                key={hh.id}
                onClick={() => openInsight(hh)}
                style={{
                  background: '#1A1A1A',
                  border: '2px solid rgba(232,196,154,0.35)',
                  borderRadius: 10,
                  padding: 22,
                  cursor: 'pointer',
                  minHeight: 170,
                  height: 170,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  textAlign: 'left',
                  transition: 'border-color .2s, transform .18s ease, box-shadow .2s ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(232,196,154,0.95)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'none'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    marginBottom: 12,
                    color: '#F5F5F5',
                  }}
                >
                  {hh.name}
                </div>

                  <div style={{ fontSize: 11, color: '#888888' }}>Klik om te openen</div>
              </button>
            )
          })}

          <button
            onClick={createInsight}
            style={{
              border: '2px solid rgba(232,196,154,0.35)',
              background: '#1A1A1A',
              borderRadius: 10,
              minHeight: 170,
              height: 170,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: '#888888',
              cursor: 'pointer',
              transition: 'border-color .2s, color .2s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = '#E8C49A'
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(232,196,154,0.95)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = '#888888'
              ;(e.currentTarget as HTMLElement).style.transform = 'none'
              ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
            }}
          >
            <span style={{ fontSize: 32, lineHeight: 1, color: '#E8C49A' }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F5' }}>Nieuwe Insight</span>
          </button>
        </div>
      </div>
    </div>
  )
}