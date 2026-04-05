'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useInsight } from '@/lib/insight-context'
import { useUser } from '@/lib/user-context'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Leden from './pages/Leden'

const NAV_ITEMS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inkomsten', label: 'Inkomsten' },
  { id: 'kosten', label: 'Kosten' },
  { id: 'vermogen', label: 'Vermogen' },
  { id: 'advies', label: 'Advies' },
]

function getNavPrefsKey(householdId?: string) {
  return `se_nav_${householdId || 'nohousehold'}`
}

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min

  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max

  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      default:
        h = (rn - gn) / d + 4
        break
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  return { h, s, v }
}

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const rr = Math.round((r + m) * 255)
  const gg = Math.round((g + m) * 255)
  const bb = Math.round((b + m) * 255)

  return `#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`
}

type AccountModalProps = {
  modalBg: CSSProperties
  modal: CSSProperties
  modalLabel: CSSProperties
  modalInp: CSSProperties
  modalSection: CSSProperties
  btnPrimary: CSSProperties
  avatarUrl?: string
  initials: string
  displayName: string
  accountName: string
  currentUserEmail?: string
  setAccountName: (value: string) => void
  saveAccount: () => void
  logout: () => void
  onClose: () => void
  onAvatarChange: (file: File) => Promise<void>
  isUploadingAvatar: boolean
}

function AccountModal({
  modalBg,
  modal,
  modalLabel,
  modalInp,
  modalSection,
  btnPrimary,
  avatarUrl,
  initials,
  displayName,
  accountName,
  currentUserEmail,
  setAccountName,
  saveAccount,
  logout,
  onClose,
  onAvatarChange,
  isUploadingAvatar,
}: AccountModalProps) {
  const [avatarHovered, setAvatarHovered] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef(false)

  return (
    <div
      style={modalBg}
      onMouseDown={(e) => { backdropRef.current = e.target === e.currentTarget }}
      onClick={(e) => { e.target === e.currentTarget && backdropRef.current && onClose() }}
    >
      <div style={modal}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--muted)',
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 20,
            fontFamily: 'var(--font-heading)',
          }}
        >
          Mijn account
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onAvatarChange(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            disabled={isUploadingAvatar}
            title="Profielfoto wijzigen"
            style={{
              position: 'relative',
              width: 68,
              height: 68,
              borderRadius: '50%',
              padding: 0,
              border: avatarHovered ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'var(--accent)',
              overflow: 'hidden',
              cursor: isUploadingAvatar ? 'wait' : 'pointer',
              flexShrink: 0,
              transition: 'border-color .15s',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                alt={displayName}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--accent-fg)',
                }}
              >
                {isUploadingAvatar ? '…' : initials}
              </div>
            )}
            {(avatarHovered || isUploadingAvatar) && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                }}
              >
                {isUploadingAvatar ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                )}
              </div>
            )}
          </button>
        </div>

        <label style={modalLabel}>Jouw naam</label>
        <input
          style={modalInp}
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
        />

        <label style={modalLabel}>E-mailadres</label>
        <input
          style={{ ...modalInp, opacity: 0.6 }}
          type="email"
          value={currentUserEmail || ''}
          disabled
        />

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
            Je Google-naam wordt als eerste gebruikt. Hier kun je die naam altijd aanpassen voor
            Samen Even.
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
  )
}

