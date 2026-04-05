'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'
import { fmt } from '@/lib/format'
import ImageCropperModal from '@/components/ImageCropperModal'
import { useBreakpoint } from '@/lib/hooks'
import { getMemberColor } from '@/lib/memberColors'

// --- Types ---

interface Balance {
  id: string
  name: string
  user_id: string
  created_at: string
  cover?: string | { src: string; x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number } | null
}

interface BalanceMember {
  id: string
  balance_id: string
  display_name: string
  user_id: string | null
  created_at: string
}

interface BalanceEntry {
  id: string
  balance_id: string
  paid_by: string
  amount: number
  description: string
  receipt_url: string | null
  via_scan: boolean
  date: string
  created_at: string
}

interface BalanceClosing {
  id: string
  balance_id: string
  settlements: Settlement[]
  total_amount: number
  entries_snapshot: BalanceEntry[] | null
  closed_at: string
}

interface BalanceApproval {
  id: string
  balance_id: string
  member_id: string
  approved_at: string
}

interface Settlement {
  from: string
  to: string
  amount: number
}

// --- Helpers ---

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatDayLabel(dateStr: string): string {
  const today = todayStr()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Vandaag'
  if (dateStr === yesterday) return 'Gisteren'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function memberColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return `hsl(${Math.abs(h) % 360},45%,38%)`
}

function calculateSettlements(members: BalanceMember[], entries: BalanceEntry[]): Settlement[] {
  if (members.length < 2 || entries.length === 0) return []

  const paid: Record<string, number> = {}
  for (const e of entries) paid[e.paid_by] = (paid[e.paid_by] || 0) + Number(e.amount)

  const total = Object.values(paid).reduce((a, b) => a + b, 0)
  const share = total / members.length

  const net = members.map(m => ({ id: m.id, name: m.display_name, bal: (paid[m.id] || 0) - share }))
  const results: Settlement[] = []

  for (let i = 0; i < 100; i++) {
    net.sort((a, b) => a.bal - b.bal)
    if (Math.abs(net[0].bal) < 0.005) break
    const debtor = net[0]
    const creditor = net[net.length - 1]
    const amount = Math.min(-debtor.bal, creditor.bal)
    results.push({ from: debtor.name, to: creditor.name, amount: Math.round(amount * 100) / 100 })
    debtor.bal += amount
    creditor.bal -= amount
  }

  return results
}

// --- Style constants ---

const cancelStyle: CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em',
  textTransform: 'uppercase', padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
  background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)',
}

function primaryStyle(disabled: boolean): CSSProperties {
  return {
    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em',
    textTransform: 'uppercase', padding: '8px 16px', borderRadius: 6, border: 'none',
    background: 'var(--accent)', color: 'var(--accent-fg)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}

// --- Modal wrapper ---

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        {children}
      </div>
    </div>
  )
}

// --- Member pills for payer selection ---

