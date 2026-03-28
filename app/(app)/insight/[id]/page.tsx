'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
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
  const ActiveComponent = PAGES[activePage] ?? Dashboard

  return (
    <InsightProvider householdId={id}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Topbar activePage={activePage} setActivePage={setActivePage} />
        <div style={{ display: 'flex', paddingTop: 60 }}>
          <Sidebar activePage={activePage} setActivePage={setActivePage} />
          <main style={{ marginLeft: 240, padding: 28, flex: 1, minWidth: 0, overflowX: 'hidden' }}>
            <ActiveComponent />
          </main>
        </div>
      </div>
    </InsightProvider>
  )
}