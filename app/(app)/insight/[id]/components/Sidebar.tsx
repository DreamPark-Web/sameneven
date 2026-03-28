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

export default function Sidebar({
  activePage,
  setActivePage,
}: {
  activePage: string
  setActivePage: (page: string) => void
}) {
  const { data } = useInsight()

  return (
    <aside className="fixed top-[60px] left-0 bottom-0 w-[240px] bg-[#1a1a1a] border-r border-[#2e2e2e] flex flex-col z-40">
      <nav className="flex-1 p-2 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition mb-0.5
              ${activePage === item.id
                ? 'bg-[#00c2ff]/10 text-[#00c2ff] border border-[#00c2ff]/20'
                : 'text-[#666] hover:bg-[#222] hover:text-white border border-transparent'
              }`}
          >
            <span className="w-5 text-center text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}