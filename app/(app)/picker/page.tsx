'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PickerPage() {
  const [households, setHouseholds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: memberships } = await supabase
        .from('household_members')
        .select('*, households(*)')
        .eq('user_id', user.id)

      setHouseholds(memberships?.map(m => m.households).filter(Boolean) || [])
      setLoading(false)
    }
    load()
  }, [])

  async function createInsight() {
    const name = prompt('Naam van je nieuwe Insight:')
    if (!name?.trim()) return
    const { data: hh } = await supabase
      .from('households')
      .insert({ name, created_by: user.id })
      .select().single()
    if (hh) {
      await supabase.from('household_members').insert({
        household_id: hh.id, user_id: user.id, role: 'owner', slot: 'user1'
      })
      await supabase.from('household_data').insert({ household_id: hh.id, data: {} })
      router.push(`/insight/${hh.id}`)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <main className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="text-[#666] text-sm">Laden...</div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#141414]">
      <header className="bg-[#1a1a1a] border-b border-[#2e2e2e] px-6 h-14 flex items-center justify-between">
        <span className="text-lg font-bold text-white">
          Samen <span className="text-[#00c2ff]">Even</span>
        </span>
        <button onClick={logout} className="text-xs text-[#666] hover:text-white transition">
          Uitloggen
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-xl font-bold text-white mb-2">Jouw Insights</h2>
        <p className="text-sm text-[#666] mb-8">Kies een Insight om te openen.</p>

        <div className="grid grid-cols-3 gap-5">
          {households.map(hh => (
            <button
              key={hh.id}
              onClick={() => router.push(`/insight/${hh.id}`)}
              className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-6 text-left hover:border-[#00c2ff] transition group"
            >
              <p className="font-bold text-white text-base mb-1">{hh.name}</p>
              <p className="text-xs text-[#666]">Klik om te openen</p>
            </button>
          ))}

          <button
            onClick={createInsight}
            className="border-2 border-dashed border-[#2e2e2e] rounded-xl p-6 text-center hover:border-[#00c2ff] hover:text-[#00c2ff] text-[#666] transition flex flex-col items-center justify-center gap-2"
          >
            <span className="text-3xl">+</span>
            <span className="text-sm font-semibold">Nieuwe Insight</span>
          </button>
        </div>
      </div>
    </main>
  )
}