function PayerPicker({ members, value, onChange }: { members: BalanceMember[]; value: string; onChange: (id: string) => void }) {
  if (members.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Voeg eerst een lid toe.</div>
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {members.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${value === m.id ? 'var(--accent)' : 'var(--border)'}`, background: value === m.id ? 'rgba(var(--accent-rgb),0.12)' : 'transparent', color: value === m.id ? 'var(--accent)' : 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {m.display_name}
        </button>
      ))}
    </div>
  )
}

// --- Main Page ---

export default function BalancePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { currentUser: user, userLoading, profile, updateProfile, saveDisplayName } = useUser()
  const supabase = createClient()

  const { isMobile } = useBreakpoint()
  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'Gebruiker'
  const ownerAvatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url as string | undefined

  const [balance, setBalance] = useState<Balance | null>(null)
  const [members, setMembers] = useState<BalanceMember[]>([])
  const [memberProfileNames, setMemberProfileNames] = useState<Record<string, string>>({})
  const [entries, setEntries] = useState<BalanceEntry[]>([])
  const [closings, setClosings] = useState<BalanceClosing[]>([])
  const [approvals, setApprovals] = useState<BalanceApproval[]>([])
  const [loading, setLoading] = useState(true)

  // FAB
  const [fabOpen, setFabOpen] = useState(false)

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Manual entry modal
  const [showManual, setShowManual] = useState(false)
  const [manualAmount, setManualAmount] = useState('')
  const [manualDesc, setManualDesc] = useState('')
  const [manualPaidBy, setManualPaidBy] = useState('')
  const [manualDate, setManualDate] = useState(todayStr)
  const [manualReceipt, setManualReceipt] = useState<string | null>(null)
  const [savingEntry, setSavingEntry] = useState(false)

  // Scan flow
  const [showLiveCamera, setShowLiveCamera] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanConfirm, setShowScanConfirm] = useState(false)
  const [scanAmount, setScanAmount] = useState('')
  const [scanDesc, setScanDesc] = useState('')
  const [scanPaidBy, setScanPaidBy] = useState('')
  const [scanReceipt, setScanReceipt] = useState<string | null>(null)
  const [savingScan, setSavingScan] = useState(false)
  const [scanStatus, setScanStatus] = useState<'scanning' | 'detected' | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Delete entry
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)

  // Close flow
  const [showClose, setShowClose] = useState(false)
  const [closingInProgress, setClosingInProgress] = useState(false)
  const [closeResult, setCloseResult] = useState<Settlement[] | null>(null)
  const autoFinalizeRef = useRef(false)

  // History
  const [showHistory, setShowHistory] = useState(false)
  const [selectedClosing, setSelectedClosing] = useState<BalanceClosing | null>(null)
  const [activeView, setActiveView] = useState<'overzicht' | 'geschiedenis'>('overzicht')

  // Receipt preview
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null)

  const scanLibraryRef = useRef<HTMLInputElement>(null)

  // Swipe navigation (balance-to-balance, desktop/tablet only)
  const [allBalances, setAllBalances] = useState<{ id: string; name: string }[]>([])
  const [allBalanceIds, setAllBalanceIds] = useState<string[]>([])
  const allBalanceIdsRef = useRef<string[]>([])
  const swipeEnabledRef = useRef(true)
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const swipeLocked = useRef<'h' | 'v' | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const prevGhostRef = useRef<HTMLDivElement>(null)
  const nextGhostRef = useRef<HTMLDivElement>(null)

  // View swipe (mobile: overzicht ↔ geschiedenis) — zelfde aanpak als Insight
  const [swipeEl, setSwipeEl] = useState<HTMLDivElement | null>(null)
  const swipeRef = useCallback((el: HTMLDivElement | null) => { setSwipeEl(el) }, [])
  const sliderRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isHorizontal = useRef<boolean | null>(null)
  const activeIndexRef = useRef(0)

  // Account modal
  const [showAccount, setShowAccount] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef(false)

  // --- Load data ---

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }

    async function load() {
      const [
        { data: bal },
        { data: mems },
        { data: ents },
        { data: cls },
        { data: apps },
      ] = await Promise.all([
        supabase.from('balances').select('*').eq('id', id).single(),
        supabase.from('balance_members').select('*').eq('balance_id', id).order('created_at'),
        supabase.from('balance_entries').select('*').eq('balance_id', id).order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('balance_closings').select('*').eq('balance_id', id).order('closed_at', { ascending: false }),
        supabase.from('balance_approvals').select('*').eq('balance_id', id),
      ])

      if (!bal) { router.push('/picker'); return }

      let loadedMembers = (mems as BalanceMember[]) || []

      // Deduplicate: keep only the first record per user_id
      const seenUserIds = new Set<string>()
      loadedMembers = loadedMembers.filter(m => {
        if (!m.user_id) return true
        if (seenUserIds.has(m.user_id)) return false
        seenUserIds.add(m.user_id)
        return true
      })

      // Delete any extra duplicate rows from DB (user_id already in set = duplicate)
      const allRaw = (mems as BalanceMember[]) || []
      const keptIds = new Set(loadedMembers.map(m => m.id))
      const duplicates = allRaw.filter(m => m.user_id && !keptIds.has(m.id))
      if (duplicates.length > 0) {
        await supabase.from('balance_members').delete().in('id', duplicates.map(m => m.id))
      }

      const ownerInList = loadedMembers.some(m => m.user_id === user!.id)
      if (!ownerInList) {
        const ownerName = user!.user_metadata?.full_name || user!.email?.split('@')[0] || 'Eigenaar'
        const { data: inserted } = await supabase
          .from('balance_members')
          .insert({ balance_id: id, display_name: ownerName, user_id: user!.id })
          .select()
          .single()
        if (inserted) loadedMembers = [inserted as BalanceMember, ...loadedMembers]
      }

      setBalance(bal as Balance)
      setMembers(loadedMembers)
      setEntries(((ents as BalanceEntry[]) || []).map(e => ({ ...e, amount: Number(e.amount) })))
      setClosings((cls as BalanceClosing[]) || [])
      setApprovals((apps as BalanceApproval[]) || [])
      setLoading(false)

      const linkedUserIds = loadedMembers.filter(m => m.user_id).map(m => m.user_id as string)
      if (linkedUserIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', linkedUserIds)
        if (profs) {
          const nameMap: Record<string, string> = {}
          for (const m of loadedMembers) {
            if (m.user_id) {
              const prof = (profs as { id: string; display_name: string | null }[]).find(p => p.id === m.user_id)
              if (prof?.display_name) nameMap[m.id] = prof.display_name
            }
          }
          setMemberProfileNames(nameMap)
        }
      }

      // Load sibling balances for swipe navigation
      const { data: siblingBalances } = await supabase
        .from('balances')
        .select('id, name')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      const siblings = (siblingBalances || []) as { id: string; name: string }[]
      setAllBalances(siblings)
      setAllBalanceIds(siblings.map(b => b.id))
    }

    load()
  }, [id, user, userLoading])

  // --- Swipe enter animation ---
  useEffect(() => {
    const dir = sessionStorage.getItem('se_swipe_dir')
    if (!dir || !pageRef.current) return
    sessionStorage.removeItem('se_swipe_dir')
    const el = pageRef.current
    const startX = dir === 'left' ? window.innerWidth : -window.innerWidth
    el.style.transform = `translateX(${startX}px)`
    el.style.opacity = '0'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.28s cubic-bezier(.25,.8,.25,1), opacity 0.28s ease'
        el.style.transform = 'translateX(0)'
        el.style.opacity = '1'
        setTimeout(() => { if (el) el.style.transition = '' }, 320)
      })
    })
  }, [])

  // --- Sync swipe refs ---
  useEffect(() => { allBalanceIdsRef.current = allBalanceIds }, [allBalanceIds])
  useEffect(() => {
    swipeEnabledRef.current = !showManual && !showScanConfirm && !showClose && !showHistory && !selectedClosing && !showAddMember && !showAccount && !showLiveCamera
  }, [showManual, showScanConfirm, showClose, showHistory, selectedClosing, showAddMember, showAccount, showLiveCamera])

  // Prefetch adjacent pages whenever siblings load
  useEffect(() => {
    const ids = allBalanceIds
    const idx = ids.indexOf(id)
    if (idx > 0) router.prefetch(`/balance/${ids[idx - 1]}`)
    if (idx < ids.length - 1) router.prefetch(`/balance/${ids[idx + 1]}`)
  }, [allBalanceIds, id, router])

  // --- View slider sync (exact Insight pattern) ---
  const activeIndex = activeView === 'geschiedenis' ? 1 : 0

  useEffect(() => {
    activeIndexRef.current = activeIndex
    if (!sliderRef.current) return
    sliderRef.current.style.transition = 'transform .38s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    sliderRef.current.style.transform = `translateX(${-activeIndex * 50}%)`
  }, [activeIndex])

  // --- View swipe (exact Insight pattern) ---
  useEffect(() => {
    if (!isMobile) return
    const el = swipeEl
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      isHorizontal.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - touchStartY.current
      if (isHorizontal.current === null) {
        if (Math.abs(dx) > Math.abs(dy) + 5) isHorizontal.current = true
        else if (Math.abs(dy) > Math.abs(dx) + 5) isHorizontal.current = false
        else return
      }
      if (!isHorizontal.current) return
      e.preventDefault()
      const idx = activeIndexRef.current
      const n = 2
      const offset = (idx === 0 && dx > 0) || (idx === n - 1 && dx < 0) ? dx * 0.25 : dx
      if (sliderRef.current) {
        sliderRef.current.style.transition = 'none'
        sliderRef.current.style.transform = `translateX(calc(${-idx * 50}% + ${offset}px))`
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!isHorizontal.current) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const threshold = window.innerWidth * 0.25
      const idx = activeIndexRef.current
      const n = 2
      const newIdx = dx < -threshold && idx < n - 1 ? idx + 1 : dx > threshold && idx > 0 ? idx - 1 : idx
      if (sliderRef.current) {
        sliderRef.current.style.transition = 'transform .38s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        sliderRef.current.style.transform = `translateX(${-newIdx * 50}%)`
      }
      if (newIdx !== idx) {
        setActiveView(newIdx === 0 ? 'overzicht' : 'geschiedenis')
        if (newIdx === 1) setSelectedClosing(null)
      }
      isHorizontal.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobile, setActiveView, swipeEl])

  // --- Native swipe listeners (balance-to-balance, desktop/tablet only) ---
  useEffect(() => {
    if (isMobile) return
    const node = pageRef.current
    if (!node) return
    const n = node

    const W = window.innerWidth

    function resetGhosts() {
      if (prevGhostRef.current) { prevGhostRef.current.style.transition = ''; prevGhostRef.current.style.transform = 'translateX(-200vw)' }
      if (nextGhostRef.current) { nextGhostRef.current.style.transition = ''; nextGhostRef.current.style.transform = 'translateX(200vw)' }
    }

    function onTouchStart(e: TouchEvent) {
      if (!swipeEnabledRef.current) return
      swipeStartX.current = e.touches[0].clientX
      swipeStartY.current = e.touches[0].clientY
      swipeLocked.current = null
    }

    function onTouchMove(e: TouchEvent) {
      if (swipeStartX.current === null || swipeStartY.current === null) return
      const dx = e.touches[0].clientX - swipeStartX.current
      const dy = e.touches[0].clientY - swipeStartY.current

      if (!swipeLocked.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      if (swipeLocked.current !== 'h') return

      const ids = allBalanceIdsRef.current
      const idx = ids.indexOf(id)
      const goingLeft = dx < 0 && idx < ids.length - 1
      const goingRight = dx > 0 && idx > 0
      if (!goingLeft && !goingRight) return

      e.preventDefault()
      n.style.transform = `translateX(${dx}px)`

      if (goingLeft && nextGhostRef.current) {
        nextGhostRef.current.style.transform = `translateX(calc(100vw + ${dx}px))`
      }
      if (goingRight && prevGhostRef.current) {
        prevGhostRef.current.style.transform = `translateX(calc(-100vw + ${dx}px))`
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (swipeStartX.current === null || swipeStartY.current === null || swipeLocked.current !== 'h') {
        swipeStartX.current = null
        swipeStartY.current = null
        swipeLocked.current = null
        return
      }
      const dx = e.changedTouches[0].clientX - swipeStartX.current
      swipeStartX.current = null
      swipeStartY.current = null
      swipeLocked.current = null

      const ids = allBalanceIdsRef.current
      const idx = ids.indexOf(id)
      const threshold = W * 0.3
      const canNavigate = Math.abs(dx) >= threshold &&
        ((dx < 0 && idx < ids.length - 1) || (dx > 0 && idx > 0))

      const trans = 'transform 0.28s cubic-bezier(.25,.8,.25,1)'

      if (canNavigate) {
        const goLeft = dx < 0
        n.style.transition = trans
        n.style.transform = `translateX(${goLeft ? -W : W}px)`
        if (goLeft && nextGhostRef.current) {
          nextGhostRef.current.style.transition = trans
          nextGhostRef.current.style.transform = 'translateX(0)'
        }
        if (!goLeft && prevGhostRef.current) {
          prevGhostRef.current.style.transition = trans
          prevGhostRef.current.style.transform = 'translateX(0)'
        }
        const nextId = goLeft ? ids[idx + 1] : ids[idx - 1]
        sessionStorage.setItem('se_swipe_dir', goLeft ? 'left' : 'right')
        setTimeout(() => router.push(`/balance/${nextId}`), 260)
      } else {
        n.style.transition = trans
        n.style.transform = 'translateX(0)'
        if (nextGhostRef.current) { nextGhostRef.current.style.transition = trans; nextGhostRef.current.style.transform = 'translateX(200vw)' }
        if (prevGhostRef.current) { prevGhostRef.current.style.transition = trans; prevGhostRef.current.style.transform = 'translateX(-200vw)' }
        setTimeout(() => { n.style.transition = ''; resetGhosts() }, 300)
      }
    }

    resetGhosts()
    n.addEventListener('touchstart', onTouchStart, { passive: true })
    n.addEventListener('touchmove', onTouchMove, { passive: false })
    n.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      n.removeEventListener('touchstart', onTouchStart)
      n.removeEventListener('touchmove', onTouchMove)
      n.removeEventListener('touchend', onTouchEnd)
    }
  }, [id, router, loading, isMobile])

  // --- Realtime ---

  useEffect(() => {
    if (!user || loading) return

    const channel = supabase
      .channel(`balance-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'balance_entries', filter: `balance_id=eq.${id}` }, payload => {
        if (payload.eventType === 'INSERT') {
          const e = { ...(payload.new as BalanceEntry), amount: Number((payload.new as BalanceEntry).amount) }
          setEntries(prev => [e, ...prev.filter(x => x.id !== e.id)])
        } else if (payload.eventType === 'DELETE') {
          setEntries(prev => prev.filter(e => e.id !== (payload.old as BalanceEntry).id))
        } else if (payload.eventType === 'UPDATE') {
          const u = { ...(payload.new as BalanceEntry), amount: Number((payload.new as BalanceEntry).amount) }
          setEntries(prev => prev.map(e => e.id === u.id ? u : e))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'balance_approvals', filter: `balance_id=eq.${id}` }, payload => {
        if (payload.eventType === 'INSERT') {
          setApprovals(prev => {
            const next = [...prev.filter(a => a.id !== (payload.new as BalanceApproval).id), payload.new as BalanceApproval]
            setMembers(currentMembers => {
              setEntries(currentEntries => {
                const allDone = currentMembers.length > 0 && currentMembers.every(m => next.some(a => a.member_id === m.id))
                if (allDone && currentEntries.length > 0) finalizeClose(currentMembers, currentEntries)
                return currentEntries
              })
              return currentMembers
            })
            return next
          })
        } else if (payload.eventType === 'DELETE') {
          setApprovals(prev => prev.filter(a => a.id !== (payload.old as BalanceApproval).id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'balance_members', filter: `balance_id=eq.${id}` }, payload => {
        if (payload.eventType === 'INSERT') setMembers(prev => {
          const m = payload.new as BalanceMember
          if (prev.some(x => x.id === m.id)) return prev
          if (m.user_id && prev.some(x => x.user_id === m.user_id)) return prev
          return [...prev, m]
        })
        else if (payload.eventType === 'DELETE') setMembers(prev => prev.filter(m => m.id !== (payload.old as BalanceMember).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, user, loading])

  // --- Handlers ---

  async function addMember() {
    if (!newMemberName.trim()) return
    setAddingMember(true)
    const { data } = await supabase.from('balance_members').insert({ balance_id: id, display_name: newMemberName.trim() }).select().single()
    if (data) {
      setMembers(prev => [...prev, data as BalanceMember])
      setNewMemberName('')
      setShowAddMember(false)
    }
    setAddingMember(false)
  }

  async function saveManualEntry() {
    const amount = parseFloat(manualAmount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0 || !manualPaidBy) return
    setSavingEntry(true)
    const { data } = await supabase.from('balance_entries').insert({
      balance_id: id,
      paid_by: manualPaidBy,
      amount,
      description: manualDesc.trim(),
      receipt_url: manualReceipt,
      via_scan: false,
      created_by: user!.id,
      date: manualDate,
    }).select().single()
    if (data) {
      setEntries(prev => [{ ...(data as BalanceEntry), amount: Number((data as BalanceEntry).amount) }, ...prev])
      setShowManual(false)
      setManualAmount('')
      setManualDesc('')
      setManualReceipt(null)
      setManualDate(todayStr())
    }
    setSavingEntry(false)
  }

  async function saveScanEntry() {
    const amount = parseFloat(scanAmount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0 || !scanPaidBy) return
    setSavingScan(true)
    const { data } = await supabase.from('balance_entries').insert({
      balance_id: id,
      paid_by: scanPaidBy,
      amount,
      description: scanDesc.trim(),
      receipt_url: scanReceipt,
      via_scan: true,
      created_by: user!.id,
      date: todayStr(),
    }).select().single()
    if (data) {
      setEntries(prev => [{ ...(data as BalanceEntry), amount: Number((data as BalanceEntry).amount) }, ...prev])
      setShowScanConfirm(false)
      setScanAmount('')
      setScanDesc('')
      setScanReceipt(null)
    }
    setSavingScan(false)
  }

  async function deleteEntry(entryId: string) {
    await supabase.from('balance_entries').delete().eq('id', entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
    setDeleteEntryId(null)
  }

  function stopCamera() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null }
    if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null }
    setShowLiveCamera(false)
    setScanStatus(null)
  }

  async function openLiveCamera() {
    setFabOpen(false)
    setScanError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      cameraStreamRef.current = stream
      setShowLiveCamera(true)
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      }, 100)
      setScanStatus('scanning')
      scanIntervalRef.current = setInterval(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d')!.drawImage(video, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.82)
        try {
          const res = await fetch('/api/balance/scan', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
          })
          if (!res.ok) return
          const json = await res.json() as { amount?: number }
          if (json.amount && json.amount > 0) {
            setScanStatus('detected')
            stopCamera()
            setScanAmount(String(json.amount).replace('.', ','))
            setScanReceipt(base64)
            setScanDesc('')
            setScanPaidBy(members[0]?.id || '')
            setShowScanConfirm(true)
          }
        } catch { /* keep trying */ }
      }, 1500)
    } catch {
      setScanError('Camera niet toegankelijk. Controleer je browserinstellingen.')
    }
  }

  const handleScanFile = useCallback(async (file: File) => {
    setScanError(null)
    setFabOpen(false)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    try {
      const res = await fetch('/api/balance/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      })
      const json = await res.json() as { amount?: number; error?: string }
      if (!res.ok) { setScanError(json.error || 'Scan mislukt'); return }
      setScanAmount(String(json.amount!).replace('.', ','))
      setScanReceipt(base64)
      setScanDesc('')
      setScanPaidBy(members[0]?.id || '')
      setShowScanConfirm(true)
    } catch {
      setScanError('Scan mislukt, probeer opnieuw')
    }
  }, [members])

  async function toggleApproval(memberId: string) {
    const existing = approvals.find(a => a.member_id === memberId)
    if (existing) {
      await supabase.from('balance_approvals').delete().eq('id', existing.id)
      setApprovals(prev => prev.filter(a => a.id !== existing.id))
    } else {
      const { data } = await supabase.from('balance_approvals').insert({ balance_id: id, member_id: memberId }).select().single()
      if (data) setApprovals(prev => [...prev, data as BalanceApproval])
    }
  }

  async function finalizeClose(currentMembers: BalanceMember[], currentEntries: BalanceEntry[]) {
    if (autoFinalizeRef.current) return
    autoFinalizeRef.current = true
    setClosingInProgress(true)

    const settlements = calculateSettlements(currentMembers, currentEntries)
    const total = currentEntries.reduce((s, e) => s + Number(e.amount), 0)

    await supabase.from('balance_closings').insert({
      balance_id: id,
      settlements,
      total_amount: total,
      entries_snapshot: currentEntries,
    })

    await Promise.all([
      supabase.from('balance_entries').delete().eq('balance_id', id),
      supabase.from('balance_approvals').delete().eq('balance_id', id),
    ])

    setEntries([])
    setApprovals([])
    const { data: allClosings } = await supabase.from('balance_closings').select('*').eq('balance_id', id).order('closed_at', { ascending: false })
    setClosings((allClosings as BalanceClosing[]) || [])
    setCloseResult(settlements)
    setClosingInProgress(false)
    autoFinalizeRef.current = false
  }

  // --- Account modal handlers ---

  function openAccount() {
    setAccountName(displayName)
    setShowAccount(true)
  }

  async function saveAccount() {
    if (!accountName.trim() || !user?.id) return
    setIsSavingAccount(true)
    try {
      await saveDisplayName(accountName.trim())
      setShowAccount(false)
    } finally {
      setIsSavingAccount(false)
    }
  }

  function openAvatarCrop(file: File) {
    const url = URL.createObjectURL(file)
    setCropSrc(url)
  }

  function closeCropper() {
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
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

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // --- Derived state ---

  const today = todayStr()
  const todayTotal = entries.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0)
  const totalAll = entries.reduce((s, e) => s + Number(e.amount), 0)
  const sharePerMember = members.length > 0 ? totalAll / members.length : 0

  const paidByMember: Record<string, number> = {}
  for (const e of entries) paidByMember[e.paid_by] = (paidByMember[e.paid_by] || 0) + Number(e.amount)

  const entriesByDay = entries.reduce<Record<string, BalanceEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})
  const sortedDays = Object.keys(entriesByDay).sort((a, b) => b.localeCompare(a))

  const memberById = Object.fromEntries(members.map(m => [m.id, m]))

  // Sorted by created_at → stable color index per member
  const sortedMembers = [...members].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const memberColorIndex = Object.fromEntries(sortedMembers.map((m, i) => [m.id, i]))

  // --- Derived: adjacent balance names for ghost pages ---
  const currentIdx = allBalances.findIndex(b => b.id === id)
  const prevBalance = currentIdx > 0 ? allBalances[currentIdx - 1] : null
  const nextBalance = currentIdx >= 0 && currentIdx < allBalances.length - 1 ? allBalances[currentIdx + 1] : null

  // --- Render ---

  return (
    <>
      {!isMobile && prevBalance && (
        <div ref={prevGhostRef} style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none', transform: 'translateX(-200vw)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>{prevBalance.name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>← vorige balans</div>
        </div>
      )}
      {!isMobile && nextBalance && (
        <div ref={nextGhostRef} style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none', transform: 'translateX(200vw)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>{nextBalance.name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>volgende balans →</div>
        </div>
      )}
    <div ref={pageRef} style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-body)', color: 'var(--text)', position: 'relative', zIndex: 49 }}>
    {loading ? (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
        Laden...
      </div>
    ) : (<>

      {/* ── Header ── */}
      {(() => {
        const cover = balance?.cover
        const coverSrc = cover && typeof cover === 'object' ? cover.src : cover as string | undefined
        const coverBgSize = cover && typeof cover === 'object'
          ? `${cover.imageWidth / cover.width * 100}% ${cover.imageHeight / cover.height * 100}%`
          : 'cover'
        const coverBgPos = cover && typeof cover === 'object'
          ? `${cover.width >= cover.imageWidth ? 0 : cover.x / (cover.imageWidth - cover.width) * 100}% ${cover.height >= cover.imageHeight ? 0 : cover.y / (cover.imageHeight - cover.height) * 100}%`
          : 'center'

        if (isMobile && coverSrc) {
          return (
            <>
              <div style={{ position: 'relative', height: 200, backgroundImage: `url(${coverSrc})`, backgroundSize: coverBgSize, backgroundPosition: coverBgPos, flexShrink: 0 }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.5))' }} />
                <button
                  onClick={() => router.push('/picker')}
                  style={{ position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', color: '#fff', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  onClick={() => setShowClose(true)}
                  style={{ position: 'absolute', top: 12, right: 12, fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#fff', cursor: 'pointer', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                >
                  Balans opmaken
                </button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, background: 'rgba(0,0,0,0.18)', padding: '6px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{balance?.name}</div>
                </div>
              </div>
            </>
          )
        }

        return (
          <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => router.push('/picker')}
              style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{balance?.name}</div>
            <button
              onClick={() => setShowClose(true)}
              style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 6, border: '1px solid var(--accent)', background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, transition: 'background .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.18)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.08)' }}
            >
              Balans opmaken
            </button>
          </div>
        )
      })()}

      {/* ── Content ── */}
      {(() => {
        const overzichtContent = (
          <>
            {/* Members */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 8px' }}>
                {[...members].sort((a, b) => (b.user_id === user?.id ? 1 : 0) - (a.user_id === user?.id ? 1 : 0)).map(m => {
                  const isOwner = m.user_id === user?.id
                  const avatarSrc = isOwner ? ownerAvatarUrl : undefined
                  const colorIdx = memberColorIndex[m.id] ?? 0
                  const mc = getMemberColor(colorIdx)
                  const avatarEl = (
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: isOwner ? '2px solid #6366F1' : '2px solid transparent', overflow: 'hidden', flexShrink: 0, background: mc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#fff' }}>
                      {avatarSrc
                        ? <img src={avatarSrc} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={m.display_name} />
                        : initials(m.display_name)
                      }
                    </div>
                  )
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      {isOwner
                        ? <button onClick={openAccount} style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', borderRadius: '50%', transition: 'opacity .15s' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>{avatarEl}</button>
                        : avatarEl
                      }
                      <div style={{ fontSize: 12, color: 'var(--muted2)', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 400 }}>{isOwner ? displayName : m.display_name}</div>
                    </div>
                  )
                })}
                {members.length < 8 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => { const text = encodeURIComponent(`Doe mee aan onze balance "${balance?.name}": ${window.location.href}`); window.open(`https://wa.me/?text=${text}`, '_blank') }}
                      style={{ width: 56, height: 56, borderRadius: '50%', border: '2px dashed rgba(var(--accent-rgb),0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 24, lineHeight: 1, background: 'transparent', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(var(--accent-rgb),0.8)'; (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.07)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(var(--accent-rgb),0.4)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      onMouseDown={e => (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.14)'}
                      onMouseUp={e => (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.07)'}
                      title="Uitnodigen via WhatsApp"
                    >+</button>
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Uitnodigen</div>
                  </div>
                )}
              </div>
            </div>
            {/* Day total widget */}
            {todayTotal > 0 && (
              <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Vandaag uitgegeven</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{fmt(todayTotal)}</div>
              </div>
            )}
            {/* Summary per person */}
            {members.length > 0 && totalAll > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(136px,1fr))', gap: 10 }}>
                  {members.map(m => {
                    const paid = paidByMember[m.id] || 0
                    const net = paid - sharePerMember
                    const mc = getMemberColor(memberColorIndex[m.id] ?? 0)
                    return (
                      <div key={m.id} style={{ background: mc.light, border: `1px solid ${mc.border}`, borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: mc.bg }}>{memberProfileNames[m.id] || (m.user_id === user?.id ? displayName : m.display_name)}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{fmt(paid)}</div>
                        <div style={{ fontSize: 11, color: net >= -0.005 ? 'var(--ok)' : 'var(--danger)' }}>{net >= -0.005 ? `+${fmt(net)} terug` : `${fmt(Math.abs(net))} schuld`}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {/* Entries grouped by day */}
            {entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--muted)', fontSize: 13 }}>Nog geen uitgaven. Tik + om te beginnen.</div>
            ) : sortedDays.map(day => {
              const dayEntries = entriesByDay[day]
              const dayTotal = dayEntries.reduce((s, e) => s + Number(e.amount), 0)
              const isToday = day === today
              return (
                <div key={day} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div style={{ fontSize: isToday ? 17 : 13, fontWeight: isToday ? 700 : 600, color: isToday ? 'var(--text)' : 'var(--muted)' }}>{formatDayLabel(day)}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{fmt(dayTotal)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dayEntries.map(entry => {
                      const payer = memberById[entry.paid_by]
                      const payerMc = getMemberColor(payer ? (memberColorIndex[payer.id] ?? 0) : 0)
                      return (
                        <div key={entry.id} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: payer ? payerMc.bg : 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {payer ? initials(payer.display_name) : '?'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(Number(entry.amount))}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {payer ? (memberProfileNames[payer.id] || (payer.user_id === user?.id ? displayName : payer.display_name)) : ''}{entry.description ? ` · ${entry.description}` : ''}
                              {entry.via_scan && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>scan</span>}
                            </div>
                          </div>
                          {entry.receipt_url && (
                            <button onClick={() => setPreviewReceipt(entry.receipt_url)} style={{ width: 42, height: 42, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                              <img src={entry.receipt_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Bon" />
                            </button>
                          )}
                          <button onClick={() => setDeleteEntryId(entry.id)} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0, transition: 'color .15s' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )

        const geschiedenisContent = (
          <>
            {selectedClosing ? (
              <>
                <button onClick={() => setSelectedClosing(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0, WebkitTapHighlightColor: 'transparent' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Terug naar lijst
                </button>
                <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-heading)' }}>{new Date(selectedClosing.closed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 20 }}>{fmt(Number(selectedClosing.total_amount))} totaal</div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Afrekening</div>
                {(selectedClosing.settlements || []).length === 0 ? (
                  <div style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 24, color: 'var(--ok)', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Iedereen stond gelijk — niks te betalen!</div>
                ) : (
                  <div style={{ marginBottom: 24 }}>
                    {(selectedClosing.settlements || []).map((s, i) => (
                      <div key={i} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Betaling {i + 1}</div>
                        <div style={{ fontSize: 15 }}><span style={{ fontWeight: 700 }}>{s.from}</span><span style={{ color: 'var(--muted)' }}> betaalt </span><span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 17 }}>{fmt(s.amount)}</span><span style={{ color: 'var(--muted)' }}> aan </span><span style={{ fontWeight: 700 }}>{s.to}</span></div>
                      </div>
                    ))}
                  </div>
                )}
                {(selectedClosing.entries_snapshot || []).length > 0 && (() => {
                  const snapshot = selectedClosing.entries_snapshot || []
                  const byDay = snapshot.reduce<Record<string, BalanceEntry[]>>((acc, e) => { if (!acc[e.date]) acc[e.date] = []; acc[e.date].push(e); return acc }, {})
                  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a))
                  return (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Uitgaven</div>
                      {days.map(day => {
                        const dayEntries = byDay[day]
                        const dayTotal = dayEntries.reduce((s, e) => s + Number(e.amount), 0)
                        return (
                          <div key={day} style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{formatDayLabel(day)}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt(dayTotal)}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {dayEntries.map((e, i) => (
                                <div key={e.id ?? i} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(Number(e.amount))}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}{e.via_scan && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>scan</span>}</div>
                                  </div>
                                  {e.receipt_url && (
                                    <button onClick={() => setPreviewReceipt(e.receipt_url)} style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                                      <img src={e.receipt_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Bon" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
              </>
            ) : (
              <>
                {closings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--muted)', fontSize: 13 }}>Nog geen afgesloten balansen.</div>
                ) : closings.map(c => {
                  const date = new Date(c.closed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
                  const snapshot = c.entries_snapshot || []
                  const receipts = snapshot.filter(e => e.receipt_url)
                  return (
                    <button key={c.id} onClick={() => setSelectedClosing(c)} style={{ width: '100%', textAlign: 'left', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', marginBottom: 12, cursor: 'pointer', transition: 'border-color .15s', display: 'block' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{date}</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(Number(c.total_amount))}</div>
                      </div>
                      {(c.settlements || []).length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--ok)', marginBottom: 8 }}>Iedereen stond gelijk</div>
                      ) : (c.settlements || []).map((s, i) => (
                        <div key={i} style={{ fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{s.from}</span>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          <span style={{ fontWeight: 600 }}>{s.to}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent)' }}>{fmt(s.amount)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        {receipts.slice(0, 4).map((e, i) => (
                          <div key={i} style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                            <img src={e.receipt_url!} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />
                          </div>
                        ))}
                        {receipts.length > 4 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>+{receipts.length - 4} foto's</div>}
                        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{snapshot.length} uitgave{snapshot.length !== 1 ? 'n' : ''}</div>
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </>
        )

        if (isMobile) {
          return (
            <div ref={swipeRef} style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
              <div
                ref={sliderRef}
                style={{
                  display: 'flex',
                  width: '200%',
                  transform: `translateX(${-activeIndex * 50}%)`,
                  willChange: 'transform',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ width: '50%', flexShrink: 0, boxSizing: 'border-box', padding: 16, paddingBottom: 76, height: 'calc(100dvh - 56px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never }}>
                  {overzichtContent}
                </div>
                <div style={{ width: '50%', flexShrink: 0, boxSizing: 'border-box', padding: 16, paddingBottom: 76, height: 'calc(100dvh - 56px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never }}>
                  {geschiedenisContent}
                </div>
              </div>
            </div>
          )
        }
        return (
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 100px' }}>
            {overzichtContent}
            {closings.length > 0 && (
              <button onClick={() => setShowHistory(true)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color .15s', marginTop: 8 }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Geschiedenis ({closings.length})
              </button>
            )}
          </div>
        )
      })()}

      {/* ── FAB menu (desktop) / bottom nav (mobile) ── */}
      {fabOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setFabOpen(false)} />}
      {fabOpen && (
        <div style={{ position: 'fixed', bottom: isMobile ? 90 : 148, right: isMobile ? '50%' : 20, transform: isMobile ? 'translateX(50%)' : undefined, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 10, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
          <button
            onClick={openLiveCamera}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 20, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Scan bon
          </button>
          <button
            onClick={() => { setFabOpen(false); scanLibraryRef.current?.click() }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 20, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Kies foto
          </button>
          <button
            onClick={() => { setFabOpen(false); setManualPaidBy(members[0]?.id || ''); setShowManual(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 20, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Handmatig
          </button>
        </div>
      )}
      {isMobile ? (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: 'var(--s1)', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', zIndex: 200, transform: 'translateZ(0)', willChange: 'transform' }}>
          <button
            onClick={() => { setActiveView('overzicht'); setSelectedClosing(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', background: 'transparent', color: activeView === 'overzicht' ? '#6366F1' : 'var(--muted)', cursor: 'pointer', padding: '4px 0', WebkitTapHighlightColor: 'transparent' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: activeView === 'overzicht' ? 700 : 500, fontFamily: 'var(--font-body)', lineHeight: 1 }}>Overzicht</span>
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={() => setFabOpen(o => !o)}
              style={{ width: 56, height: 56, borderRadius: '50%', background: '#6366F1', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(99,102,241,0.5)', marginTop: -20, WebkitTapHighlightColor: 'transparent', transition: 'transform .2s', transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
            >
              +
            </button>
          </div>
          <button
            onClick={() => { window.scrollTo(0, 0); setActiveView('geschiedenis'); setSelectedClosing(null) }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', background: 'transparent', color: activeView === 'geschiedenis' ? '#6366F1' : 'var(--muted)', cursor: 'pointer', padding: '4px 0', WebkitTapHighlightColor: 'transparent' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: activeView === 'geschiedenis' ? 700 : 500, fontFamily: 'var(--font-body)', lineHeight: 1 }}>Geschiedenis</span>
          </button>
        </nav>
      ) : (
        <button
          onClick={() => setFabOpen(o => !o)}
          style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 200, transition: 'transform 0.2s', transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          +
        </button>
      )}

      {/* Hidden scan input */}
      <input
        ref={scanLibraryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleScanFile(f); e.target.value = '' }}
      />

      {/* Live camera overlay */}
      {showLiveCamera && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <video ref={videoRef} playsInline muted style={{ flex: 1, objectFit: 'cover', width: '100%' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '40px 24px' }}>
            {scanStatus === 'scanning' && (
              <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.55)', padding: '10px 18px', borderRadius: 20 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ color: '#fff', fontSize: 14 }}>Bon zoeken...</span>
              </div>
            )}
            <button onClick={stopCamera} style={{ padding: '12px 32px', borderRadius: 24, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Annuleren</button>
          </div>
        </div>
      )}

      {/* Scan error toast */}
      {scanError && (
        <div style={{ position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)', background: 'var(--danger)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, zIndex: 400, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          {scanError}
          <button onClick={() => setScanError(null)} style={{ color: 'rgba(255,255,255,0.75)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Modals ── */}

      {showAddMember && (
        <Modal onClose={() => setShowAddMember(false)}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 16 }}>Lid toevoegen</div>
          <input
            autoFocus
            type="text"
            placeholder="Naam"
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addMember(); if (e.key === 'Escape') setShowAddMember(false) }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s3)', color: 'var(--text)', fontSize: 14, marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-cancel" onClick={() => setShowAddMember(false)} style={cancelStyle}>Annuleren</button>
            <button className="btn-submit" onClick={addMember} disabled={addingMember || !newMemberName.trim()} style={primaryStyle(addingMember || !newMemberName.trim())}>{addingMember ? 'Bezig...' : 'Toevoegen'}</button>
          </div>
        </Modal>
      )}

      {showManual && (
        <Modal onClose={() => setShowManual(false)}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 16 }}>Uitgave toevoegen</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Betaald door</div>
              <PayerPicker members={members} value={manualPaidBy} onChange={setManualPaidBy} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Bedrag (€)</div>
              <input autoFocus type="number" inputMode="decimal" placeholder="0.00" value={manualAmount} onChange={e => setManualAmount(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s3)', color: 'var(--text)', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Omschrijving</div>
              <input type="text" placeholder="Boodschappen, restaurant..." value={manualDesc} onChange={e => setManualDesc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveManualEntry() }} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s3)', color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Datum</div>
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s3)', color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Foto (optioneel)</div>
              {manualReceipt ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={manualReceipt} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} alt="Bon" />
                  <button onClick={() => setManualReceipt(null)} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'var(--danger)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1px dashed var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Foto toevoegen
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setManualReceipt(r.result as string); r.readAsDataURL(f) }; e.target.value = '' }} />
                </label>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-cancel" onClick={() => setShowManual(false)} style={cancelStyle}>Annuleren</button>
            <button className="btn-submit" onClick={saveManualEntry} disabled={savingEntry || !manualAmount || !manualPaidBy} style={primaryStyle(savingEntry || !manualAmount || !manualPaidBy)}>{savingEntry ? 'Bezig...' : 'Toevoegen'}</button>
          </div>
        </Modal>
      )}

      {showScanConfirm && (
        <Modal onClose={() => setShowScanConfirm(false)}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>Bon bevestigen</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>Controleer het herkende bedrag en pas aan indien nodig.</div>
          {scanReceipt && (
            <img src={scanReceipt} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)', display: 'block' }} alt="Bon" />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Betaald door</div>
              <PayerPicker members={members} value={scanPaidBy} onChange={setScanPaidBy} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Bedrag (€)</div>
              <input autoFocus type="number" inputMode="decimal" value={scanAmount} onChange={e => setScanAmount(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s3)', color: 'var(--text)', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Omschrijving</div>
              <input type="text" placeholder="Optioneel" value={scanDesc} onChange={e => setScanDesc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveScanEntry() }} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s3)', color: 'var(--text)', fontSize: 14 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-cancel" onClick={() => setShowScanConfirm(false)} style={cancelStyle}>Annuleren</button>
            <button className="btn-submit" onClick={saveScanEntry} disabled={savingScan || !scanAmount || !scanPaidBy} style={primaryStyle(savingScan || !scanAmount || !scanPaidBy)}>{savingScan ? 'Bezig...' : 'Opslaan'}</button>
          </div>
        </Modal>
      )}

      {deleteEntryId && (
        <Modal onClose={() => setDeleteEntryId(null)}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Uitgave verwijderen?</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Dit kan niet ongedaan worden gemaakt.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-cancel" onClick={() => setDeleteEntryId(null)} style={cancelStyle}>Annuleren</button>
            <button onClick={() => deleteEntry(deleteEntryId)} style={{ ...primaryStyle(false), background: 'var(--danger)' }}>Verwijderen</button>
          </div>
        </Modal>
      )}

      {showClose && (
        <Modal onClose={() => { if (!closingInProgress) { setShowClose(false); setCloseResult(null) } }}>
          {closeResult ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>Balans afgesloten</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Iedereen was akkoord. Dit moet er betaald worden:</div>
              {closeResult.length === 0 ? (
                <div style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.3)', borderRadius: 10, padding: '18px 16px', textAlign: 'center', color: 'var(--ok)', fontSize: 14, fontWeight: 600 }}>
                  Iedereen staat gelijk — niks te betalen!
                </div>
              ) : closeResult.map((s, i) => (
                <div key={i} style={{ background: 'var(--s3)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Betaling {i + 1}</div>
                  <div style={{ fontSize: 14 }}>
                    <span style={{ fontWeight: 700 }}>{s.from}</span>
                    <span style={{ color: 'var(--muted)' }}> betaalt </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{fmt(s.amount)}</span>
                    <span style={{ color: 'var(--muted)' }}> aan </span>
                    <span style={{ fontWeight: 700 }}>{s.to}</span>
                  </div>
                </div>
              ))}
              <button className="btn-submit" onClick={() => { setShowClose(false); setCloseResult(null) }} style={{ ...primaryStyle(false), width: '100%', marginTop: 16 }}>Sluiten</button>
            </>
          ) : closingInProgress ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>Balans wordt afgesloten...</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>Balans opmaken</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>Iedereen geeft akkoord. Zodra alle leden akkoord zijn wordt de afrekening automatisch berekend.</div>

              {/* Progress indicator */}
              {members.length > 0 && (
                <div style={{ background: 'var(--s3)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(approvals.length / members.length) * 100}%`, background: 'var(--ok)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: approvals.length === members.length ? 'var(--ok)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {approvals.length} van {members.length} akkoord
                  </div>
                </div>
              )}

              {/* Preview settlements */}
              {entries.length > 0 && members.length > 1 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>Verwachte afrekening</div>
                  {calculateSettlements(members, entries).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ok)' }}>Iedereen staat gelijk</div>
                  ) : calculateSettlements(members, entries).map((s, i) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>{s.from}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      <span style={{ fontWeight: 600 }}>{s.to}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent)' }}>{fmt(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Members approval list */}
              <div style={{ marginBottom: 8 }}>
                {members.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Geen leden gevonden.</div>}
                {members.map(m => {
                  const approved = approvals.some(a => a.member_id === m.id)
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: memberColor(m.display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials(m.display_name)}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.display_name}</div>
                      </div>
                      <button
                        onClick={() => toggleApproval(m.id)}
                        style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${approved ? 'var(--ok)' : 'var(--border)'}`, background: approved ? 'rgba(76,175,130,0.12)' : 'transparent', color: approved ? 'var(--ok)' : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}
                      >
                        {approved ? '✓ Akkoord' : 'Ik ga akkoord'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {entries.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8 }}>Geen actieve uitgaven om af te sluiten.</div>
              )}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-cancel" onClick={() => setShowClose(false)} style={cancelStyle}>Annuleren</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Geschiedenis lijst (full-screen, desktop only) ── */}
      {!isMobile && showHistory && !selectedClosing && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 400, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
          <div style={{ position: 'sticky', top: 0, background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
            <button onClick={() => setShowHistory(false)} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-heading)' }}>Geschiedenis</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {closings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--muted)', fontSize: 13 }}>Nog geen afgesloten balansen.</div>
            )}
            {closings.map(c => {
              const date = new Date(c.closed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
              const snapshot = c.entries_snapshot || []
              const receipts = snapshot.filter(e => e.receipt_url)
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClosing(c)}
                  style={{ width: '100%', textAlign: 'left', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', marginBottom: 12, cursor: 'pointer', transition: 'border-color .15s', display: 'block' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{date}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(Number(c.total_amount))}</div>
                  </div>
                  {(c.settlements || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ok)', marginBottom: 8 }}>Iedereen stond gelijk</div>
                  ) : (c.settlements || []).map((s, i) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>{s.from}</span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      <span style={{ fontWeight: 600 }}>{s.to}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent)' }}>{fmt(s.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    {receipts.slice(0, 4).map((e, i) => (
                      <div key={i} style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                        <img src={e.receipt_url!} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />
                      </div>
                    ))}
                    {receipts.length > 4 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>+{receipts.length - 4} foto's</div>}
                    <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{snapshot.length} uitgave{snapshot.length !== 1 ? 'n' : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Geschiedenis detail (full-screen, desktop only) ── */}
      {!isMobile && selectedClosing && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 410, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
          <div style={{ position: 'sticky', top: 0, background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
            <button onClick={() => setSelectedClosing(null)} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-heading)' }}>
                {new Date(selectedClosing.closed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(Number(selectedClosing.total_amount))} totaal</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            {/* Afrekening */}
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Afrekening</div>
            {(selectedClosing.settlements || []).length === 0 ? (
              <div style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 24, color: 'var(--ok)', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                Iedereen stond gelijk — niks te betalen!
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                {(selectedClosing.settlements || []).map((s, i) => (
                  <div key={i} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Betaling {i + 1}</div>
                    <div style={{ fontSize: 15 }}>
                      <span style={{ fontWeight: 700 }}>{s.from}</span>
                      <span style={{ color: 'var(--muted)' }}> betaalt </span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 17 }}>{fmt(s.amount)}</span>
                      <span style={{ color: 'var(--muted)' }}> aan </span>
                      <span style={{ fontWeight: 700 }}>{s.to}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Uitgaven */}
            {(selectedClosing.entries_snapshot || []).length > 0 && (() => {
              const snapshot = selectedClosing.entries_snapshot || []
              const byDay = snapshot.reduce<Record<string, BalanceEntry[]>>((acc, e) => {
                if (!acc[e.date]) acc[e.date] = []
                acc[e.date].push(e)
                return acc
              }, {})
              const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a))
              return (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Uitgaven</div>
                  {days.map(day => {
                    const dayEntries = byDay[day]
                    const dayTotal = dayEntries.reduce((s, e) => s + Number(e.amount), 0)
                    return (
                      <div key={day} style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{formatDayLabel(day)}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt(dayTotal)}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {dayEntries.map((e, i) => (
                            <div key={e.id ?? i} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(Number(e.amount))}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {e.description || '—'}
                                  {e.via_scan && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>scan</span>}
                                </div>
                              </div>
                              {e.receipt_url && (
                                <button
                                  onClick={() => setPreviewReceipt(e.receipt_url)}
                                  style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                                >
                                  <img src={e.receipt_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Bon" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {previewReceipt && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPreviewReceipt(null)}
        >
          <img src={previewReceipt} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} alt="Bon" />
        </div>
      )}

      {/* ── Account modal ── */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) openAvatarCrop(f); e.target.value = '' }} />

      {showAccount && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { backdropRef.current = e.target === e.currentTarget }}
          onClick={e => { if (e.target === e.currentTarget && backdropRef.current) setShowAccount(false) }}
        >
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.42)' }}>
            <button onClick={() => setShowAccount(false)} style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, fontFamily: 'var(--font-heading)' }}>Mijn account</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setAvatarHovered(true)}
                onMouseLeave={() => setAvatarHovered(false)}
                disabled={isUploadingAvatar}
                title="Profielfoto wijzigen"
                style={{ position: 'relative', width: 68, height: 68, borderRadius: '50%', padding: 0, border: avatarHovered ? '2px solid var(--accent)' : '2px solid transparent', background: 'var(--accent)', overflow: 'hidden', cursor: isUploadingAvatar ? 'wait' : 'pointer', flexShrink: 0, transition: 'border-color .15s' }}
              >
                {ownerAvatarUrl
                  ? <img src={ownerAvatarUrl} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={displayName} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent-fg)' }}>{isUploadingAvatar ? '…' : initials(displayName)}</div>
                }
                {(avatarHovered || isUploadingAvatar) && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                    {isUploadingAvatar
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    }
                  </div>
                )}
              </button>
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>Jouw naam</label>
            <input
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text)', padding: '9px 11px', fontSize: 13, fontFamily: 'var(--font-body)', marginBottom: 14 }}
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void saveAccount() }}
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
            />
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>E-mailadres</label>
            <input
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text)', padding: '9px 11px', fontSize: 13, fontFamily: 'var(--font-body)', marginBottom: 14, opacity: 0.6 }}
              type="email"
              value={user?.email || ''}
              disabled
            />
            <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Persoonlijk</div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6 }}>Je Google-naam wordt als eerste gebruikt. Hier kun je die naam altijd aanpassen voor Get Clear.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button onClick={() => { setShowAccount(false); void logout() }} style={{ background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 5, padding: '11px 16px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}>Uitloggen</button>
              <button onClick={() => void saveAccount()} disabled={isSavingAccount} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: isSavingAccount ? 'wait' : 'pointer', letterSpacing: '.04em', textTransform: 'uppercase', opacity: isSavingAccount ? 0.75 : 1, width: '100%' }}>{isSavingAccount ? 'Bezig...' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          onSave={saveAvatarBlob}
          onCancel={closeCropper}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </>)}
    </div>
  </>
  )
}
