'use client'

import { useState, useRef, useEffect } from 'react'
import { useInsight } from '@/lib/insight-context'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366', flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.117 1.522 5.847L.057 23.882l6.198-1.437A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.369l-.359-.213-3.68.853.882-3.573-.234-.368A9.819 9.819 0 0 1 2.182 12C2.182 6.578 6.578 2.182 12 2.182S21.818 6.578 21.818 12 17.422 21.818 12 21.818z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#5865F2', flexShrink: 0 }}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function NativeShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export default function Leden() {
  const { members, household, currentUser, myRole, isOwner, data, isSingleUser, updateMemberRole, updateMemberSlot } = useInsight()
  const [copied, setCopied] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [changingSlot, setChangingSlot] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const slotLabel: Record<string, string> = { user1: n1, user2: n2 }
  const roleLabel: Record<string, string> = { owner: 'Eigenaar', admin: 'Beheerder', editor: 'Bewerker', viewer: 'Kijker' }

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}?invite=${household?.invite_code || ''}` : ''

  useEffect(() => {
    if (!shareOpen) return
    function handleClick(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [shareOpen])

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => { setCopied(false); setShareOpen(false) }, 2000)
  }

  async function assignSlot(userId: string, slot: string | null) {
    if (!household?.id) return
    setChangingSlot(userId)
    try {
      if (slot) {
        const prev = members.find(m => m.slot === slot && m.user_id !== userId)
        if (prev) {
          await supabase.from('household_members').update({ slot: null }).eq('household_id', household.id).eq('user_id', prev.user_id)
          updateMemberSlot(prev.user_id, null)
        }
      }
      await supabase.from('household_members').update({ slot }).eq('household_id', household.id).eq('user_id', userId)
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
      await supabase.from('household_members').update({ role: nextRole }).eq('household_id', household.id).eq('user_id', userId)
      updateMemberRole(userId, nextRole)
    } finally {
      setChangingRole(null)
    }
  }

  async function leaveInsight() {
    if (!household?.id || !currentUser?.id || isLeaving) return
    setIsLeaving(true)
    await supabase.from('household_members').delete().eq('household_id', household.id).eq('user_id', currentUser.id)
    router.push('/picker')
  }

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const shareOptions: Array<{ label: string; icon: React.ReactNode; action: () => void }> = [
    {
      label: 'WhatsApp',
      icon: <WhatsAppIcon />,
      action: () => {
        window.open(`https://wa.me/?text=${encodeURIComponent('Doe mee met mijn GetClear Insight: ' + inviteUrl)}`, '_blank')
        setShareOpen(false)
      },
    },
    {
      label: 'Discord',
      icon: <DiscordIcon />,
      action: () => {
        navigator.clipboard.writeText(inviteUrl)
        setCopied(true)
        setTimeout(() => { setCopied(false); setShareOpen(false) }, 2000)
      },
    },
    {
      label: 'E-mail',
      icon: <EmailIcon />,
      action: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent('Uitnodiging voor GetClear')}&body=${encodeURIComponent('Doe mee met mijn GetClear Insight:\n' + inviteUrl)}`
        setShareOpen(false)
      },
    },
    {
      label: copied ? 'Gekopieerd!' : 'Kopieer link',
      icon: <CopyIcon />,
      action: handleCopyLink,
    },
    ...(hasNativeShare ? [{
      label: 'Meer opties',
      icon: <NativeShareIcon />,
      action: () => {
        navigator.share({ title: 'GetClear Uitnodiging', url: inviteUrl })
        setShareOpen(false)
      },
    }] : []),
  ]

  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }

  return (
    <div style={panel}>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Ledenoverzicht</span>
        {isOwner && (
          <div ref={shareRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShareOpen(v => !v)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Uitnodigen
            </button>
            {shareOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--s1)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '6px 0', zIndex: 100, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
                {shareOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={opt.action}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-body)', textAlign: 'left' }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 14, lineHeight: 1.7 }}>Alle genodigde en gekoppelde leden van deze Insight blijven hier zichtbaar, ook wanneer ze offline zijn.</div>

      {isSingleUser && (
        <div style={{ marginBottom: 22, padding: '18px 20px', background: 'rgba(var(--accent-rgb), 0.06)', border: '1px solid rgba(var(--accent-rgb), 0.3)', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontFamily: 'var(--font-heading)' }}>Nodig een partner uit</div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6 }}>Je gebruikt deze insight alleen. Gebruik de knop rechtsboven om samen te beginnen.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'stretch' }}>
        {members.map(member => {
          const isMe = member.user_id === currentUser?.id
          const isOwnerMember = member.role === 'owner' || member.role === 'admin'
          const canChangeRole = isOwner && !isMe && !isOwnerMember
          const displayName = member.display_name || 'Onbekend'
          const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
          const isViewer = member.role === 'viewer'

          return (
            <div key={member.user_id} style={{ background: 'var(--s1)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 18, display: 'grid', gridTemplateColumns: '72px 1fr', gap: 14, alignItems: 'start' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent-fg)', background: 'var(--accent)', overflow: 'hidden', flexShrink: 0, marginTop: 2 }}>
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
                      style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: isViewer ? 'default' : 'pointer', background: isViewer ? 'var(--accent)' : 'transparent', color: isViewer ? 'var(--accent-fg)' : 'var(--muted)', border: 'none', transition: 'background .15s, color .15s' }}
                    >
                      Kijker
                    </button>
                    <button
                      onClick={() => isViewer && toggleRole(member.user_id, member.role)}
                      disabled={changingRole === member.user_id}
                      style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: !isViewer ? 'default' : 'pointer', background: !isViewer ? 'var(--accent)' : 'transparent', color: !isViewer ? 'var(--accent-fg)' : 'var(--muted)', border: 'none', transition: 'background .15s, color .15s' }}
                    >
                      Bewerker
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,.04)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb), .18)' }}>
                    {roleLabel[member.role] || member.role}
                  </div>
                )}

                {isOwner && (() => {
                  const takenByOthers = new Set(members.filter(m => m.user_id !== member.user_id && m.slot).map(m => m.slot as string))
                  const showUser1 = member.slot !== 'user1' && !takenByOthers.has('user1')
                  const showUser2 = !isSingleUser && member.slot !== 'user2' && !takenByOthers.has('user2')
                  return (
                    <div style={{ marginTop: 10 }}>
                      <select
                        disabled={changingSlot !== null}
                        value=""
                        onChange={e => {
                          const val = e.target.value
                          if (val === '__none') assignSlot(member.user_id, null)
                          else if (val) assignSlot(member.user_id, val)
                        }}
                        style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}
                      >
                        <option value="" disabled>{member.slot ? slotLabel[member.slot] || member.slot : '— Geen slot —'}</option>
                        {member.slot && <option value="__none">— Geen slot —</option>}
                        {showUser1 && <option value="user1">{n1}</option>}
                        {showUser2 && <option value="user2">{n2}</option>}
                      </select>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {!isOwner && (
        <div style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
          {confirmLeave ? (
            <div style={{ background: 'rgba(200,60,60,.08)', border: '1px solid rgba(200,60,60,.22)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.6, marginBottom: 12 }}>
                Weet je zeker dat je deze Insight wilt verlaten? Je verliest je toegang.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => setConfirmLeave(false)}
                  disabled={isLeaving}
                  style={{ background: 'transparent', color: 'var(--muted2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', width: '100%' }}
                >
                  Annuleren
                </button>
                <button
                  onClick={leaveInsight}
                  disabled={isLeaving}
                  style={{ background: 'rgba(200,60,60,.12)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.24)', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: isLeaving ? 'default' : 'pointer', width: '100%', opacity: isLeaving ? 0.7 : 1 }}
                >
                  {isLeaving ? 'Bezig...' : 'Ja, verlaten'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLeave(true)}
              style={{ background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 6, padding: '8px 14px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', width: '100%' }}
            >
              Insight verlaten
            </button>
          )}
        </div>
      )}
    </div>
  )
}
