'use client'

import { useEffect, useRef, useState } from 'react'
import LoadingScreen from '@/components/LoadingScreen'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'
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

  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  let hex = (color || BRAND_THEME).toLowerCase()
  if (isLight && hex === '#e8c49a') hex = '#a0622a'

  const light = lightenColor(hex, 0.15)
  const { r, g, b } = hexToRgb(hex)

  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent2', light)
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
}

export default function PickerPage() {
  const { currentUser: user, profile, userLoading, updateProfile, saveDisplayName } = useUser()
  const [households, setHouseholds] = useState<any[]>([])
  const [householdsReady, setHouseholdsReady] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('se_theme')
    return stored ? stored === 'dark' : true
  })
  const [isThemeHovered, setIsThemeHovered] = useState(false)
  const [ownerOf, setOwnerOf] = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('se_theme', isDark ? 'dark' : 'light')
    applyThemeVars(BRAND_THEME)
  }, [isDark])

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [userLoading, user, router])

  useEffect(() => {
    if (!user?.id) return

    const inviteCode = new URLSearchParams(window.location.search).get('invite')
      || localStorage.getItem('se_pending_invite')

    if (!inviteCode) return

    localStorage.removeItem('se_pending_invite')

    async function processInvite() {
      const { data: household } = await supabase
        .from('households')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle()

      if (!household) return

      const { data: existing } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('household_id', household.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existing) {
        await supabase.from('household_members').insert({
          household_id: household.id,
          user_id: user.id,
          role: 'editor',
        })
      }

      router.push(`/insight/${household.id}`)
    }

    processInvite()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    async function loadHouseholds() {
      const { data: memberships } = await supabase
        .from('household_members')
        .select('*, households(*)')
        .eq('user_id', user.id)

      const baseHouseholds =
        memberships?.map((m: any) => m.households).filter(Boolean) || []

      setHouseholds(baseHouseholds)
      setOwnerOf(new Set(memberships?.filter((m: any) => m.role === 'owner').map((m: any) => m.household_id) || []))
      applyThemeVars(BRAND_THEME)
      setHouseholdsReady(true)
    }
    loadHouseholds()
  }, [user?.id])

  async function createInsight() {
    if (!createName.trim() || !user?.id) return
    setIsCreating(true)

    const { data: hh } = await supabase
      .from('households')
      .insert({ name: createName.trim(), created_by: user.id })
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
          data: { theme: '#E8C49A' },
        })

      applyThemeVars(BRAND_THEME)
      router.push(`/insight/${hh.id}`)
    }

    setIsCreating(false)
  }

  async function deleteInsight(id: string) {
    setIsDeleting(true)
    setDeleteError(null)
    const [r1, r2, r3] = await Promise.all([
      supabase.from('household_data').delete().eq('household_id', id),
      supabase.from('household_members').delete().eq('household_id', id),
      supabase.from('households').delete().eq('id', id),
    ])
    const err = r1.error || r2.error || r3.error
    if (err) {
      setDeleteError('Verwijderen is niet gelukt. Probeer het opnieuw.')
      setIsDeleting(false)
      return
    }
    setHouseholds(prev => prev.filter(h => h.id !== id))
    setDeleteConfirmId(null)
    setIsDeleting(false)
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
      await saveDisplayName(nextName)
      setShowAccount(false)
    } finally {
      setIsSavingAccount(false)
    }
  }

  async function saveAvatar(file: File) {
    if (!user?.id) return
    setIsUploadingAvatar(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          const size = 256
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')!
          const scale = Math.max(size / img.width, size / img.height)
          const w = img.width * scale
          const h = img.height * scale
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = reject
        img.src = objectUrl
      })
      await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: dataUrl }, { onConflict: 'id' })
      updateProfile(displayName, dataUrl)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  if (userLoading || !householdsReady) return <LoadingScreen />

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
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
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
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line x1="65" y1="18" x2="48" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="135" y1="18" x2="152" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="65" y1="18" x2="100" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="135" y1="18" x2="100" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

        <polyline
          points="8,62 48,66 100,66 152,66 192,62"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line x1="48" y1="66" x2="100" y2="175" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="152" y1="66" x2="100" y2="175" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
        <line x1="100" y1="66" x2="100" y2="175" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

        <line x1="8" y1="118" x2="192" y2="118" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
      </svg>

      <header
        style={{
          background: 'var(--s1)',
          boxShadow: '0 2px 0 0 rgba(var(--accent-rgb), 0.35)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 27, marginTop: 0, paddingTop: 0 }}>
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
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
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
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <line x1="65" y1="18" x2="48" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="135" y1="18" x2="152" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="65" y1="18" x2="100" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="135" y1="18" x2="100" y2="66" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

            <polyline
              points="8,62 48,66 100,66 152,66 192,62"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <line x1="48" y1="66" x2="100" y2="175" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="152" y1="66" x2="100" y2="175" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
            <line x1="100" y1="66" x2="100" y2="175" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />

            <line x1="8" y1="118" x2="192" y2="118" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="miter" />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, paddingTop: 0 }}>
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

          <button
            onClick={openAccount}
            type="button"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: '1px solid rgba(var(--accent-rgb), 0.2)',
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
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent-fg)',
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={(e) => { backdropRef.current = e.target === e.currentTarget }}
          onClick={(e) => { if (e.target === e.currentTarget && backdropRef.current) setShowAccount(false) }}
        >
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.42)' }}>
            <button
              onClick={() => setShowAccount(false)}
              type="button"
              style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>

            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, fontFamily: 'var(--font-heading)' }}>Mijn account</div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void saveAvatar(f); e.target.value = '' }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setAvatarHovered(true)}
                onMouseLeave={() => setAvatarHovered(false)}
                disabled={isUploadingAvatar}
                title="Profielfoto wijzigen"
                style={{ position: 'relative', width: 68, height: 68, borderRadius: '50%', padding: 0, border: avatarHovered ? '2px solid var(--accent)' : '2px solid transparent', background: 'var(--accent)', overflow: 'hidden', cursor: isUploadingAvatar ? 'wait' : 'pointer', flexShrink: 0, transition: 'border-color .15s' }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={displayName} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent-fg)' }}>
                    {isUploadingAvatar ? '…' : initials}
                  </div>
                )}
                {(avatarHovered || isUploadingAvatar) && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                    {isUploadingAvatar ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    )}
                  </div>
                )}
              </button>
            </div>

            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>Jouw naam</label>
            <input
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text)', padding: '9px 11px', fontSize: 13, fontFamily: 'var(--font-body)', marginBottom: 14 }}
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
            />

            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>E-mailadres</label>
            <input
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text)', padding: '9px 11px', fontSize: 13, fontFamily: 'var(--font-body)', marginBottom: 14, opacity: 0.6 }}
              type="email"
              value={user?.email || ''}
              disabled
            />

            <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Persoonlijk</div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6 }}>Je Google-naam wordt als eerste gebruikt. Hier kun je die naam altijd aanpassen voor Get Clear.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={() => { setShowAccount(false); void logout() }}
                type="button"
                style={{ background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 5, padding: '11px 16px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}
              >Uitloggen</button>
              <button
                onClick={() => void saveAccount()}
                type="button"
                disabled={isSavingAccount}
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: isSavingAccount ? 'wait' : 'pointer', letterSpacing: '.04em', textTransform: 'uppercase', opacity: isSavingAccount ? 0.75 : 1, width: '100%' }}
              >{isSavingAccount ? 'Bezig...' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={(e) => { backdropRef.current = e.target === e.currentTarget }}
          onClick={(e) => { if (e.target === e.currentTarget && backdropRef.current) { setShowCreate(false); setCreateName('') } }}
        >
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(var(--accent-rgb), 0.2)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,.42)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text)', marginBottom: 18 }}>
              Nieuwe Insight
            </div>
            <input
              autoFocus
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void createInsight(); else if (e.key === 'Escape') { setShowCreate(false); setCreateName('') } }}
              placeholder="Naam van je Insight"
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreate(false); setCreateName('') }}
                type="button"
                style={{ background: 'transparent', border: '1px solid var(--cancel-border)', borderRadius: 6, color: 'var(--cancel-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}
              >
                Annuleren
              </button>
              <button
                onClick={() => void createInsight()}
                type="button"
                disabled={isCreating || !createName.trim()}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'var(--accent-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: isCreating || !createName.trim() ? 'not-allowed' : 'pointer', opacity: isCreating || !createName.trim() ? 0.6 : 1 }}
              >
                {isCreating ? 'Bezig...' : 'Aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={(e) => { backdropRef.current = e.target === e.currentTarget }}
          onClick={(e) => { if (e.target === e.currentTarget && backdropRef.current) { setDeleteConfirmId(null); setDeleteError(null) } }}
        >
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(var(--accent-rgb), 0.2)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,.42)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text)', marginBottom: 10 }}>
              Insight verwijderen
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Weet je zeker dat je <strong style={{ color: 'var(--text)' }}>{households.find(h => h.id === deleteConfirmId)?.name}</strong> wil verwijderen? Dit kan niet ongedaan worden gemaakt.
            </div>
            {deleteError && (
              <div style={{ fontSize: 12, color: 'var(--del-fg)', background: 'var(--del-bg)', border: '1px solid var(--del-bd)', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setDeleteConfirmId(null); setDeleteError(null) }}
                type="button"
                style={{ background: 'transparent', border: '1px solid var(--cancel-border)', borderRadius: 6, color: 'var(--cancel-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}
              >
                Annuleren
              </button>
              <button
                onClick={() => void deleteInsight(deleteConfirmId)}
                type="button"
                disabled={isDeleting}
                style={{ background: 'var(--del-bg)', border: '1px solid var(--del-bd)', borderRadius: 6, color: 'var(--del-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: isDeleting ? 'wait' : 'pointer', opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? 'Bezig...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '36px 28px', maxWidth: 1320, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            lineHeight: 1.15,
            marginBottom: 16,
            color: 'var(--text)',
            marginLeft: 0,
            paddingLeft: 0,
          }}
        >
          {greeting}, {displayName.split(' ')[0]}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 48, textAlign: 'left', marginLeft: 0, paddingLeft: 0 }}>
          Kies een Insight of maak een nieuwe aan.
        </div>

        {menuOpenId && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setMenuOpenId(null)} />
        )}

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
            const isOwner = ownerOf.has(hh.id)
            return (
              <div key={hh.id} style={{ position: 'relative' }}>
                <div
                  onClick={() => { setMenuOpenId(null); openInsight(hh) }}
                  style={{
                    background: 'var(--s1)',
                    border: '2px solid rgba(var(--accent-rgb), 0.35)',
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
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(var(--accent-rgb), 0.95)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.transform = 'none'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 12, color: 'var(--text)' }}>
                    {hh.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Klik om te openen</div>
                </div>

                {isOwner && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === hh.id ? null : hh.id) }}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 28,
                      height: 28,
                      background: menuOpenId === hh.id ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                      fontSize: 16,
                      lineHeight: 1,
                      zIndex: 2,
                      transition: 'background .15s, color .15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb), 0.1)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.background = menuOpenId === hh.id ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent' }}
                    aria-label="Opties"
                  >
                    ···
                  </button>
                )}

                {menuOpenId === hh.id && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 42,
                      right: 10,
                      background: 'var(--s2)',
                      border: '1px solid var(--card-border)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                      zIndex: 10,
                      minWidth: 160,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setDeleteConfirmId(hh.id) }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--del-fg)',
                        fontSize: 13,
                        fontFamily: 'var(--font-body)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--del-bg)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                      Verwijder Insight
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={() => setShowCreate(true)}
            style={{
              border: '2px dashed rgba(var(--accent-rgb), 0.25)',
              background: 'var(--s1)',
              borderRadius: 10,
              minHeight: 170,
              height: 170,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--muted)',
              cursor: 'pointer',
              transition: 'border-color .2s, color .2s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              ;(e.currentTarget as HTMLElement).style.border = '2px dashed rgba(var(--accent-rgb), 0.95)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--muted)'
              ;(e.currentTarget as HTMLElement).style.transform = 'none'
              ;(e.currentTarget as HTMLElement).style.border = '2px dashed rgba(var(--accent-rgb), 0.25)'
            }}
          >
            <span style={{ fontSize: 32, lineHeight: 1, color: 'var(--accent)' }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Nieuwe Insight</span>
          </button>
        </div>
      </div>
    </div>
  )
}