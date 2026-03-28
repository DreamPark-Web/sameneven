'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/picker')
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/picker` }
    })
  }

  return (
    <main className="min-h-screen bg-[#141414] flex items-center justify-center p-6">
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-10 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-1">
          Samen <span className="text-[#00c2ff]">Even</span>
        </h1>
        <p className="text-sm text-[#666] mb-8">Financieel overzicht, samen.</p>

        <button
          onClick={handleGoogle}
          className="w-full bg-[#222] border border-[#2e2e2e] text-white rounded-md py-2.5 text-sm font-semibold hover:border-[#00c2ff] transition mb-4"
        >
          Inloggen met Google
        </button>

        <div className="flex items-center gap-3 mb-4 text-xs text-[#444]">
          <div className="flex-1 h-px bg-[#2e2e2e]" />
          of
          <div className="flex-1 h-px bg-[#2e2e2e]" />
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="E-mailadres"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-[#222] border border-[#2e2e2e] text-white rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#00c2ff]"
          />
          <input
            type="password"
            placeholder="Wachtwoord"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-[#222] border border-[#2e2e2e] text-white rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#00c2ff]"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#00c2ff] text-black font-bold rounded-md py-2.5 text-sm uppercase tracking-wide hover:bg-[#40d8ff] transition disabled:opacity-50"
          >
            {loading ? 'Laden...' : 'Inloggen'}
          </button>
        </form>
      </div>
    </main>
  )
}