'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PickerPage() {
  const [households, setHouseholds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(prof)

      const { data: memberships } = await supabase
        .from('household_members')
        .select('*, households(*)')
        .eq('user_id', user.id)

      setHouseholds(memberships?.map((m: any) => m.households).filter(Boolean) || [])
      setLoading(false)
    }
    load()
  }, [])

  async function createInsight() {
    const name = prompt('Naam van je nieuwe Insight:')
    if (!name?.trim()) return
    const { data: hh } = await supabase.from('households').insert({ name, created_by: user.id }).select().single()
    if (hh) {
      await supabase.from('household_members').insert({ household_id: hh.id, user_id: user.id, role: 'owner', slot: 'user1' })
      await supabase.from('household_data').insert({ household_id: hh.id, data: {} })
      router.push(`/insight/${hh.id}`)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'Gebruiker'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Laden...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        background: 'var(--s1)',
        borderBottom: '3px solid var(--accent)',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: 16
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-.3px' }}>
          <span style={{ color: 'var(--text)' }}>Samen</span>{' '}
          <span style={{ color: 'var(--accent)' }}>Even</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted2)' }}>{displayName}</span>
          <button onClick={logout} style={{
            background: 'transparent',
            color: 'var(--muted2)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            padding: '5px 10px',
            fontSize: 11,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Uitloggen</button>
        </div>
      </header>

      {/* Body */}
      <div style={{ padding: '36px 28px', maxWidth: 1320, margin: '0 auto', width: '100%' }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 6 }}>
          {greeting}, {displayName.split(' ')[0]}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 32 }}>
          Kies een Insight of maak een nieuwe aan.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }}>
          {households.map(hh => (
            <button
              key={hh.id}
              onClick={() => router.push(`/insight/${hh.id}`)}
              style={{
                background: 'var(--s1)',
                border: '1px solid var(--border)',
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
                transition: 'border-color .2s, transform .18s ease, box-shadow .2s ease'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,194,255,.55)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(0,194,255,.45), 0 10px 24px rgba(0,194,255,.12)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 12, color: 'var(--text)' }}>
                {hh.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Klik om te openen</div>
            </button>
          ))}

          <button
            onClick={createInsight}
            style={{
              border: '2px dashed var(--border)',
              background: 'transparent',
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
              transition: 'border-color .2s, color .2s'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--muted)'
            }}
          >
            <span style={{ fontSize: 32, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Nieuwe Insight</span>
          </button>
        </div>
      </div>
    </div>
  )
}