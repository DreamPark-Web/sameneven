'use client'

import { useInsight } from '@/lib/insight-context'
import { useRouter } from 'next/navigation'

export default function Topbar({
  activePage,
  setActivePage,
}: {
  activePage: string
  setActivePage: (page: string) => void
}) {
  const { household, syncState } = useInsight()
  const router = useRouter()

  const syncLabel = syncState === 'saving' ? 'Opslaan...'
    : syncState === 'error' ? 'Fout bij opslaan'
    : syncState === 'live' ? 'Live bijgewerkt ✓'
    : 'Gesynchroniseerd'

  const syncColor = syncState === 'saving' ? '#d4a017'
    : syncState === 'error' ? '#e05050'
    : syncState === 'live' ? '#00c2ff'
    : '#4caf82'

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#1a1a1a] border-b border-[#2e2e2e] z-50 flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/picker')}
          className="text-[#666] hover:text-white transition text-sm"
        >
          ←
        </button>
        <span className="text-lg font-bold text-white">
          Samen <span className="text-[#00c2ff]">Even</span>
        </span>
        {household && (
          <span className="text-xs text-[#666] hidden sm:block">
            {household.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: syncColor }} />
          <span className="text-xs text-[#666] hidden sm:block">{syncLabel}</span>
        </div>
      </div>
    </header>
  )
}