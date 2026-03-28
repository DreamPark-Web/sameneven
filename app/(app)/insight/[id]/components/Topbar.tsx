'use client'

import { useInsight } from '@/lib/insight-context'
import { useRouter } from 'next/navigation'

export default function Topbar({ activePage, setActivePage }: { activePage: string; setActivePage: (p: string) => void }) {
  const { household, syncState } = useInsight()
  const router = useRouter()

  const syncColor = syncState === 'saving' ? '#d4a017' : syncState === 'error' ? '#e05050' : syncState === 'live' ? '#00c2ff' : '#4caf82'
  const syncLabel = syncState === 'saving' ? 'Opslaan...' : syncState === 'error' ? 'Fout bij opslaan' : syncState === 'live' ? 'Live bijgewerkt ✓' : 'Gesynchroniseerd'

  return (
    <header style={{
      background: 'var(--s1)',
      borderBottom: '1px solid var(--border)',
      height: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px 0 12px',
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 200,
      gap: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <button
          onClick={() => router.push('/picker')}
          style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: 0, width: 32, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          ←
        </button>
        <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-.3px', whiteSpace: 'nowrap', lineHeight: 1, display: 'flex', alignItems: 'center', height: 40 }}>
          <span style={{ color: 'var(--text)' }}>Samen</span>&nbsp;<span style={{ color: 'var(--accent)' }}>Even</span>
        </div>
        {household && (
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {household.name}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: syncColor, flexShrink: 0, transition: 'background .3s' }} />
        <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{syncLabel}</span>
      </div>
    </header>
  )
}