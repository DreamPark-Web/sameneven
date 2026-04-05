'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { InsightProvider } from '@/lib/insight-context'
import { ToastProvider } from '@/lib/toast-context'
import { PAGE_COLORS, PageKey } from '@/lib/pageColors'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import Dashboard from './components/pages/Dashboard'
import Inkomsten from './components/pages/Inkomsten'
import Kosten from './components/pages/Kosten'
import Vermogen from './components/pages/Vermogen'
import Advies from './components/pages/Advies'

const PAGES: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  inkomsten: Inkomsten,
  kosten: Kosten,
  vermogen: Vermogen,
  advies: Advies,
}

function InsightPageInner({
  id,
  activePage,
  setActivePage,
}: {
  id: string
  activePage: string
  setActivePage: (p: string) => void
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = `se_nav_${id}_collapsed`
    const readCollapsed = () => {
      setSidebarCollapsed(window.localStorage.getItem(key) === '1')
    }
    readCollapsed()
    window.addEventListener('focus', readCollapsed)
    window.addEventListener('storage', readCollapsed)
    window.addEventListener('se-nav-prefs-changed', readCollapsed)
    return () => {
      window.removeEventListener('focus', readCollapsed)
      window.removeEventListener('storage', readCollapsed)
      window.removeEventListener('se-nav-prefs-changed', readCollapsed)
    }
  }, [id])

  useEffect(() => {
    const handler = (e: Event) => setActivePage((e as CustomEvent).detail.page)
    window.addEventListener('se-navigate', handler)
    return () => window.removeEventListener('se-navigate', handler)
  }, [setActivePage])

  const ActiveComponent = PAGES[activePage] ?? Dashboard

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -300, bottom: -400, width: 1200, pointerEvents: 'none', zIndex: 0, opacity: 0.04, color: PAGE_COLORS[activePage as PageKey]?.light ?? PAGE_COLORS.dashboard.light }}>
        <svg width="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <polygon points="65,18 135,18 192,62 100,175 8,62" fill="currentColor" />
          <polyline points="65,18 135,18 192,62 100,175 8,62 65,18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          <line x1="65" y1="18" x2="48" y2="66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="135" y1="18" x2="152" y2="66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="65" y1="18" x2="100" y2="66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="135" y1="18" x2="100" y2="66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <polyline points="8,62 48,66 100,66 152,66 192,62" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          <line x1="48" y1="66" x2="100" y2="175" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="152" y1="66" x2="100" y2="175" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="100" y1="66" x2="100" y2="175" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="118" x2="192" y2="118" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <Topbar activePage={activePage} setActivePage={setActivePage} />
      <div style={{ display: 'flex', paddingTop: 56, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
        <main
          style={{
            marginLeft: sidebarCollapsed ? 64 : 240,
            padding: 28,
            flex: 1,
            minWidth: 0,
            overflowX: 'hidden',
            transition: 'margin-left .28s cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'margin-left',
          }}
        >
          <ActiveComponent />
        </main>
      </div>
    </div>
  )
}

export default function InsightPage() {
  const { id } = useParams<{ id: string }>()
  const [activePage, setActivePage] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard'
    const p = new URLSearchParams(window.location.search).get('page')
    return p && PAGES[p] ? p : 'dashboard'
  })

  function navigate(page: string) {
    setActivePage(page)
    const params = new URLSearchParams(window.location.search)
    params.set('page', page)
    params.delete('tab')
    window.history.replaceState(null, '', `?${params.toString()}`)
  }

  return (
    <ToastProvider>
      <InsightProvider householdId={id}>
        <InsightPageInner id={id} activePage={activePage} setActivePage={navigate} />
      </InsightProvider>
    </ToastProvider>
  )
}