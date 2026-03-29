'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { InsightProvider } from '@/lib/insight-context'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import Dashboard from './components/pages/Dashboard'
import Inkomsten from './components/pages/Inkomsten'
import Gezamenlijk from './components/pages/Gezamenlijk'
import Prive from './components/pages/Prive'
import Sparen from './components/pages/Sparen'
import Schulden from './components/pages/Schulden'
import Abonnementen from './components/pages/Abonnementen'
import Advies from './components/pages/Advies'
import Leden from './components/pages/Leden'

const PAGES: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  inkomsten: Inkomsten,
  gezamenlijk: Gezamenlijk,
  prive: Prive,
  sparen: Sparen,
  schulden: Schulden,
  abonnementen: Abonnementen,
  advies: Advies,
  leden: Leden,
}

export default function InsightPage() {
  const { id } = useParams<{ id: string }>()
  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const ActiveComponent = PAGES[activePage] ?? Dashboard

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

  return (
    <InsightProvider householdId={id}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Topbar activePage={activePage} setActivePage={setActivePage} />
        <div
          style={{
            display: 'flex',
            paddingTop: 60,
            minHeight: '100vh',
          }}
        >
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
    </InsightProvider>
  )
}