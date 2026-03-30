'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'
import { createClient } from '@/lib/supabase'

export default function Leden() {
  const { members, household, currentUser, myRole, data, updateMemberRole, updateMemberSlot } = useInsight()
  const [copied, setCopied] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [changingSlot, setChangingSlot] = useState<string | null>(null)
  const supabase = createClient()

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const slotLabel: Record<string, string> = { user1: n1, user2: n2 }
  const roleLabel: Record<string, string> = { owner: 'Eigenaar', admin: 'Beheerder', editor: 'Bewerker', viewer: 'Kijker' }
  const isOwner = myRole === 'owner' || myRole === 'admin'

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}?invite=${household?.invite_code || ''}` : ''

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function assignSlot(userId: string, slot: string | null) {
    if (!household?.id) return
    setChangingSlot(userId ?? slot ?? 'x')
    try {
      // Clear previous occupant of this slot
      if (slot) {
        const prev = members.find(m => m.slot === slot && m.user_id !== userId)
        if (prev) {
          await supabase
            .from('household_members')
            .update({ slot: null })
            .eq('household_id', household.id)
            .eq('user_id', prev.user_id)
          updateMemberSlot(prev.user_id, null)
        }
      }
      await supabase
        .from('household_members')
        .update({ slot })
        .eq('household_id', household.id)
        .eq('user_id', userId)
      updateMemberSlot(userId, slot)
    } finally {
      setChangingSlot(null)
    }
  }

  async function toggleRole(userId: string, currentMemberRole: string) {
    if (!household?.id) return
    const nextRole = currentMemberRole === 'viewer' ? 'editor' : 'viewer'
    setChangingRole(userId)
    try {
      await supabase
        .from('household_members')
        .update({ role: nextRole })
        .eq('household_id', household.id)
        .eq('user_id', userId)
      updateMemberRole(userId, nextRole)
    } finally {
      setChangingRole(null)
    }
  }

  const panel: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }

  return (
    <div style={panel}>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Insight</span>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Leden</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 14, lineHeight: 1.7 }}>Alle genodigde en gekoppelde leden van deze Insight blijven hier zichtbaar, ook wanneer ze offline zijn.</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'stretch' }}>
        {members.map(member => {
          const isMe = member.user_id === currentUser?.id
          const isOwnerMember = member.role === 'owner' || member.role === 'admin'
          const canChangeRole = isOwner && !isMe && !isOwnerMember
          const displayName = member.display_name || 'Onbekend'
          const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
          const isViewer = member.role === 'viewer'

          return (
            <div key={member.user_id} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, display: 'grid', gridTemplateColumns: '72px 1fr', gap: 14, alignItems: 'start' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#0a0a0a', background: 'var(--accent)', overflow: 'hidden', flexShrink: 0, marginTop: 2 }}>
                {member.avatar_url ? <img src={member.avatar_url} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={displayName} /> : initials}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-heading)', lineHeight: 1.15 }}>
                  {displayName}{isMe && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>(jij)</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                  {member.slot ? slotLabel[member.slot] || member.slot : 'Geen slot'}
                </div>

                {canChangeRole ? (
                  <div style={{ marginTop: 12, display: 'inline-flex', borderRadius: 999, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <button
                      onClick={() => !isViewer && toggleRole(member.user_id, member.role)}
                      disabled={changingRole === member.user_id}
                      style={{
                        padding: '5px 12px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        cursor: isViewer ? 'default' : 'pointer',
                        background: isViewer ? 'var(--accent)' : 'transparent',
                        color: isViewer ? '#0a0a0a' : 'var(--muted)',
                        border: 'none',
                        transition: 'background .15s, color .15s',
                      }}
                    >
                      Kijker
                    </button>
                    <button
                      onClick={() => isViewer && toggleRole(member.user_id, member.role)}
                      disabled={changingRole === member.user_id}
                      style={{
                        padding: '5px 12px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        cursor: !isViewer ? 'default' : 'pointer',
                        background: !isViewer ? 'var(--accent)' : 'transparent',
                        color: !isViewer ? '#0a0a0a' : 'var(--muted)',
                        border: 'none',
                        transition: 'background .15s, color .15s',
                      }}
                    >
                      Bewerker
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,.04)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid rgba(0,194,255,.18)' }}>
                    {roleLabel[member.role] || member.role}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isOwner && (
        <div style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Gegevenskoppeling</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22, alignItems: 'stretch' }}>
            {(['user1', 'user2'] as const).map(slot => {
              const assigned = members.find(m => m.slot === slot)
              const assignedName = assigned?.display_name || 'Onbekend'
              const assignedInitials = assignedName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={slot} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                    {slotLabel[slot] || slot}
                  </div>
                  {assigned ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0a0a0a' }}>
                        {assigned.avatar_url ? <img src={assigned.avatar_url} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={assignedName} /> : assignedInitials}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{assignedName}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Niemand gekoppeld</div>
                  )}
                  <select
                    disabled={changingSlot !== null}
                    value={assigned?.user_id ?? ''}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '') {
                        if (assigned) assignSlot(assigned.user_id, null)
                      } else {
                        assignSlot(val, slot)
                      }
                    }}
                    style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}
                  >
                    <option value=''>— Niemand —</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name || 'Onbekend'}{m.user_id === currentUser?.id ? ' (jij)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isOwner && (
        <div style={{ paddingTop: 22, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Uitnodigingslink</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, background: 'var(--s3)', borderRadius: 5, padding: '8px 10px', fontSize: 11, color: 'var(--accent)', letterSpacing: '.04em', fontFamily: 'var(--font-body)', wordBreak: 'break-all' }}>
              {inviteUrl || 'Geen uitnodigingslink beschikbaar'}
            </div>
            <button onClick={copyInvite} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a', whiteSpace: 'nowrap' }}>
              {copied ? 'Gekopieerd!' : 'Kopieer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
