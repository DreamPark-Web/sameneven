'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'
import { fmt } from '@/lib/format'
import ImageCropperModal from '@/components/ImageCropperModal'

// --- Types ---

interface Balance {
  id: string
  name: string
  user_id: string
  created_at: string
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

  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'Gebruiker'
  const ownerAvatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url as string | undefined

  const [balance, setBalance] = useState<Balance | null>(null)
  const [members, setMembers] = useState<BalanceMember[]>([])
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
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanConfirm, setShowScanConfirm] = useState(false)
  const [scanAmount, setScanAmount] = useState('')
  const [scanDesc, setScanDesc] = useState('')
  const [scanPaidBy, setScanPaidBy] = useState('')
  const [scanReceipt, setScanReceipt] = useState<string | null>(null)
  const [savingScan, setSavingScan] = useState(false)

  // Delete entry
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)

  // Close flow
  const [showClose, setShowClose] = useState(false)
  const [closingInProgress, setClosingInProgress] = useState(false)
  const [closeResult, setCloseResult] = useState<Settlement[] | null>(null)
  const autoFinalizeRef = useRef(false)

  // History
  const [showHistory, setShowHistory] = useState(false)
  const [expandedClosingId, setExpandedClosingId] = useState<string | null>(null)

  // Receipt preview
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null)

  const scanFileRef = useRef<HTMLInputElement>(null)
  const scanLibraryRef = useRef<HTMLInputElement>(null)

  // Swipe navigation
  const [allBalanceIds, setAllBalanceIds] = useState<string[]>([])
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)

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

      // Load sibling balance IDs for swipe navigation
      const { data: siblingBalances } = await supabase
        .from('balances')
        .select('id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      setAllBalanceIds((siblingBalances || []).map((b: { id: string }) => b.id))
    }

    load()
  }, [id, user, userLoading])

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

  const handleScanFile = useCallback(async (file: File) => {
    setScanning(true)
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
      if (!res.ok) { setScanError(json.error || 'Scan mislukt'); setScanning(false); return }
      setScanAmount(String(json.amount!).replace('.', ','))
      setScanReceipt(base64)
      setScanDesc('')
      setScanPaidBy(members[0]?.id || '')
      setShowScanConfirm(true)
    } catch {
      setScanError('Scan mislukt, probeer opnieuw')
    }
    setScanning(false)
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

    const { data: newClosing } = await supabase.from('balance_closings').select('*').eq('balance_id', id).order('closed_at', { ascending: false }).limit(1).single()
    if (newClosing) setClosings(prev => [newClosing as BalanceClosing, ...prev])
    setEntries([])
    setApprovals([])
    setCloseResult(settlements)
    setClosingInProgress(false)
    autoFinalizeRef.current = false
  }

  // --- Swipe navigation ---

  function handleTouchStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (swipeStartX.current === null || swipeStartY.current === null) return
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    const dy = e.changedTouches[0].clientY - swipeStartY.current
    swipeStartX.current = null
    swipeStartY.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = allBalanceIds.indexOf(id)
    if (idx === -1) return
    if (dx < 0 && idx < allBalanceIds.length - 1) router.push(`/balance/${allBalanceIds[idx + 1]}`)
    if (dx > 0 && idx > 0) router.push(`/balance/${allBalanceIds[idx - 1]}`)
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

  // --- Render ---

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font-body)', color: 'var(--muted)', fontSize: 14 }}>
        Laden...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-body)', color: 'var(--text)' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ── Header ── */}
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

      {/* ── Content ── */}
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Members */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 24 }}>Leden</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 8px' }}>
            {[...members].sort((a, b) => (b.user_id === user?.id ? 1 : 0) - (a.user_id === user?.id ? 1 : 0)).map(m => {
              const isOwner = m.user_id === user?.id
              const avatarSrc = isOwner ? ownerAvatarUrl : undefined
              const avatarEl = (
                <div style={{ width: 56, height: 56, borderRadius: '50%', border: isOwner ? '2px solid var(--accent)' : 'none', overflow: 'hidden', flexShrink: 0, background: memberColor(m.display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#fff' }}>
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
                  <div style={{ fontSize: 12, color: isOwner ? 'var(--accent)' : 'var(--muted2)', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isOwner ? 600 : 400 }}>{isOwner ? displayName : m.display_name}</div>
                </div>
              )
            })}
            {members.length < 8 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    const text = encodeURIComponent(`Doe mee aan onze balance "${balance?.name}": ${window.location.href}`)
                    window.open(`https://wa.me/?text=${text}`, '_blank')
                  }}
                  style={{ width: 56, height: 56, borderRadius: '50%', border: '2px dashed rgba(var(--accent-rgb),0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 24, lineHeight: 1, background: 'transparent', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(var(--accent-rgb),0.8)'; (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.07)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(var(--accent-rgb),0.4)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  onMouseDown={e => (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.14)'}
                  onMouseUp={e => (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.07)'}
                  title="Uitnodigen via WhatsApp"
                >
                  +
                </button>
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
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Overzicht</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(136px,1fr))', gap: 10 }}>
              {members.map(m => {
                const paid = paidByMember[m.id] || 0
                const net = paid - sharePerMember
                return (
                  <div key={m.id} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{fmt(paid)}</div>
                    <div style={{ fontSize: 11, color: net >= -0.005 ? 'var(--ok)' : 'var(--danger)' }}>
                      {net >= -0.005 ? `+${fmt(net)} terug` : `${fmt(Math.abs(net))} schuld`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Entries grouped by day */}
        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--muted)', fontSize: 13 }}>
            Nog geen uitgaven. Tik + om te beginnen.
          </div>
        ) : (
          sortedDays.map(day => {
            const dayEntries = entriesByDay[day]
            const dayTotal = dayEntries.reduce((s, e) => s + Number(e.amount), 0)
            const isToday = day === today
            return (
              <div key={day} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <div style={{ fontSize: isToday ? 17 : 13, fontWeight: isToday ? 700 : 600, color: isToday ? 'var(--text)' : 'var(--muted)' }}>
                    {formatDayLabel(day)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{fmt(dayTotal)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayEntries.map(entry => {
                    const payer = memberById[entry.paid_by]
                    return (
                      <div
                        key={entry.id}
                        style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: payer ? memberColor(payer.display_name) : 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {payer ? initials(payer.display_name) : '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(Number(entry.amount))}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {payer?.display_name}{entry.description ? ` · ${entry.description}` : ''}
                            {entry.via_scan && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>scan</span>}
                          </div>
                        </div>
                        {entry.receipt_url && (
                          <button
                            onClick={() => setPreviewReceipt(entry.receipt_url)}
                            style={{ width: 42, height: 42, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                          >
                            <img src={entry.receipt_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Bon" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteEntryId(entry.id)}
                          style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0, transition: 'color .15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

        {/* History button */}
        {closings.length > 0 && (
          <button
            onClick={() => setShowHistory(true)}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color .15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Geschiedenis ({closings.length})
          </button>
        )}
      </div>

      {/* ── FAB ── */}
      {fabOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setFabOpen(false)} />}
      {fabOpen && (
        <div style={{ position: 'fixed', bottom: 92, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          <button
            onClick={() => { setFabOpen(false); scanFileRef.current?.click() }}
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
      <button
        onClick={() => setFabOpen(o => !o)}
        style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 200, transition: 'transform 0.2s', transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
      >
        +
      </button>

      {/* Hidden scan inputs */}
      <input
        ref={scanFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleScanFile(f); e.target.value = '' }}
      />
      <input
        ref={scanLibraryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleScanFile(f); e.target.value = '' }}
      />

      {/* Scanning overlay */}
      {scanning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'var(--font-body)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 14, color: '#fff' }}>Bon wordt gescand...</div>
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
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Verwachte afrekening</div>
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

      {showHistory && (
        <Modal onClose={() => setShowHistory(false)}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 16 }}>Geschiedenis</div>
          {closings.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nog geen afgesloten balansen.</div>
          )}
          {closings.map(c => {
            const date = new Date(c.closed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
            const snapshot = c.entries_snapshot || []
            const isExpanded = expandedClosingId === c.id
            return (
              <div key={c.id} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                {/* Card header */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{date}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(Number(c.total_amount))}</div>
                  </div>
                  {/* Settlements */}
                  {(c.settlements || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ok)', marginBottom: 10 }}>Iedereen stond gelijk</div>
                  ) : (
                    <div style={{ marginBottom: 10 }}>
                      {(c.settlements || []).map((s, i) => (
                        <div key={i} style={{ fontSize: 13, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{s.from}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          <span style={{ fontWeight: 600 }}>{s.to}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent)' }}>{fmt(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Expand toggle */}
                  {snapshot.length > 0 && (
                    <button
                      onClick={() => setExpandedClosingId(isExpanded ? null : c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, padding: 0 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s' }}><polyline points="9 18 15 12 9 6"/></svg>
                      {snapshot.length} uitgave{snapshot.length !== 1 ? 'n' : ''} {isExpanded ? 'verbergen' : 'tonen'}
                    </button>
                  )}
                </div>

                {/* Expanded entries */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {snapshot.map((e, i) => (
                      <div key={e.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < snapshot.length - 1 ? '1px solid var(--border)' : undefined }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(Number(e.amount))}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.description || '—'} · {new Date(e.date + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        {e.receipt_url && (
                          <button
                            onClick={() => setPreviewReceipt(e.receipt_url)}
                            style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                          >
                            <img src={e.receipt_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Bon" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <button className="btn-cancel" onClick={() => setShowHistory(false)} style={{ ...cancelStyle, width: '100%', marginTop: 4 }}>Sluiten</button>
        </Modal>
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
    </div>
  )
}
