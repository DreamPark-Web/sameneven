'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from './supabase'

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
  theme: '#00c2ff',
  user1: { income: [], private: [], savings: { shared: [], private: [] } },
  user2: { income: [], private: [], savings: { shared: [], private: [] } },
  shared: [],
  schulden: [],
  spaarpotjes: [],
  abonnementen: [],
  dashOrder: ['block-stats', 'block-transfer', 'block-donut', 'block-spaar', 'block-schuld'],
}

type InsightContextType = {
  data: InsightData
  members: Member[]
  household: any
  currentUser: any
  mySlot: string | null
  myRole: string | null
  syncState: 'ok' | 'saving' | 'error' | 'live'
  saveData: (newData: InsightData) => void
  canEdit: (slot: string) => boolean
}

const InsightContext = createContext<InsightContextType | null>(null)

export function useInsight() {
  const ctx = useContext(InsightContext)
  if (!ctx) throw new Error('useInsight must be used within InsightProvider')
  return ctx
}

export function InsightProvider({
  children,
  householdId,
}: {
  children: React.ReactNode
  householdId: string
}) {
  const [data, setData] = useState<InsightData>(DEFAULTS)
  const [members, setMembers] = useState<Member[]>([])
  const [household, setHousehold] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [mySlot, setMySlot] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<'ok' | 'saving' | 'error' | 'live'>('ok')
  const [saveTimeout, setSaveTimeoutRef] = useState<any>(null)
  const supabase = createClient()

  const TAB_ID = typeof window !== 'undefined'
    ? sessionStorage.getItem('se_tab_id') ?? (() => {
        const id = crypto.randomUUID()
        sessionStorage.setItem('se_tab_id', id)
        return id
      })()
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)

      const { data: hh } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
        .single()
      setHousehold(hh)

      const { data: membership } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', householdId)
        .eq('user_id', user.id)
        .single()

      setMySlot(membership?.slot ?? null)
      setMyRole(membership?.role ?? null)

      await loadMembers()

      const { data: hhData } = await supabase
        .from('household_data')
        .select('data')
        .eq('household_id', householdId)
        .maybeSingle()

      if (hhData?.data) {
        setData({ ...DEFAULTS, ...hhData.data })
      }

      // Realtime
      const channel = supabase.channel('hh-' + householdId)
        .on('broadcast', { event: 'data-saved' }, async (msg) => {
          if (!msg.payload || msg.payload.tabId === TAB_ID) return
          const { data: fresh } = await supabase
            .from('household_data')
            .select('data')
            .eq('household_id', householdId)
            .maybeSingle()
          if (fresh?.data) {
            setData({ ...DEFAULTS, ...fresh.data })
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
          setData({ ...DEFAULTS, ...payload.new.data })
          setSyncState('live')
          setTimeout(() => setSyncState('ok'), 2500)
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [householdId])

  const saveData = useCallback((newData: InsightData) => {
    const updated = { ...newData, lastUpdated: new Date().toISOString() }
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
    if (myRole === 'owner' || myRole === 'admin') return true
    return mySlot === slot
  }, [myRole, mySlot])

  return (
    <InsightContext.Provider value={{
      data, members, household, currentUser,
      mySlot, myRole, syncState, saveData, canEdit
    }}>
      {children}
    </InsightContext.Provider>
  )
}