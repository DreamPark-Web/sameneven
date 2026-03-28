'use client'

import { useInsight } from '@/lib/insight-context'
import { useState } from 'react'

export default function Leden() {
  const { members, household, currentUser, myRole, data } = useInsight()
  const [copied, setCopied] = useState(false)

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?invite=${household?.invite_code || ''}`
    : ''

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isOwner = myRole === 'owner' || myRole === 'admin'
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const slotLabel: Record<string, string> = { user1: n1, user2: n2 }
  const roleLabel: Record<string, string> = {
    owner: 'Eigenaar', admin: 'Beheerder', editor: 'Redacteur', viewer: 'Kijker'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Leden</h1>
        <p className="text-sm text-[#666] mt-1">{members.length} {members.length === 1 ? 'lid' : 'leden'}</p>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden mb-6">
        {members.map((member, i) => {
          const isMe = member.user_id === currentUser?.id
          const displayName = member.display_name || 'Onbekend'
          const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
          return (
            <div key={member.user_id} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-[#2e2e2e]' : ''}`}>
              <div className="flex items-center gap-3">
                {member.avatar_url ? (
                  <img src={member.avatar_url} className="w-9 h-9 rounded-full" alt={displayName} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#00c2ff]/20 flex items-center justify-center text-[#00c2ff] text-sm font-bold">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-white text-sm font-semibold">
                    {displayName}
                    {isMe && <span className="text-xs text-[#666] ml-2">(jij)</span>}
                  </p>
                  <p className="text-xs text-[#666]">
                    {member.slot ? slotLabel[member.slot] || member.slot : 'Geen slot'}
                  </p>
                </div>
              </div>
              <span className="text-xs bg-[#2e2e2e] text-[#999] px-2 py-1 rounded-full">
                {roleLabel[member.role] || member.role}
              </span>
            </div>
          )
        })}
      </div>

      {isOwner && (
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#666] mb-3">Uitnodigen</p>
          <p className="text-sm text-[#666] mb-4">Deel deze link om iemand toegang te geven tot deze Insight.</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-[#222] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-[#666] truncate">
              {inviteUrl || 'Geen uitnodigingslink beschikbaar'}
            </div>
            <button
              onClick={copyInvite}
              className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition whitespace-nowrap"
            >
              {copied ? 'Gekopieerd!' : 'Kopieer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}