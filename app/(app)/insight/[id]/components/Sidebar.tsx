'use client'

import { useInsight } from '@/lib/insight-context'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'inkomsten', label: 'Inkomsten', icon: '↑' },
  { id: 'gezamenlijk', label: 'Gezamenlijke Kosten', icon: '⊙' },
  { id: 'prive', label: 'Privé Kosten', icon: '◈' },
  { id: 'sparen', label: 'Sparen', icon: '◎' },
  { id: 'schulden', label: 'Schulden', icon: '↘' },
  { id: 'abonnementen', label: 'Abonnementen', icon: '◉' },
  { id: 'advies', label: 'Advies', icon: '◆' },
  { id: 'leden', label: 'Leden', icon: '◌' },
]

export default function Sidebar({ activePage, setActivePage }: { activePage: string; setActivePage: (p: string) => void }) {
  return (
    <aside style={{
      position: 'fixed',
      top: 60, left: 0, bottom: 0,
      width: 240,
      background: 'var(--s1)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      overflowY: 'auto'
    }}>
      <nav style={{ flex: 1, padding: 12 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '9px 12px',
              borderRadius: 7,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              letterSpacing: '.03em',
              border: activePage === item.id ? '1px solid rgba(0,194,255,.18)' : '1px solid transparent',
              background: activePage === item.id ? 'rgba(0,194,255,.1)' : 'transparent',
              color: activePage === item.id ? 'var(--accent)' : 'var(--muted)',
              marginBottom: 2,
              transition: 'background .15s, color .15s'
            }}
          >
            <span style={{ fontSize: 16, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}