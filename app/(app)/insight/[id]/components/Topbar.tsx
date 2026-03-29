'use client'

import { useEffect, useMemo, useState } from 'react'
import { useInsight } from '@/lib/insight-context'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const THEMES = {
  blue: '#00c2ff',
  aqua: '#00e5c8',
  lime: '#b8ff00',
  yellow: '#ffd600',
  champagne: '#e8c97a',
  mint: '#4dffc0',
  coral: '#ff6b8a',
  violet: '#a78bfa',
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 10)
}

function lightenColor(hex: string, factor = 0.15) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const lr = Math.min(255, Math.round(r + (255 - r) * factor))
  const lg = Math.min(255, Math.round(g + (255 - g) * factor))
  const lb = Math.min(255, Math.round(b + (255 - b) * factor))

  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

export default function Topbar({
  activePage,
  setActivePage,
}: {
  activePage: string
  setActivePage: (p: string) => void
}) {
  const { household, syncState, currentUser, members, data, saveData } = useInsight()
  const router = useRouter()
  const supabase = createClient()

  const [showAccount, setShowAccount] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [insightName, setInsightName] = useState('')
  const [inviteCode, setInviteCode] = useState(household?.invite_code || '')
  const [themeColor, setThemeColor] = useState(data?.theme || '#00c2ff')
  const [settingsStartTheme, setSettingsStartTheme] = useState(data?.theme || '#00c2ff')
  const [copied, setCopied] = useState(false)

  const myMember = members.find((m: any) => m.user_id === currentUser?.id)
  const displayName =
    myMember?.display_name || currentUser?.user_metadata?.full_name || 'Gebruiker'
  const avatarUrl = myMember?.avatar_url || currentUser?.user_metadata?.avatar_url
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const syncColor =
    syncState === 'saving'
      ? 'var(--warn)'
      : syncState === 'error'
        ? 'var(--danger)'
        : syncState === 'live'
          ? 'var(--accent)'
          : 'var(--ok)'

  const syncLabel =
    syncState === 'saving'
      ? 'Opslaan...'
      : syncState === 'error'
        ? 'Fout bij opslaan'
        : syncState === 'live'
          ? 'Live bijgewerkt'
          : 'Gesynchroniseerd'

  const inviteUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}?invite=${inviteCode || ''}`
  }, [inviteCode])

  function openAccount() {
    setAccountName(displayName)
    setShowAccount(true)
  }

  function openSettings() {
    const currentTheme = data?.theme || '#00c2ff'
    setInsightName(household?.name || '')
    setInviteCode(household?.invite_code || '')
    setThemeColor(currentTheme)
    setSettingsStartTheme(currentTheme)
    setShowSettings(true)
  }

  async function saveAccount() {
    if (!accountName.trim() || !currentUser?.id) return
    await supabase
      .from('profiles')
      .upsert({ id: currentUser.id, display_name: accountName.trim() }, { onConflict: 'id' })
    setShowAccount(false)
    router.refresh()
  }

  async function saveInsightSettings() {
    if (!household?.id || !insightName.trim()) return

    await supabase
      .from('households')
      .update({
        name: insightName.trim(),
        invite_code: inviteCode,
      })
      .eq('id', household.id)

    saveData({
      ...data,
      theme: themeColor,
    })

    const light = lightenColor(themeColor, 0.15)
    const rgb = hexToRgb(themeColor)
    document.documentElement.style.setProperty('--accent', themeColor)
    document.documentElement.style.setProperty('--accent2', light)
    document.documentElement.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)

    setShowSettings(false)
    router.refresh()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function copyInvite() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function regenInvite() {
    setInviteCode(randomInviteCode())
  }
    function applyPreviewTheme(color: string) {
    const light = lightenColor(color, 0.15)
    const rgb = hexToRgb(color)
    document.documentElement.style.setProperty('--accent', color)
    document.documentElement.style.setProperty('--accent2', light)
    document.documentElement.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)
    window.dispatchEvent(new CustomEvent('se-theme-preview', { detail: { color } }))
  }

  function shareWhatsApp() {
    if (!inviteUrl) return
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteUrl)}`, '_blank')
  }

  function shareEmail() {
    if (!inviteUrl) return
    window.location.href = `mailto:?subject=Samen Even uitnodiging&body=${encodeURIComponent(
      inviteUrl
    )}`
  }

  async function shareNative() {
    if (!inviteUrl) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Samen Even uitnodiging',
          text: 'Doe mee aan mijn Insight in Samen Even',
          url: inviteUrl,
        })
      } catch {}
      return
    }

    await copyInvite()
  }

  function saveN1(val: string) {
    saveData({ ...data, names: { ...data.names, user1: val } })
  }

  function saveN2(val: string) {
    saveData({ ...data, names: { ...data.names, user2: val } })
  }

  const modalBg: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.75)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  }

  const modal: React.CSSProperties = {
    background: 'var(--s1)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 28,
    width: '100%',
    maxWidth: 460,
    position: 'relative',
    maxHeight: '90vh',
    overflowY: 'auto',
  }

  const modalLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: 6,
    display: 'block',
  }

  const modalInp: React.CSSProperties = {
    width: '100%',
    background: 'var(--s2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    padding: '9px 11px',
    fontSize: 13,
    fontFamily: 'var(--font-body)',
    marginBottom: 14,
  }

  const modalSection: React.CSSProperties = {
    background: 'var(--s2)',
    borderRadius: 8,
    padding: '14px 16px',
    marginBottom: 14,
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--accent)',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: 6,
    padding: '9px 16px',
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  }

  const btnGhost: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--muted2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '9px 16px',
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
  }

  const iconButton: React.CSSProperties = {
    width: 40,
    height: 40,
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted)',
    flexShrink: 0,
    transition: '.15s',
  }

    useEffect(() => {
    if (!showSettings) return
    applyPreviewTheme(themeColor)
  }, [themeColor, showSettings])
  const rgb = hexToRgb(themeColor)

  return (
    <>
      <header
        style={{
          background: 'var(--s1)',
          borderBottom: '1px solid var(--border)',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px 0 12px',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 0,
            flex: 1,
          }}
        >
          <button
            onClick={() => router.push('/picker')}
            aria-label="Terug naar overzicht"
            title="Terug naar overzicht"
            style={{
              width: 32,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              color: 'var(--muted)',
              borderRadius: 10,
              border: '1px solid transparent',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <ArrowLeftIcon />
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minWidth: 0,
              flex: 1,
              height: 40,
            }}
          >
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: '-.3px',
                whiteSpace: 'nowrap',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                height: 40,
                fontFamily: 'var(--font-heading)',
              }}
            >
              <span className="brand-wordmark">
                <span className="brand-samen">Samen</span>&nbsp;
                <span className="brand-even">Even</span>
              </span>
            </div>

            {household && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 240,
                  lineHeight: 1,
                }}
              >
                {household.name}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingRight: 4,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: syncColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {syncLabel}
            </span>
          </div>

          <button onClick={openSettings} style={iconButton} title="Insight-instellingen" aria-label="Insight-instellingen">
            <GearIcon />
          </button>

          <button
            onClick={openAccount}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
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
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
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
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#0a0a0a',
                }}
              >
                {initials}
              </div>
            )}
          </button>
        </div>
      </header>

      {showAccount && (
        <div style={modalBg} onClick={(e) => e.target === e.currentTarget && setShowAccount(false)}>
          <div style={modal}>
            <button
              onClick={() => setShowAccount(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>

            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, fontFamily: 'var(--font-heading)' }}>
              Mijn account
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#0a0a0a',
                  overflow: 'hidden',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                ) : (
                  initials
                )}
              </div>
            </div>

            <label style={modalLabel}>Jouw naam</label>
            <input style={modalInp} type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} />

            <label style={modalLabel}>E-mailadres</label>
            <input style={{ ...modalInp, opacity: 0.6 }} type="email" value={currentUser?.email || ''} disabled />

            <div style={modalSection}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  marginBottom: 10,
                }}
              >
                Persoonlijk
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6 }}>
                Je Google-naam wordt als eerste gebruikt. Hier kun je die naam altijd aanpassen voor Samen Even.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={logout}
                style={{
                  background: 'rgba(200,60,60,.1)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(200,60,60,.2)',
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
              <button onClick={saveAccount} style={{ ...btnPrimary, width: '100%' }}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div
          style={modalBg}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              applyPreviewTheme(settingsStartTheme)
              setShowSettings(false)
            }
          }}
        >
          <div style={modal}>
            <button
              onClick={() => {
                applyPreviewTheme(settingsStartTheme)
                setShowSettings(false)
              }}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>

            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, fontFamily: 'var(--font-heading)' }}>
              Insight-instellingen
            </div>

            <div style={modalSection}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  marginBottom: 10,
                }}
              >
                Insight
              </div>
              <label style={modalLabel}>Naam van de Insight</label>
              <input style={modalInp} type="text" value={insightName} onChange={(e) => setInsightName(e.target.value)} />
            </div>

            <div style={modalSection}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  marginBottom: 10,
                }}
              >
                Namen
              </div>

              <label style={modalLabel}>Naam gebruiker 1</label>
              <input style={modalInp} type="text" defaultValue={data.names?.user1} onBlur={(e) => saveN1(e.target.value)} />

              <label style={modalLabel}>Naam gebruiker 2</label>
              <input style={{ ...modalInp, marginBottom: 0 }} type="text" defaultValue={data.names?.user2} onBlur={(e) => saveN2(e.target.value)} />
            </div>

            <div style={modalSection}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  marginBottom: 10,
                }}
              >
                Uitnodigingslink
              </div>

              <div
                style={{
                  width: '100%',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: 12,
                  background: 'var(--s3)',
                  borderRadius: 5,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: 'var(--accent)',
                  letterSpacing: '.04em',
                }}
              >
                {inviteUrl}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button onClick={copyInvite} style={btnGhost}>
                  {copied ? 'Gekopieerd!' : 'Kopieer'}
                </button>
                <button onClick={regenInvite} style={btnGhost}>
                  Nieuw
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button onClick={shareWhatsApp} style={btnGhost}>
                  WhatsApp
                </button>
                <button onClick={shareEmail} style={btnGhost}>
                  E-mail
                </button>
                <button onClick={shareNative} style={btnGhost}>
                  Delen…
                </button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                Stuur deze link om iemand toegang te geven.
              </div>
            </div>

            <div style={modalSection}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  marginBottom: 10,
                }}
              >
                Accentkleur van deze Insight
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {Object.values(THEMES).map((color) => (
                  <button
                    key={color}
                    onClick={() => setThemeColor(color)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: color,
                      border: themeColor === color ? '2px solid var(--text)' : '2px solid transparent',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={color}
                  />
                ))}
              </div>

              <div
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: `1px solid rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .24)`,
                  background: `linear-gradient(135deg, ${lightenColor(themeColor, 0.18)}, ${themeColor})`,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.05)',
                  marginBottom: 12,
                }}
              />

              <label style={modalLabel}>Kleurkiezer</label>
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value.toLowerCase())}
                style={{
                  ...modalInp,
                  height: 44,
                  padding: 4,
                  cursor: 'pointer',
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabel}>R</label>
                  <input style={{ ...modalInp, marginBottom: 0, textAlign: 'center' }} value={rgb.r} disabled />
                </div>
                <div>
                  <label style={modalLabel}>G</label>
                  <input style={{ ...modalInp, marginBottom: 0, textAlign: 'center' }} value={rgb.g} disabled />
                </div>
                <div>
                  <label style={modalLabel}>B</label>
                  <input style={{ ...modalInp, marginBottom: 0, textAlign: 'center' }} value={rgb.b} disabled />
                </div>
              </div>
            </div>

            <button onClick={saveInsightSettings} style={{ ...btnPrimary, width: '100%' }}>
              Opslaan
            </button>
          </div>
        </div>
      )}
    </>
  )
}