'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from './supabase'
import LoadingScreen from '@/components/LoadingScreen'

export type Member = {
  user_id: string
  role: string
  slot: string | null
  display_name?: string
  avatar_url?: string
}

export type InsightData = {
  names: { user1: string; user2: string }
  theme: string
  user1: { income: any[]; private: any[]; savings: { shared: any[]; private: any[] } }
  user2: { income: any[]; private: any[]; savings: { shared: any[]; private: any[] } }
  shared: any[]
  schulden: any[]
  spaarpotjes: any[]
  abonnementen: any[]
  dashOrder: string[]
  lastUpdated?: string
}

const DEFAULTS: InsightData = {
  names: { user1: 'Gebruiker 1', user2: 'Gebruiker 2' },
  theme: '#E8C49A',
  user1: { income: [], private: [], savings: { shared: [], private: [] } },
  user2: { income: [], private: [], savings: { shared: [], private: [] } },
  shared: [],
  schulden: [],
  spaarpotjes: [],
  abonnementen: [],
  dashOrder: [],
}

type InsightContextType = {
  data: InsightData
  members: Member[]
  household: any
  currentUser: any
  mySlot: string | null
  myRole: string | null
  isOwner: boolean
  isSingleUser: boolean
  syncState: 'ok' | 'saving' | 'error' | 'live'
  saveData: (newData: InsightData) => void
  canEdit: (slot: string) => boolean
  updateHouseholdName: (name: string) => void
  updateMyProfile: (displayName: string, avatarUrl?: string) => void
  updateMemberRole: (userId: string, role: string) => void
  updateMemberSlot: (userId: string, slot: string | null) => void
}

const InsightContext = createContext<InsightContextType | null>(null)

export function useInsight() {
  const ctx = useContext(InsightContext)
  if (!ctx) throw new Error('useInsight must be used within InsightProvider')
  return ctx
}

