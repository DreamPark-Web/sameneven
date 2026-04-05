'use client'

import { useEffect, useRef, useState } from 'react'
import LoadingScreen from '@/components/LoadingScreen'
import ImageCropperModal, { CropInfo } from '@/components/ImageCropperModal'
import { useBreakpoint } from '@/lib/hooks'

interface CoverData { src: string; x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number }
interface Household { id: string; name: string; created_by: string; invite_code: string; cover_url: string | CoverData | null }
interface Balance { id: string; name: string; user_id: string; created_at: string; cover?: string | CoverData | null }
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'
import { useRouter } from 'next/navigation'

const BRAND_THEME = '#6366F1'
const CACHE_KEY = 'gc_picker_cache'
const CACHE_TTL = 5 * 60 * 1000

function readCache(): { households: Household[]; balances: Balance[] } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp < CACHE_TTL) return data
  } catch {}
  return null
}

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

export default function PickerPage() {
  const { currentUser: user, profile, userLoading, updateProfile, saveDisplayName } = useUser()
  const [households, setHouseholds] = useState<Household[]>(() => readCache()?.households ?? [])
  const [householdsReady, setHouseholdsReady] = useState(() => readCache() !== null)
  const [showAccount, setShowAccount] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('se_theme')
    return stored ? stored === 'dark' : false
  })
  const [isThemeHovered, setIsThemeHovered] = useState(false)
  const [ownerOf, setOwnerOf] = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [uploadingCoverId, setUploadingCoverId] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const coverTargetId = useRef<string | null>(null)
  const coverAspect = useRef(408 / 170)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropMode, setCropMode] = useState<'cover' | 'avatar' | 'balance' | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef(false)
  const [balances, setBalances] = useState<Balance[]>(() => readCache()?.balances ?? [])
  const [showCreateBalance, setShowCreateBalance] = useState(false)
  const [createBalanceName, setCreateBalanceName] = useState('')
  const [isCreatingBalance, setIsCreatingBalance] = useState(false)
  const [menuOpenBalanceId, setMenuOpenBalanceId] = useState<string | null>(null)
  const [deleteBalanceId, setDeleteBalanceId] = useState<string | null>(null)
  const [isDeletingBalance, setIsDeletingBalance] = useState(false)
  const [deleteBalanceError, setDeleteBalanceError] = useState<string | null>(null)
  const [uploadingBalanceCoverId, setUploadingBalanceCoverId] = useState<string | null>(null)
  const balanceCoverInputRef = useRef<HTMLInputElement>(null)
  const balanceCoverTargetId = useRef<string | null>(null)
  const balanceCoverAspect = useRef(408 / 170)
  const supabase = createClient()
  const router = useRouter()
  const { isMobile } = useBreakpoint()
  const [mobileTab, setMobileTab] = useState<'insights' | 'balances'>('insights')
  const [navPressed, setNavPressed] = useState<string | null>(null)
  const pickerContentRef = useRef<HTMLDivElement>(null)
  const pickerTouchStartX = useRef(0)
  const pickerTouchStartY = useRef(0)
  const pickerIsHorizontal = useRef<boolean | null>(null)
  const pickerMobileTabRef = useRef<'insights' | 'balances'>('insights')

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
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
    const userId = user.id

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
        .eq('user_id', userId)
        .maybeSingle()

      if (!existing) {
        await supabase.from('household_members').insert({
          household_id: household.id,
          user_id: userId,
          role: 'editor',
        })
      }

      router.replace(`/insight/${household.id}`)
    }

    processInvite()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const userId = user.id
    async function loadHouseholds() {
      const { data: memberships } = await supabase
        .from('household_members')
        .select('*, households(*)')
        .eq('user_id', userId)

      type MembershipRow = { role: string; household_id: string; households: Household }
      const baseHouseholds: Household[] =
        (memberships as MembershipRow[] | null)?.map((m) => m.households).filter(Boolean) || []

      const ids = baseHouseholds.map((h) => h.id)
      const { data: hhData } = ids.length
        ? await supabase.from('household_data').select('household_id, data').in('household_id', ids)
        : { data: [] }

      const coverMap: Record<string, string | CoverData> = {}
      for (const row of (hhData || [])) {
        if (row.data?.cover) coverMap[row.household_id] = row.data.cover
      }

      const freshHouseholds = baseHouseholds.map((h) => ({ ...h, cover_url: coverMap[h.id] || null }))
      setHouseholds(prev => JSON.stringify(prev) === JSON.stringify(freshHouseholds) ? prev : freshHouseholds)
      setOwnerOf(new Set((memberships as MembershipRow[] | null)?.filter((m) => m.role === 'owner').map((m) => m.household_id) || []))
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
          data: { theme: '#6366F1' },
        })

      window.localStorage.setItem(
        `se_nav_${hh.id}`,
        JSON.stringify({ order: ['dashboard', 'inkomsten', 'kosten', 'vermogen', 'tips'], hidden: [] })
      )
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

  function openInsight(hh: { id: string }) {
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

  function openAvatarCrop(file: File) {
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setCropMode('avatar')
  }

  async function saveAvatarBlob(blob: Blob) {
    if (!user?.id) return
    setIsUploadingAvatar(true)
    closeCropper()
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: base64 }, { onConflict: 'id' })
      updateProfile(displayName, base64)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  function cardGradient(name: string) {
    let h1 = 0, h2 = 0
    for (let i = 0; i < name.length; i++) {
      h1 = (h1 * 31 + name.charCodeAt(i)) & 0xffffffff
      h2 = (h2 * 37 + name.charCodeAt(name.length - 1 - i)) & 0xffffffff
    }
    const hue1 = Math.abs(h1) % 360
    const hue2 = (hue1 + 40 + Math.abs(h2) % 80) % 360
    return `linear-gradient(135deg, hsl(${hue1},35%,16%) 0%, hsl(${hue2},28%,24%) 100%)`
  }

  function openCoverCrop(id: string, file: File) {
    coverTargetId.current = id
    const cardEl = document.querySelector(`[data-card-id="${id}"]`) as HTMLElement | null
    if (cardEl) coverAspect.current = (cardEl.offsetWidth - 4) / 166
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setCropMode('cover')
    setMenuOpenId(null)
  }

  function closeCropper() {
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setCropMode(null)
  }

  function openCoverEdit(id: string, cover: string | CoverData) {
    coverTargetId.current = id
    const cardEl = document.querySelector(`[data-card-id="${id}"]`) as HTMLElement | null
    if (cardEl) coverAspect.current = (cardEl.offsetWidth - 4) / 166
    setCropSrc(typeof cover === 'object' ? cover.src : cover)
    setCropMode('cover')
    setMenuOpenId(null)
  }

  async function saveCoverBlob(blob: Blob, cropInfo?: CropInfo) {
    const id = coverTargetId.current
    if (!id) return
    setUploadingCoverId(id)
    closeCropper()
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const coverValue: string | CoverData = cropInfo
        ? { src: base64, x: cropInfo.x, y: cropInfo.y, width: cropInfo.width, height: cropInfo.height, imageWidth: cropInfo.imageWidth, imageHeight: cropInfo.imageHeight }
        : base64
      const { data: existing } = await supabase.from('household_data').select('data').eq('household_id', id).single()
      const merged = { ...(existing?.data || {}), cover: coverValue }
      await supabase.from('household_data').update({ data: merged }).eq('household_id', id)
      setHouseholds(prev => prev.map(h => h.id === id ? { ...h, cover_url: coverValue } : h))
    } finally {
      setUploadingCoverId(null)
    }
  }

  async function removeCover(id: string) {
    setMenuOpenId(null)
    const { data: existing } = await supabase.from('household_data').select('data').eq('household_id', id).single()
    const merged = { ...(existing?.data || {}) }
    delete merged.cover
    await supabase.from('household_data').update({ data: merged }).eq('household_id', id)
    setHouseholds(prev => prev.map(h => h.id === id ? { ...h, cover_url: null } : h))
  }

  useEffect(() => {
    if (!user?.id) return
    const userId = user.id
    async function loadBalances() {
      const { data } = await supabase
        .from('balances')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      const fresh = data || []
      setBalances(prev => JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh)
    }
    loadBalances()
  }, [user?.id])

  async function createBalance() {
    if (!createBalanceName.trim() || !user?.id) return
    setIsCreatingBalance(true)
    const { data: bal } = await supabase
      .from('balances')
      .insert({ name: createBalanceName.trim(), user_id: user.id })
      .select()
      .single()
    if (bal) {
      setBalances(prev => [...prev, bal])
      setShowCreateBalance(false)
      setCreateBalanceName('')
      router.push(`/balance/${bal.id}`)
    }
    setIsCreatingBalance(false)
  }

  async function deleteBalance(id: string) {
    setIsDeletingBalance(true)
    setDeleteBalanceError(null)
    const { error } = await supabase.from('balances').delete().eq('id', id)
    if (error) {
      setDeleteBalanceError('Verwijderen is niet gelukt. Probeer het opnieuw.')
      setIsDeletingBalance(false)
      return
    }
    setBalances(prev => prev.filter(b => b.id !== id))
    setDeleteBalanceId(null)
    setIsDeletingBalance(false)
  }

  function openBalanceCoverCrop(id: string, file: File) {
    balanceCoverTargetId.current = id
    const cardEl = document.querySelector(`[data-balance-id="${id}"]`) as HTMLElement | null
    if (cardEl) balanceCoverAspect.current = (cardEl.offsetWidth - 4) / 166
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setCropMode('balance')
    setMenuOpenBalanceId(null)
  }

  function openBalanceCoverEdit(id: string, cover: string | CoverData) {
    balanceCoverTargetId.current = id
    const cardEl = document.querySelector(`[data-balance-id="${id}"]`) as HTMLElement | null
    if (cardEl) balanceCoverAspect.current = (cardEl.offsetWidth - 4) / 166
    setCropSrc(typeof cover === 'object' ? cover.src : cover)
    setCropMode('balance')
    setMenuOpenBalanceId(null)
  }

  async function saveBalanceCoverBlob(blob: Blob, cropInfo?: CropInfo) {
    const id = balanceCoverTargetId.current
    if (!id) return
    setUploadingBalanceCoverId(id)
    closeCropper()
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const coverValue: string | CoverData = cropInfo
        ? { src: base64, x: cropInfo.x, y: cropInfo.y, width: cropInfo.width, height: cropInfo.height, imageWidth: cropInfo.imageWidth, imageHeight: cropInfo.imageHeight }
        : base64
      await supabase.from('balances').update({ cover: coverValue }).eq('id', id)
      setBalances(prev => prev.map(b => b.id === id ? { ...b, cover: coverValue } : b))
    } finally {
      setUploadingBalanceCoverId(null)
    }
  }

  async function removeBalanceCover(id: string) {
    setMenuOpenBalanceId(null)
    await supabase.from('balances').update({ cover: null }).eq('id', id)
    setBalances(prev => prev.map(b => b.id === id ? { ...b, cover: null } : b))
  }

  useEffect(() => {
    pickerMobileTabRef.current = mobileTab
  }, [mobileTab])

  useEffect(() => {
    if (!householdsReady) return
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: { households, balances }, timestamp: Date.now() }))
    } catch {}
  }, [households, balances, householdsReady])

  useEffect(() => {
    households.forEach(h => {
      const cover = h.cover_url
      const src = cover && typeof cover === 'object' ? (cover as CoverData).src : cover as string | undefined
      if (src) { const img = new Image(); img.src = src }
    })
    balances.forEach(b => {
      const cover = b.cover
      const src = cover && typeof cover === 'object' ? (cover as CoverData).src : cover as string | undefined
      if (src) { const img = new Image(); img.src = src }
    })
  }, [households, balances])

  useEffect(() => {
    if (!isMobile) return
    const el = pickerContentRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      pickerTouchStartX.current = e.touches[0].clientX
      pickerTouchStartY.current = e.touches[0].clientY
      pickerIsHorizontal.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - pickerTouchStartX.current
      const dy = e.touches[0].clientY - pickerTouchStartY.current
      if (pickerIsHorizontal.current === null) {
        if (Math.abs(dx) > Math.abs(dy) + 5) pickerIsHorizontal.current = true
        else if (Math.abs(dy) > Math.abs(dx) + 5) pickerIsHorizontal.current = false
        else return
      }
      if (!pickerIsHorizontal.current) return
      e.preventDefault()
      const tab = pickerMobileTabRef.current
      const offset = (tab === 'insights' && dx > 0) || (tab === 'balances' && dx < 0) ? dx * 0.25 : dx
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!pickerIsHorizontal.current) return
      const dx = e.changedTouches[0].clientX - pickerTouchStartX.current
      const threshold = window.innerWidth * 0.25
      const tab = pickerMobileTabRef.current
      const shouldSwitch = (dx < -threshold && tab === 'insights') || (dx > threshold && tab === 'balances')
      const dir = tab === 'insights' ? -1 : 1
      if (shouldSwitch) {
        el.style.transition = 'transform .28s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        el.style.transform = `translateX(${dir * window.innerWidth}px)`
        el.addEventListener('transitionend', () => {
          setMobileTab(tab === 'insights' ? 'balances' : 'insights')
          el.style.transition = 'none'
          el.style.transform = 'translateX(0)'
        }, { once: true })
      } else {
        el.style.transition = 'transform .28s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        el.style.transform = 'translateX(0)'
      }
      pickerIsHorizontal.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobile, setMobileTab])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  if (userLoading) return <LoadingScreen />
  const showSkeleton = !householdsReady

  return (
    <>
    <style>{`@keyframes gc-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
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
        <polygon points="65,18 135,18 192,62 100,175 8,62" fill="#6366F1" />
        <polygon points="65,18 135,18 100,62" fill="#A5B4FC" />
      </svg>

      <header
        style={{
          background: 'var(--s1)',
          borderBottom: '0.5px solid var(--border)',
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
          <svg width="32" height="32" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
            <polygon points="65,18 135,18 192,62 100,175 8,62" fill="#6366F1" />
            <polygon points="65,18 135,18 100,62" fill="#A5B4FC" />
          </svg>

          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-.3px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#6366F1' }}>Get&nbsp;</span>
            <span style={{ color: 'var(--text)' }}>Clear</span>
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
              border: '1px solid var(--border)',
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
              border: '1px solid var(--border)',
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
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) openAvatarCrop(f); e.target.value = '' }} />
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

      <div ref={pickerContentRef} style={{ padding: isMobile ? '24px 16px' : '36px 28px', maxWidth: 1320, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1, paddingBottom: isMobile ? 76 : undefined, willChange: 'transform' }}>
        <div
          style={{
            fontSize: isMobile ? 28 : 44,
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
          Kies een Insight of Balance, of maak een nieuwe aan.
        </div>

        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f && coverTargetId.current) openCoverCrop(coverTargetId.current, f)
            e.target.value = ''
          }}
        />
        <input
          ref={balanceCoverInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f && balanceCoverTargetId.current) openBalanceCoverCrop(balanceCoverTargetId.current, f)
            e.target.value = ''
          }}
        />

        {menuOpenId && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setMenuOpenId(null)} />
        )}
        {menuOpenBalanceId && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setMenuOpenBalanceId(null)} />
        )}

        {!isMobile && <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6366F1', marginBottom: 14 }}>Insights</div>}

        {(!isMobile || mobileTab === 'insights') && <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: isMobile ? 12 : 20,
            alignItems: 'stretch',
          }}
        >
          {showSkeleton && households.length === 0 && [0,1,2].map(i => (
            <div key={i} style={{ borderRadius: 10, background: 'var(--s2)', minHeight: isMobile ? undefined : 170, height: isMobile ? undefined : 170, aspectRatio: isMobile ? '408/170' : undefined, animation: 'gc-pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
          ))}
          {households.map((hh) => {
            const isOwner = ownerOf.has(hh.id)
            const cover = hh.cover_url as string | CoverData | null
            const hasCover = !!cover
            const isUploading = uploadingCoverId === hh.id
            const coverSrc = cover && typeof cover === 'object' ? cover.src : cover as string | undefined
            const coverBgSize = cover && typeof cover === 'object'
              ? `${cover.imageWidth / cover.width * 100}% ${cover.imageHeight / cover.height * 100}%`
              : '100% 100%'
            const coverBgPos = cover && typeof cover === 'object'
              ? `${cover.width >= cover.imageWidth ? 0 : cover.x / (cover.imageWidth - cover.width) * 100}% ${cover.height >= cover.imageHeight ? 0 : cover.y / (cover.imageHeight - cover.height) * 100}%`
              : 'center'
            return (
              <div key={hh.id} data-card-id={hh.id} style={{ position: 'relative' }}>
                <div
                  onClick={() => { setMenuOpenId(null); openInsight(hh) }}
                  style={{
                    background: hasCover ? undefined : cardGradient(hh.name),
                    backgroundImage: hasCover ? `url(${coverSrc})` : undefined,
                    backgroundSize: hasCover ? coverBgSize : undefined,
                    backgroundPosition: hasCover ? coverBgPos : undefined,
                    border: 'none',
                    borderRadius: 10,
                    padding: 22,
                    cursor: 'pointer',
                    minHeight: isMobile ? undefined : 170,
                    height: isMobile ? undefined : 170,
                    aspectRatio: isMobile ? '408/170' : undefined,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    textAlign: 'left',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    transform: 'translateY(0)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
                  }}
                >
                  {hasCover && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))', borderRadius: 8, pointerEvents: 'none' }} />
                  )}
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
                        color: hasCover ? '#fff' : 'var(--text)',
                        fontSize: 16,
                        lineHeight: 1,
                        zIndex: 3,
                        transition: 'background .15s, color .15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb), 0.2)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = hasCover ? '#fff' : 'var(--text)'; (e.currentTarget as HTMLElement).style.background = menuOpenId === hh.id ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent' }}
                      aria-label="Opties"
                    >
                      ···
                    </button>
                  )}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4, color: hasCover ? '#fff' : 'var(--text)' }}>
                      {isUploading ? 'Uploaden...' : hh.name}
                    </div>
                    <div style={{ fontSize: 11, color: hasCover ? 'rgba(255,255,255,0.65)' : 'var(--muted)' }}>Klik om te openen</div>
                  </div>
                </div>

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
                      minWidth: 180,
                      overflow: 'hidden',
                    }}
                  >
                    {hasCover && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openCoverEdit(hh.id, cover!) }}
                        style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Afbeelding bewerken
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); coverTargetId.current = hh.id; coverInputRef.current?.click() }}
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      {hasCover ? 'Achtergrond wijzigen' : 'Achtergrond toevoegen'}
                    </button>
                    {hasCover && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void removeCover(hh.id) }}
                        style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Achtergrond verwijderen
                      </button>
                    )}
                    <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setDeleteConfirmId(hh.id) }}
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--del-fg)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--del-bg)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
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
              border: '2px dashed rgba(99,102,241,0.35)',
              background: 'var(--s1)',
              borderRadius: 10,
              minHeight: isMobile ? undefined : 170,
              height: isMobile ? undefined : 170,
              aspectRatio: isMobile ? '408/170' : undefined,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'border-color .2s, background .2s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'
              ;(e.currentTarget as HTMLElement).style.border = '2px dashed rgba(99,102,241,0.8)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--s1)'
              ;(e.currentTarget as HTMLElement).style.border = '2px dashed rgba(99,102,241,0.35)'
            }}
          >
            <span style={{ fontSize: 32, lineHeight: 1, color: '#6366F1' }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6366F1' }}>Nieuwe Insight</span>
          </button>
        </div>}

        {!isMobile && <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6366F1', marginTop: 52, marginBottom: 14 }}>Balances</div>}

        {(!isMobile || mobileTab === 'balances') && <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: isMobile ? 12 : 20,
            alignItems: 'stretch',
          }}
        >
          {showSkeleton && balances.length === 0 && [0,1].map(i => (
            <div key={i} style={{ borderRadius: 10, background: 'var(--s2)', minHeight: isMobile ? undefined : 170, height: isMobile ? undefined : 170, aspectRatio: isMobile ? '408/170' : undefined, animation: 'gc-pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
          ))}
          {balances.map((bal) => {
            const cover = bal.cover as string | CoverData | null
            const hasCover = !!cover
            const isUploading = uploadingBalanceCoverId === bal.id
            const coverSrc = cover && typeof cover === 'object' ? cover.src : cover as string | undefined
            const coverBgSize = cover && typeof cover === 'object'
              ? `${cover.imageWidth / cover.width * 100}% ${cover.imageHeight / cover.height * 100}%`
              : '100% 100%'
            const coverBgPos = cover && typeof cover === 'object'
              ? `${cover.width >= cover.imageWidth ? 0 : cover.x / (cover.imageWidth - cover.width) * 100}% ${cover.height >= cover.imageHeight ? 0 : cover.y / (cover.imageHeight - cover.height) * 100}%`
              : 'center'
            return (
              <div key={bal.id} data-balance-id={bal.id} style={{ position: 'relative' }}>
                <div
                  onClick={() => router.push(`/balance/${bal.id}`)}
                  style={{
                    background: hasCover ? undefined : cardGradient(bal.name),
                    backgroundImage: hasCover ? `url(${coverSrc})` : undefined,
                    backgroundSize: hasCover ? coverBgSize : undefined,
                    backgroundPosition: hasCover ? coverBgPos : undefined,
                    border: 'none',
                    borderRadius: 10,
                    padding: 22,
                    cursor: 'pointer',
                    minHeight: isMobile ? undefined : 170,
                    height: isMobile ? undefined : 170,
                    aspectRatio: isMobile ? '408/170' : undefined,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    textAlign: 'left',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    transform: 'translateY(0)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
                  }}
                >
                  {hasCover && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))', borderRadius: 8, pointerEvents: 'none' }} />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenBalanceId(menuOpenBalanceId === bal.id ? null : bal.id) }}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 28,
                      height: 28,
                      background: menuOpenBalanceId === bal.id ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: hasCover ? '#fff' : 'var(--muted)',
                      fontSize: 16,
                      lineHeight: 1,
                      zIndex: 3,
                      transition: 'background .15s, color .15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb), 0.2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = hasCover ? '#fff' : 'var(--text)'; (e.currentTarget as HTMLElement).style.background = menuOpenBalanceId === bal.id ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent' }}
                    aria-label="Opties"
                  >
                    ···
                  </button>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4, color: hasCover ? '#fff' : 'var(--text)' }}>
                      {isUploading ? 'Uploaden...' : bal.name}
                    </div>
                    <div style={{ fontSize: 11, color: hasCover ? 'rgba(255,255,255,0.65)' : 'var(--muted)' }}>Klik om te openen</div>
                  </div>
                </div>

                {menuOpenBalanceId === bal.id && (
                  <div style={{ position: 'absolute', top: 42, right: 10, background: 'var(--s2)', border: '1px solid var(--card-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.35)', zIndex: 10, minWidth: 180, overflow: 'hidden' }}>
                    {hasCover && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openBalanceCoverEdit(bal.id, cover!) }}
                        style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Afbeelding bewerken
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); balanceCoverTargetId.current = bal.id; balanceCoverInputRef.current?.click() }}
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      {hasCover ? 'Achtergrond wijzigen' : 'Achtergrond toevoegen'}
                    </button>
                    {hasCover && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void removeBalanceCover(bal.id) }}
                        style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Achtergrond verwijderen
                      </button>
                    )}
                    <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenBalanceId(null); setDeleteBalanceId(bal.id) }}
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--del-fg)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--del-bg)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                      Verwijder Balance
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={() => setShowCreateBalance(true)}
            style={{
              border: '2px dashed rgba(99,102,241,0.35)', background: 'var(--s1)', borderRadius: 10,
              minHeight: isMobile ? undefined : 170, height: isMobile ? undefined : 170,
              aspectRatio: isMobile ? '408/170' : undefined,
              width: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer', transition: 'border-color .2s, background .2s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'
              ;(e.currentTarget as HTMLElement).style.border = '2px dashed rgba(99,102,241,0.8)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--s1)'
              ;(e.currentTarget as HTMLElement).style.border = '2px dashed rgba(99,102,241,0.35)'
            }}
          >
            <span style={{ fontSize: 32, lineHeight: 1, color: '#6366F1' }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6366F1' }}>Nieuwe Balance</span>
          </button>
        </div>}
      </div>

      {isMobile && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: 'var(--s1)',
          borderTop: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 200,
        }}>
          <button
            onClick={() => setMobileTab('insights')}
            onPointerDown={() => setNavPressed('insights')}
            onPointerUp={() => setNavPressed(null)}
            onPointerLeave={() => setNavPressed(null)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              border: 'none',
              background: 'transparent',
              color: mobileTab === 'insights' ? '#6366F1' : 'var(--muted)',
              cursor: 'pointer',
              padding: '4px 0',
              WebkitTapHighlightColor: 'transparent',
              transform: navPressed === 'insights' ? 'scale(0.88)' : 'scale(1)',
              transition: 'transform .1s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <polygon points="65,18 135,18 192,62 100,175 8,62" fill="currentColor" opacity="0.85" />
              <polygon points="65,18 135,18 100,62" fill={mobileTab === 'insights' ? '#A5B4FC' : 'rgba(255,255,255,0.3)'} />
            </svg>
            <span style={{ fontSize: 10, fontWeight: mobileTab === 'insights' ? 700 : 500, fontFamily: 'var(--font-body)', lineHeight: 1 }}>Insights</span>
          </button>
          <button
            onClick={() => setMobileTab('balances')}
            onPointerDown={() => setNavPressed('balances')}
            onPointerUp={() => setNavPressed(null)}
            onPointerLeave={() => setNavPressed(null)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              border: 'none',
              background: 'transparent',
              color: mobileTab === 'balances' ? '#6366F1' : 'var(--muted)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              padding: '4px 0',
              transform: navPressed === 'balances' ? 'scale(0.88)' : 'scale(1)',
              transition: 'transform .1s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: mobileTab === 'balances' ? 700 : 500, fontFamily: 'var(--font-body)', lineHeight: 1 }}>Balances</span>
          </button>
        </nav>
      )}

      {showCreateBalance && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={(e) => { backdropRef.current = e.target === e.currentTarget }}
          onClick={(e) => { if (e.target === e.currentTarget && backdropRef.current) { setShowCreateBalance(false); setCreateBalanceName('') } }}
        >
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(var(--accent-rgb), 0.2)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,.42)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text)', marginBottom: 18 }}>Nieuwe Balance</div>
            <input
              autoFocus
              value={createBalanceName}
              onChange={e => setCreateBalanceName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void createBalance(); else if (e.key === 'Escape') { setShowCreateBalance(false); setCreateBalanceName('') } }}
              placeholder="Naam van je Balance"
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
              autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true"
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreateBalance(false); setCreateBalanceName('') }} type="button" style={{ background: 'transparent', border: '1px solid var(--cancel-border)', borderRadius: 6, color: 'var(--cancel-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}>Annuleren</button>
              <button onClick={() => void createBalance()} type="button" disabled={isCreatingBalance || !createBalanceName.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'var(--accent-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: isCreatingBalance || !createBalanceName.trim() ? 'not-allowed' : 'pointer', opacity: isCreatingBalance || !createBalanceName.trim() ? 0.6 : 1 }}>{isCreatingBalance ? 'Bezig...' : 'Aanmaken'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteBalanceId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={(e) => { backdropRef.current = e.target === e.currentTarget }}
          onClick={(e) => { if (e.target === e.currentTarget && backdropRef.current) { setDeleteBalanceId(null); setDeleteBalanceError(null) } }}
        >
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(var(--accent-rgb), 0.2)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,.42)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text)', marginBottom: 10 }}>Balance verwijderen</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Weet je zeker dat je <strong style={{ color: 'var(--text)' }}>{balances.find(b => b.id === deleteBalanceId)?.name}</strong> wil verwijderen? Dit kan niet ongedaan worden gemaakt.
            </div>
            {deleteBalanceError && (
              <div style={{ fontSize: 12, color: 'var(--del-fg)', background: 'var(--del-bg)', border: '1px solid var(--del-bd)', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>{deleteBalanceError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteBalanceId(null); setDeleteBalanceError(null) }} type="button" style={{ background: 'transparent', border: '1px solid var(--cancel-border)', borderRadius: 6, color: 'var(--cancel-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}>Annuleren</button>
              <button onClick={() => void deleteBalance(deleteBalanceId)} type="button" disabled={isDeletingBalance} style={{ background: 'var(--del-bg)', border: '1px solid var(--del-bd)', borderRadius: 6, color: 'var(--del-fg)', padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: isDeletingBalance ? 'wait' : 'pointer', opacity: isDeletingBalance ? 0.7 : 1 }}>{isDeletingBalance ? 'Bezig...' : 'Verwijderen'}</button>
            </div>
          </div>
        </div>
      )}

      {cropSrc && cropMode === 'cover' && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={coverAspect.current}
          cropShape="rect"
          softCrop
          onSave={saveCoverBlob}
          onCancel={closeCropper}
        />
      )}
      {cropSrc && cropMode === 'avatar' && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          onSave={saveAvatarBlob}
          onCancel={closeCropper}
        />
      )}
      {cropSrc && cropMode === 'balance' && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={balanceCoverAspect.current}
          cropShape="rect"
          softCrop
          onSave={saveBalanceCoverBlob}
          onCancel={closeCropper}
        />
      )}
    </div>
    </>
  )
}