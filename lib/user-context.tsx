'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from './supabase'

export type UserProfile = {
  display_name: string | null
  avatar_url: string | null
}

type UserContextType = {
  currentUser: any
  profile: UserProfile | null
  userLoading: boolean
  updateProfile: (displayName: string, avatarUrl?: string) => void
  saveDisplayName: (name: string) => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserLoading(false)
        return
      }
      setCurrentUser(user)
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      setProfile(prof ?? null)
      setUserLoading(false)
    }
    load()
  }, [])

  const updateProfile = useCallback((displayName: string, avatarUrl?: string) => {
    setProfile(prev => ({
      display_name: displayName,
      avatar_url: avatarUrl !== undefined ? avatarUrl : (prev?.avatar_url ?? null),
    }))
  }, [])

  const saveDisplayName = useCallback(async (name: string) => {
    if (!currentUser?.id) return

    await supabase
      .from('profiles')
      .upsert({ id: currentUser.id, display_name: name }, { onConflict: 'id' })

    updateProfile(name)

    const { data: memberships } = await supabase
      .from('household_members')
      .select('household_id, slot')
      .eq('user_id', currentUser.id)
      .in('slot', ['user1', 'user2'])

    if (!memberships?.length) return

    const householdIds = memberships.map((m: any) => m.household_id)

    const { data: rows } = await supabase
      .from('household_data')
      .select('household_id, data')
      .in('household_id', householdIds)

    if (!rows?.length) return

    const updates = rows
      .map((row: any) => {
        const membership = memberships.find((m: any) => m.household_id === row.household_id)
        if (!membership) return null
        const d = row.data || {}
        return {
          household_id: row.household_id,
          data: { ...d, names: { ...(d.names || {}), [membership.slot]: name } },
          updated_at: new Date().toISOString(),
          updated_by: currentUser.id,
        }
      })
      .filter(Boolean)

    if (updates.length) {
      await supabase
        .from('household_data')
        .upsert(updates, { onConflict: 'household_id' })
    }
  }, [currentUser, updateProfile])

  return (
    <UserContext.Provider value={{ currentUser, profile, userLoading, updateProfile, saveDisplayName }}>
      {children}
    </UserContext.Provider>
  )
}