function migrateData(d: any): any {
  if (!d) return d
  d = { ...d }
  // Rename jerry/daphne to user1/user2
  if (d.jerry !== undefined && d.user1 === undefined) { d.user1 = d.jerry; delete d.jerry }
  if (d.daphne !== undefined && d.user2 === undefined) { d.user2 = d.daphne; delete d.daphne }
  // Rename subscriptions to abonnementen
  if (d.subscriptions !== undefined && d.abonnementen === undefined) {
    d.abonnementen = d.subscriptions
    delete d.subscriptions
  }
  // Fix person field in abonnementen
  if (d.abonnementen) {
    d.abonnementen = d.abonnementen.map((s: any) => ({
      ...s,
      person: s.person === 'jerry' ? 'user1' : s.person === 'daphne' ? 'user2' : s.person
    }))
  }
  // Fix wie in schulden
  if (d.schulden) {
    d.schulden = d.schulden.map((s: any) => ({
      ...s,
      wie: s.wie === 'jerry' ? 'user1' : s.wie === 'daphne' ? 'user2' : s.wie
    }))
  }
  // Fix split in shared
  if (d.shared) {
    d.shared = d.shared.map((s: any) => ({
      ...s,
      split: s.split === 'jerry' ? 'user1' : s.split === 'daphne' ? 'user2' : s.split
    }))
  }
  return d
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
  const clean = (hex || '#E8C49A').replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

function applyThemeVars(color: string) {
  if (typeof document === 'undefined') return

  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  let hex = (color || '#E8C49A').toLowerCase()
  if (isLight && hex === '#e8c49a') hex = '#a0622a'

  const light = lightenColor(hex, 0.15)
  const { r, g, b } = hexToRgb(hex)

  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent2', light)
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
}

export function InsightProvider({ children, householdId }: { children: React.ReactNode; householdId: string }) {
  const [data, setData] = useState<InsightData>(DEFAULTS)
  const [members, setMembers] = useState<Member[]>([])
  const [household, setHousehold] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [mySlot, setMySlot] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<'ok' | 'saving' | 'error' | 'live'>('ok')
  const [saveTimeout, setSaveTimeoutRef] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const supabase = createClient()

  const TAB_ID = typeof window !== 'undefined'
    ? (sessionStorage.getItem('se_tab_id') ?? (() => {
        const id = crypto.randomUUID()
        sessionStorage.setItem('se_tab_id', id)
        return id
      })())
    : ''

  const loadMembers = useCallback(async () => {
    const { data: mData } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true })
    if (!mData) return
    const ids = mData.map((m: any) => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids)
    const merged = mData.map((m: any) => {
      const profile = profiles?.find((p: any) => p.id === m.user_id)
      return { ...m, display_name: profile?.display_name, avatar_url: profile?.avatar_url }
    })
    setMembers(merged)
  }, [householdId])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const user = session.user
      setCurrentUser(user)

      const { data: hh } = await supabase.from('households').select('*').eq('id', householdId).single()
      setHousehold(hh)

      const { data: membership } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', householdId)
        .eq('user_id', user.id)
        .maybeSingle()

      setMySlot(membership?.slot ?? null)
      setMyRole(membership?.role ?? null)

      await loadMembers()

      const { data: hhData } = await supabase
        .from('household_data')
        .select('data')
        .eq('household_id', householdId)
        .maybeSingle()

      if (hhData?.data) {
        const migrated = migrateData(hhData.data)
        setData({ ...DEFAULTS, ...migrated })
      }

      setReady(true)

      const channel = supabase.channel('hh-' + householdId)
        .on('broadcast', { event: 'data-saved' }, async (msg) => {
          if (!msg.payload || msg.payload.tabId === TAB_ID) return
          const { data: fresh } = await supabase
            .from('household_data')
            .select('data')
            .eq('household_id', householdId)
            .maybeSingle()
          if (fresh?.data) {
            setData({ ...DEFAULTS, ...migrateData(fresh.data) })
            setSyncState('live')
            setTimeout(() => setSyncState('ok'), 2500)
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public',
          table: 'household_data',
          filter: `household_id=eq.${householdId}`
        }, async (payload: any) => {
          if (payload.new?.updated_by === user.id) return
          setData({ ...DEFAULTS, ...migrateData(payload.new.data) })
          setSyncState('live')
          setTimeout(() => setSyncState('ok'), 2500)
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [householdId])

  useEffect(() => {
    applyThemeVars(data.theme || DEFAULTS.theme)
  }, [data.theme])

  useEffect(() => {
    return () => {
      const root = document.documentElement
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent2')
      root.style.removeProperty('--accent-rgb')
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const observer = new MutationObserver(() => {
      applyThemeVars(data.theme || DEFAULTS.theme)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [data.theme])

  useEffect(() => {
    if (!ready) return
    console.log('[6] members-effect: members veranderd, slots/namen:', members.map(m => ({ slot: m.slot, name: m.display_name })))
    setData(prev => {
      const names = { ...prev.names }
      let changed = false
      for (const member of members) {
        if ((member.slot === 'user1' || member.slot === 'user2') && member.display_name) {
          const slot = member.slot as 'user1' | 'user2'
          if (names[slot] !== member.display_name) {
            names[slot] = member.display_name
            changed = true
          }
        }
      }
      console.log('[7] members-effect setData: changed=', changed, '→ names:', names)
      return changed ? { ...prev, names } : prev
    })
  }, [members, ready])

  const saveData = useCallback((newData: InsightData) => {
    const updated = { ...newData, lastUpdated: new Date().toISOString() }
    console.log('[8] saveData: setData met names:', updated.names)
    setData(updated)
    setSyncState('saving')
    if (saveTimeout) clearTimeout(saveTimeout)
    const t = setTimeout(async () => {
      const { error } = await supabase
        .from('household_data')
        .upsert({
          household_id: householdId,
          data: updated,
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.id,
        }, { onConflict: 'household_id' })
      setSyncState(error ? 'error' : 'ok')
    }, 600)
    setSaveTimeoutRef(t)
  }, [householdId, currentUser, saveTimeout])

  const canEdit = useCallback((slot: string) => {
    if (myRole === 'viewer') return false
    if (myRole === 'owner' || myRole === 'admin') return true
    return mySlot === slot
  }, [myRole, mySlot])

  const updateHouseholdName = useCallback((name: string) => {
    setHousehold((prev: any) => prev ? { ...prev, name } : prev)
  }, [])

  const updateMyProfile = useCallback((displayName: string, avatarUrl?: string) => {
    setMembers((prev) =>
      prev.map((member) =>
        member.user_id === currentUser?.id
          ? { ...member, display_name: displayName, ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}) }
          : member
      )
    )
  }, [currentUser?.id])

  const updateMemberRole = useCallback((userId: string, role: string) => {
    setMembers((prev) =>
      prev.map((member) => member.user_id === userId ? { ...member, role } : member)
    )
  }, [])

  const updateMemberSlot = useCallback((userId: string, slot: string | null) => {
    setMembers((prev) =>
      prev.map((member) => member.user_id === userId ? { ...member, slot } : member)
    )
  }, [])

  if (!ready) return <LoadingScreen />

  const isOwner = myRole === 'owner' || myRole === 'admin'
  const isSingleUser = members.length <= 1

  return (
    <InsightContext.Provider
      value={{
        data,
        members,
        household,
        currentUser,
        mySlot,
        myRole,
        isOwner,
        isSingleUser,
        syncState,
        saveData,
        canEdit,
        updateHouseholdName,
        updateMyProfile,
        updateMemberRole,
        updateMemberSlot,
      }}
    >
      {children}
    </InsightContext.Provider>
  )
}