export default function Topbar({
  activePage,
  setActivePage,
}: {
  activePage: string
  setActivePage: (p: string) => void
}) {
  const {
    household,
    syncState,
    currentUser,
    members,
    data,
    saveData,
    myRole,
    isOwner,
    updateHouseholdName,
    updateMyProfile,
    isSingleUser,
  } = useInsight()
  const { updateProfile, saveDisplayName } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [showAccount, setShowAccount] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'instellingen' | 'leden'>('instellingen')
  const settingsBackdropRef = useRef(false)
  const [isBackHovered, setIsBackHovered] = useState(false)
  const [isSettingsHovered, setIsSettingsHovered] = useState(false)
  const [isThemeToggleHovered, setIsThemeToggleHovered] = useState(false)

  const [accountName, setAccountName] = useState('')
  const [insightName, setInsightName] = useState('')
  const [inviteCode, setInviteCode] = useState(household?.invite_code || '')

  const [themeColor, setThemeColor] = useState(data?.theme || '#6366F1')
  const [pickerHSV, setPickerHSV] = useState(() => hexToHsv(data?.theme || '#6366F1'))
  const [settingsStartTheme, setSettingsStartTheme] = useState(data?.theme || '#6366F1')

  const [copied, setCopied] = useState(false)

  const [hiddenNavItems, setHiddenNavItems] = useState<string[]>([])
  const [navOrder, setNavOrder] = useState<string[]>(NAV_ITEMS.map((item) => item.id))
  const [navPrefsLoaded, setNavPrefsLoaded] = useState(false)

  const [isDeletingInsight, setIsDeletingInsight] = useState(false)
  const [deleteInsightError, setDeleteInsightError] = useState('')
  const [confirmDeleteInsight, setConfirmDeleteInsight] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('se_theme')
    return stored ? stored === 'dark' : false
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('se_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const [rgbInput, setRgbInput] = useState(() => {
    const rgb = hexToRgb(data?.theme || '#6366F1')
    return {
      r: String(rgb.r),
      g: String(rgb.g),
      b: String(rgb.b),
    }
  })

  const svRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)

  const myMember = members.find((m) => m.user_id === currentUser?.id)
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
          : ''

  const inviteUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}?invite=${inviteCode || ''}`
  }, [inviteCode])

  const iconButton: CSSProperties = {
    width: 40,
    height: 40,
    background: isSettingsHovered ? 'rgba(99,102,241,0.08)' : 'transparent',
    border: isSettingsHovered ? '1px solid rgba(99,102,241,0.24)' : '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isSettingsHovered ? '#6366F1' : 'var(--muted)',
    flexShrink: 0,
    transition: 'background .15s, border-color .15s, color .15s, box-shadow .15s, transform .15s',
    boxShadow: isSettingsHovered ? '0 0 0 1px rgba(99,102,241,0.10)' : 'none',
    transform: isSettingsHovered ? 'translateY(-1px)' : 'none',
  }

  const modalBg: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.75)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  }

  const modal: CSSProperties = {
    background: 'var(--s1)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 28,
    width: '100%',
    maxWidth: 960,
    position: 'relative',
    maxHeight: '92vh',
    overflowY: 'auto',
    boxShadow: '0 24px 60px rgba(0,0,0,.42)',
  }

  const modalLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: 6,
    display: 'block',
  }

  const modalInp: CSSProperties = {
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

  const modalSection: CSSProperties = {
    background: 'var(--s2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '16px 16px',
    marginBottom: 14,
  }

  const btnPrimary: CSSProperties = {
    background: '#6366F1',
    color: '#FFFFFF',
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

  const btnGhost: CSSProperties = {
    background: 'transparent',
    color: 'var(--muted2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '9px 16px',
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = getNavPrefsKey(household?.id)
    const raw = window.localStorage.getItem(key)
    const defaultOrder = NAV_ITEMS.map((item) => item.id)

    if (!raw) {
      setHiddenNavItems([])
      setNavOrder(defaultOrder)
      setNavPrefsLoaded(true)
      return
    }

    try {
      const parsed = JSON.parse(raw)
      setHiddenNavItems(Array.isArray(parsed?.hidden) ? parsed.hidden : [])

      const savedOrder = Array.isArray(parsed?.order) ? parsed.order : []
      const cleanedSavedOrder = savedOrder.filter((id: string) => defaultOrder.includes(id))
      const missingIds = defaultOrder.filter((id) => !cleanedSavedOrder.includes(id))

      setNavOrder([...cleanedSavedOrder, ...missingIds])
    } catch {
      setHiddenNavItems([])
      setNavOrder(defaultOrder)
    }

    setNavPrefsLoaded(true)
  }, [household?.id])

  const prevIsSingleUser = useRef<boolean | null>(null)
  useEffect(() => {
    prevIsSingleUser.current = isSingleUser
  }, [isSingleUser])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!navPrefsLoaded) return

    const key = getNavPrefsKey(household?.id)

    window.localStorage.setItem(
      key,
      JSON.stringify({
        hidden: hiddenNavItems,
        order: navOrder,
      })
    )

    window.dispatchEvent(new CustomEvent('se-nav-prefs-changed'))
  }, [hiddenNavItems, navOrder, household?.id, navPrefsLoaded])

  useEffect(() => {
    if (!showSettings) return
    applyPreviewTheme(themeColor)
  }, [themeColor, showSettings])

  useEffect(() => {
    const open = showSettings || showAccount
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showSettings, showAccount])

  function openAccount() {
    setAccountName(displayName)
    setShowAccount(true)
  }

  function openSettings() {
    const currentTheme = data?.theme || '#6366F1'
    const currentRgb = hexToRgb(currentTheme)

    setInsightName(household?.name || '')
    setInviteCode(household?.invite_code || '')
    setThemeColor(currentTheme)
    setPickerHSV(hexToHsv(currentTheme))
    setSettingsStartTheme(currentTheme)
    setConfirmDeleteInsight(false)
    setDeleteInsightError('')
    setSettingsTab('instellingen')
    setRgbInput({
      r: String(currentRgb.r),
      g: String(currentRgb.g),
      b: String(currentRgb.b),
    })
    setShowSettings(true)
  }

  async function saveAvatar(file: File) {
    if (!currentUser?.id) return
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
        .upsert({ id: currentUser.id, avatar_url: dataUrl }, { onConflict: 'id' })

      updateMyProfile(accountName.trim() || displayName, dataUrl)
      updateProfile(accountName.trim() || displayName, dataUrl)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function saveAccount() {
    if (!accountName.trim() || !currentUser?.id) return

    const nextName = accountName.trim()

    await saveDisplayName(nextName)
    updateMyProfile(nextName)

    setShowAccount(false)
  }

  async function saveInsightSettings() {
    if (!isOwner) {
      setDeleteInsightError('Je hebt geen rechten om dit te doen.')
      return
    }
    if (!household?.id || !insightName.trim()) return

    const nextInsightName = insightName.trim()

    await supabase
      .from('households')
      .update({
        name: nextInsightName,
        invite_code: inviteCode,
      })
      .eq('id', household.id)

    updateHouseholdName(nextInsightName)

    saveData({
      ...data,
      theme: themeColor,
    })

    setShowSettings(false)
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

  async function handleDeleteInsight() {
    if (!isOwner) {
      setDeleteInsightError('Je hebt geen rechten om dit te doen.')
      return
    }
    if (!household?.id || isDeletingInsight) return

    setDeleteInsightError('')
    setIsDeletingInsight(true)

    const { error } = await supabase.from('households').delete().eq('id', household.id)

    if (error) {
      setDeleteInsightError('Verwijderen is niet gelukt. Probeer het opnieuw.')
      setIsDeletingInsight(false)
      return
    }

    router.push('/picker')
    router.refresh()
  }

  function applyPreviewTheme(color: string) {
    const effectiveColor = color.toLowerCase()
    const light = lightenColor(effectiveColor, 0.15)
    const rgb = hexToRgb(effectiveColor)

    document.documentElement.style.setProperty('--accent', effectiveColor)
    document.documentElement.style.setProperty('--accent2', light)
    document.documentElement.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)
    window.dispatchEvent(new CustomEvent('se-theme-preview', { detail: { color: effectiveColor } }))
  }

  function setThemeFromHex(nextColor: string) {
    const normalized = nextColor.toLowerCase()
    setThemeColor(normalized)
    setPickerHSV(hexToHsv(normalized))
  }

  function setThemeFromRgb(next: { r?: string; g?: string; b?: string }) {
    const current = hexToRgb(themeColor)
    const r = clamp(parseInt(next.r ?? String(current.r), 10) || 0, 0, 255)
    const g = clamp(parseInt(next.g ?? String(current.g), 10) || 0, 0, 255)
    const b = clamp(parseInt(next.b ?? String(current.b), 10) || 0, 0, 255)

    const hex =
      `#${r.toString(16).padStart(2, '0')}` +
      `${g.toString(16).padStart(2, '0')}` +
      `${b.toString(16).padStart(2, '0')}`

    setThemeFromHex(hex)
    setRgbInput({
      r: String(r),
      g: String(g),
      b: String(b),
    })
  }

  function commitRgbInput() {
    setThemeFromRgb(rgbInput)
  }

  function updateHue(clientX: number) {
    if (!hueRef.current) return

    const rect = hueRef.current.getBoundingClientRect()
    const x = clamp(clientX - rect.left, 0, rect.width)
    const h = Math.round((x / rect.width) * 360) % 360

    setPickerHSV((prev) => {
      const next = { ...prev, h }
      setThemeColor(hsvToHex(next.h, next.s, next.v))
      return next
    })
  }

  function updateSV(clientX: number, clientY: number) {
    if (!svRef.current) return

    const rect = svRef.current.getBoundingClientRect()
    const x = clamp(clientX - rect.left, 0, rect.width)
    const y = clamp(clientY - rect.top, 0, rect.height)

    const s = x / rect.width
    const v = 1 - y / rect.height

    setPickerHSV((prev) => {
      const next = { ...prev, s, v }
      setThemeColor(hsvToHex(next.h, next.s, next.v))
      return next
    })
  }

  function startHueDrag(clientX: number) {
    updateHue(clientX)

    const onMouseMove = (e: MouseEvent) => updateHue(e.clientX)
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      updateHue(e.touches[0].clientX)
    }

    const stop = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', stop)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', stop)
  }

  function startSVDrag(clientX: number, clientY: number) {
    updateSV(clientX, clientY)

    const onMouseMove = (e: MouseEvent) => updateSV(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      updateSV(e.touches[0].clientX, e.touches[0].clientY)
    }

    const stop = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', stop)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', stop)
  }

  function shareWhatsApp() {
    if (!inviteUrl) return
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteUrl)}`, '_blank')
  }

  function shareEmail() {
    if (!inviteUrl) return
    window.location.href = `mailto:?subject=Samen Even uitnodiging&body=${encodeURIComponent(inviteUrl)}`
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

  const rgb = hexToRgb(themeColor)

  return (
    <>
      <header
        style={{
          background: 'var(--s1)',
          borderBottom: '0.5px solid var(--border)',
          height: 56,
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
            onMouseEnter={() => setIsBackHovered(true)}
            onMouseLeave={() => setIsBackHovered(false)}
            aria-label="Terug naar overzicht"
            title="Terug naar overzicht"
            style={{
              width: 32,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              color: isBackHovered ? '#6366F1' : 'var(--muted)',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              padding: 0,
              marginLeft: 8,
              flexShrink: 0,
              transition: 'color .15s, transform .15s',
              transform: isBackHovered ? 'translateX(-1px) scale(1.08)' : 'none',
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
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 25,
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
                <polygon points="65,18 135,18 192,62 100,175 8,62" fill="#6366F1" />
                <polygon points="65,18 135,18 100,62" fill="#A5B4FC" />
              </svg>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.3px', lineHeight: 1 }}>
                <span style={{ color: '#6366F1' }}>Get&nbsp;</span><span style={{ color: 'var(--text)' }}>Clear</span>
              </span>
            </div>

          </div>
        </div>

        {household && (
          <span
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 16,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 300,
              lineHeight: 1.4,
              pointerEvents: 'none',
            }}
          >
            {household.name}
          </span>
        )}

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

          <button
            onClick={() => setIsDark((d) => !d)}
            onMouseEnter={() => setIsThemeToggleHovered(true)}
            onMouseLeave={() => setIsThemeToggleHovered(false)}
            style={{
              width: 40,
              height: 40,
              background: isThemeToggleHovered ? 'rgba(99,102,241,0.08)' : 'transparent',
              border: isThemeToggleHovered ? '1px solid rgba(99,102,241,0.24)' : '1px solid var(--border)',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isThemeToggleHovered ? '#6366F1' : 'var(--muted)',
              flexShrink: 0,
              transition: 'background .15s, border-color .15s, color .15s, box-shadow .15s, transform .15s',
              boxShadow: isThemeToggleHovered ? '0 0 0 1px rgba(99,102,241,0.10)' : 'none',
              transform: isThemeToggleHovered ? 'translateY(-1px)' : 'none',
            }}
            title={isDark ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
            aria-label={isDark ? 'Lichte modus' : 'Donkere modus'}
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
            onClick={openSettings}
            onMouseEnter={() => setIsSettingsHovered(true)}
            onMouseLeave={() => setIsSettingsHovered(false)}
            style={iconButton}
            title="Insight-instellingen"
            aria-label="Insight-instellingen"
          >
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
                referrerPolicy="no-referrer"
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
        <AccountModal
          modalBg={modalBg}
          modal={modal}
          modalLabel={modalLabel}
          modalInp={modalInp}
          modalSection={modalSection}
          btnPrimary={btnPrimary}
          avatarUrl={avatarUrl}
          initials={initials}
          displayName={displayName}
          accountName={accountName}
          currentUserEmail={currentUser?.email}
          setAccountName={setAccountName}
          saveAccount={saveAccount}
          logout={logout}
          onClose={() => setShowAccount(false)}
          onAvatarChange={saveAvatar}
          isUploadingAvatar={isUploadingAvatar}
        />
      )}

      {showSettings && (
        <div
          style={modalBg}
          onMouseDown={(e) => { settingsBackdropRef.current = e.target === e.currentTarget }}
          onClick={(e) => {
            if (e.target === e.currentTarget && settingsBackdropRef.current) {
              applyPreviewTheme(settingsStartTheme)
              setShowSettings(false)
            }
          }}
        >
          <div style={modal}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                {(['instellingen', 'leden'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '.04em',
                      textTransform: 'capitalize',
                      padding: '6px 14px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: settingsTab === tab ? 'none' : '1px solid var(--border)',
                      background: settingsTab === tab ? '#6366F1' : 'transparent',
                      color: settingsTab === tab ? '#FFFFFF' : 'var(--muted)',
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              {isOwner && settingsTab === 'instellingen' && (
                <button
                  onClick={saveInsightSettings}
                  style={{ ...btnPrimary, width: 'auto', padding: '7px 18px', fontSize: 13, flexShrink: 0 }}
                >
                  Opslaan
                </button>
              )}
              <button
                onClick={() => {
                  applyPreviewTheme(settingsStartTheme)
                  setShowSettings(false)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: 18,
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 4,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {settingsTab === 'leden' ? (
              <Leden />
            ) : isOwner ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch', marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...modalSection, flex: 1 }}>
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
                <input
                  style={modalInp}
                  type="text"
                  value={insightName}
                  onChange={(e) => setInsightName(e.target.value)}
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                />
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
                  border: '1px solid rgba(99,102,241,0.14)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 11,
                  color: '#6366F1',
                  letterSpacing: '.04em',
                }}
              >
                {inviteUrl}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
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
                </div>
                <div>
              <div style={modalSection}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                  Navigatie
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.6 }}>
                  Vink uit om een onderdeel in de navigatie te verbergen.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {navOrder
                    .map((id) => NAV_ITEMS.find((item) => item.id === id))
                    .filter(Boolean)
                    .map((item) => {
                      const checked = !hiddenNavItems.includes(item!.id)
                      return (
                        <label
                          key={item!.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,.02)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setHiddenNavItems((prev) => {
                                const next = prev.includes(item!.id)
                                  ? prev.filter((id) => id !== item!.id)
                                  : [...prev, item!.id]
                                return next
                              })
                            }}
                            style={{ width: 15, height: 15, accentColor: '#6366F1', flexShrink: 0 }}
                          />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: checked ? 'var(--text)' : 'var(--muted)' }}>
                            {item!.label}
                          </span>
                        </label>
                      )
                    })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
                  Dit zijn persoonlijke instellingen, niet gedeeld met anderen.
                </div>
              </div>
                </div>
              </div>
            ) : (
            <div style={{ ...modalSection, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                Navigatie
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.6 }}>
                Vink uit om een onderdeel in de navigatie te verbergen.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {navOrder
                  .map((id) => NAV_ITEMS.find((item) => item.id === id))
                  .filter(Boolean)
                  .map((item) => {
                    const checked = !hiddenNavItems.includes(item!.id)
                    return (
                      <label
                        key={item!.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'rgba(255,255,255,.02)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setHiddenNavItems((prev) => {
                              const next = prev.includes(item!.id)
                                ? prev.filter((id) => id !== item!.id)
                                : [...prev, item!.id]
                              return next
                            })
                          }}
                          style={{ width: 15, height: 15, accentColor: '#6366F1', flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: checked ? 'var(--text)' : 'var(--muted)' }}>
                          {item!.label}
                        </span>
                      </label>
                    )
                  })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
                Dit zijn persoonlijke instellingen, niet gedeeld met anderen.
              </div>
            </div>
            )}

            {settingsTab === 'instellingen' && (myRole === 'owner' || myRole === 'admin') && (
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
                  Beheer
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.6 }}>
                  Alleen de eigenaar kan deze Insight verwijderen.
                </div>

                {deleteInsightError && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--danger)',
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {deleteInsightError}
                  </div>
                )}

                {confirmDeleteInsight ? (
                  <div
                    style={{
                      background: 'rgba(200,60,60,.08)',
                      border: '1px solid rgba(200,60,60,.22)',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--danger)',
                        lineHeight: 1.6,
                        marginBottom: 10,
                      }}
                    >
                      Weet je zeker dat je deze Insight wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteInsight(false)}
                        disabled={isDeletingInsight}
                        style={{
                          background: 'transparent',
                          color: 'var(--muted2)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: 11,
                          fontFamily: 'var(--font-body)',
                          fontWeight: 600,
                          cursor: isDeletingInsight ? 'default' : 'pointer',
                          width: '100%',
                        }}
                      >
                        Annuleren
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteInsight}
                        disabled={isDeletingInsight}
                        style={{
                          background: 'rgba(200,60,60,.12)',
                          color: 'var(--danger)',
                          border: '1px solid rgba(200,60,60,.24)',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: 11,
                          fontFamily: 'var(--font-body)',
                          fontWeight: 700,
                          cursor: isDeletingInsight ? 'default' : 'pointer',
                          width: '100%',
                          opacity: isDeletingInsight ? 0.7 : 1,
                        }}
                      >
                        {isDeletingInsight ? 'Bezig...' : 'Ja, verwijderen'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    id="btn-delete-insight"
                    type="button"
                    onClick={() => setConfirmDeleteInsight(true)}
                    style={{
                      background: 'rgba(200,60,60,.1)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(200,60,60,.2)',
                      borderRadius: 5,
                      padding: '7px 12px',
                      fontSize: 11,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: '.15s',
                      width: '100%',
                    }}
                  >
                    Insight verwijderen
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}