'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { InsightProvider } from '@/lib/insight-context'
import { ToastProvider } from '@/lib/toast-context'
import { PAGE_COLORS, PageKey } from '@/lib/pageColors'
import { useBreakpoint } from '@/lib/hooks'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import Dashboard from './components/pages/Dashboard'
import Inkomsten from './components/pages/Inkomsten'
import Kosten from './components/pages/Kosten'
import Vermogen from './components/pages/Vermogen'
import Advies from './components/pages/Tips'

const PAGES: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  inkomsten: Inkomsten,
  kosten: Kosten,
  vermogen: Vermogen,
  tips: Advies,
}

const PAGE_ORDER = ['dashboard', 'inkomsten', 'kosten', 'vermogen', 'tips'] as const

const BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )},
  { id: 'inkomsten', label: 'Inkomsten', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="M6 11l6-6 6 6" />
    </svg>
  )},
  { id: 'kosten', label: 'Kosten', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 10h8" /><path d="M8 14h6" />
    </svg>
  )},
  { id: 'vermogen', label: 'Vermogen', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  )},
  { id: 'tips', label: 'Tips', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  )},
]

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
  const [navPressedId, setNavPressedId] = useState<string | null>(null)
  const { isSmall, isMedium, isXSmall } = useBreakpoint()

  const swipeRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isHorizontal = useRef<boolean | null>(null)
  const activeIndexRef = useRef(0)

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

  const activeIndex = Math.max(0, PAGE_ORDER.indexOf(activePage as typeof PAGE_ORDER[number]))

  useEffect(() => {
    activeIndexRef.current = activeIndex
    if (!sliderRef.current) return
    sliderRef.current.style.transition = 'transform .38s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    sliderRef.current.style.transform = `translateX(${-activeIndex * (100 / PAGE_ORDER.length)}%)`
  }, [activeIndex])

  useEffect(() => {
    if (!isSmall) return
    const el = swipeRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      isHorizontal.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - touchStartY.current
      if (isHorizontal.current === null) {
        if (Math.abs(dx) > Math.abs(dy) + 5) isHorizontal.current = true
        else if (Math.abs(dy) > Math.abs(dx) + 5) isHorizontal.current = false
        else return
      }
      if (!isHorizontal.current) return
      e.preventDefault()
      const idx = activeIndexRef.current
      const n = PAGE_ORDER.length
      const offset = (idx === 0 && dx > 0) || (idx === n - 1 && dx < 0) ? dx * 0.25 : dx
      if (sliderRef.current) {
        sliderRef.current.style.transition = 'none'
        sliderRef.current.style.transform = `translateX(calc(${-idx * (100 / n)}% + ${offset}px))`
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!isHorizontal.current) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const threshold = window.innerWidth * 0.25
      const idx = activeIndexRef.current
      const n = PAGE_ORDER.length
      const newIdx = dx < -threshold && idx < n - 1 ? idx + 1 : dx > threshold && idx > 0 ? idx - 1 : idx
      if (sliderRef.current) {
        sliderRef.current.style.transition = 'transform .38s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        sliderRef.current.style.transform = `translateX(${-newIdx * (100 / n)}%)`
      }
      if (newIdx !== idx) setActivePage(PAGE_ORDER[newIdx])
      isHorizontal.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isSmall, setActivePage])

  const ActiveComponent = PAGES[activePage] ?? Dashboard

  const sidebarWidth = isSmall ? 0 : isMedium ? 64 : (sidebarCollapsed ? 64 : 240)
  const mainMargin = isSmall ? 0 : sidebarWidth

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
        {!isSmall && (
          <Sidebar
            activePage={activePage}
            setActivePage={setActivePage}
            collapsed={isMedium ? true : sidebarCollapsed}
            setCollapsed={setSidebarCollapsed}
            forceCollapsed={isMedium}
          />
        )}
        {isSmall ? (
          <div ref={swipeRef} style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <div
              ref={sliderRef}
              style={{
                display: 'flex',
                width: `${PAGE_ORDER.length * 100}%`,
                transform: `translateX(${-activeIndex * (100 / PAGE_ORDER.length)}%)`,
                willChange: 'transform',
                alignItems: 'flex-start',
              }}
            >
              {PAGE_ORDER.map(id => {
                const Comp = PAGES[id] ?? Dashboard
                return (
                  <div key={id} style={{ width: `${100 / PAGE_ORDER.length}%`, flexShrink: 0, boxSizing: 'border-box', padding: 16, paddingBottom: 76, height: 'calc(100dvh - 56px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never }}>
                    <Comp />
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <main
            style={{
              marginLeft: mainMargin,
              padding: 28,
              paddingBottom: 28,
              flex: 1,
              minWidth: 0,
              overflowX: 'hidden',
              transition: 'margin-left .28s cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'margin-left',
            }}
          >
            <ActiveComponent />
          </main>
        )}
      </div>
      {isSmall && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: 'var(--s1)',
          borderTop: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 200,
        }}>
          {BOTTOM_NAV_ITEMS.map(item => {
            const colors = PAGE_COLORS[item.id as PageKey]
            const isActive = activePage === item.id
            const c = isActive ? colors.light : 'var(--muted)'
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                onPointerDown={() => setNavPressedId(item.id)}
                onPointerUp={() => setNavPressedId(null)}
                onPointerLeave={() => setNavPressedId(null)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  border: 'none',
                  background: 'transparent',
                  color: c,
                  cursor: 'pointer',
                  padding: '4px 0',
                  minWidth: 44,
                  transform: navPressedId === item.id ? 'scale(0.88)' : 'scale(1)',
                  transition: 'transform .1s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {item.icon}
                <span style={{ fontSize: isXSmall ? 9 : 10, fontWeight: isActive ? 700 : 500, fontFamily: 'var(--font-body)', lineHeight: 1 }}>{item.label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

export default function InsightPage() {
  const { id } = useParams<{ id: string }>()
  const [activePage, setActivePage] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard'
    const raw = new URLSearchParams(window.location.search).get('page')
    const p = raw === 'advies' ? 'tips' : raw
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