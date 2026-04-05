'use client'

import { useEffect, useState } from 'react'
import { PAGE_COLORS, PageKey } from '@/lib/pageColors'

function getNavPrefsKey() {
  if (typeof window === 'undefined') return 'se_nav_nohousehold'
  const path = window.location.pathname.split('/')
  const householdId = path[path.length - 1] || 'nohousehold'
  return `se_nav_${householdId}`
}

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 10h8" />
      <path d="M8 14h6" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  )
}

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: <DashboardIcon /> },
  { id: 'inkomsten',  label: 'Inkomsten',  icon: <ArrowUpIcon />   },
  { id: 'kosten',     label: 'Kosten',     icon: <ReceiptIcon />   },
  { id: 'vermogen',   label: 'Vermogen',   icon: <WalletIcon />   },
  { id: 'tips',       label: 'Tips',       icon: <InfoIcon />      },
]

export default function Sidebar({
  activePage,
  setActivePage,
  collapsed,
  setCollapsed,
  forceCollapsed = false,
}: {
  activePage: string
  setActivePage: (p: string) => void
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  forceCollapsed?: boolean
}) {
  const [hiddenNavItems, setHiddenNavItems] = useState<string[]>([])
  const [navOrder, setNavOrder] = useState<string[]>(NAV_ITEMS.map((item) => item.id))
  const [draggedNavId, setDraggedNavId] = useState<string | null>(null)
  const [dragOverNavId, setDragOverNavId] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
  if (typeof window === 'undefined') return

  const readPrefs = () => {
    const raw = window.localStorage.getItem(getNavPrefsKey())
    const collapsedRaw = window.localStorage.getItem(`${getNavPrefsKey()}_collapsed`)
    setCollapsed(collapsedRaw === '1')

    if (!raw) {
      setHiddenNavItems([])
      setNavOrder(NAV_ITEMS.map((item) => item.id))
      return
    }

    try {
      const parsed = JSON.parse(raw)
      setHiddenNavItems((Array.isArray(parsed?.hidden) ? parsed.hidden : []).map((id: string) => id === 'advies' ? 'tips' : id))

      const defaultOrder = NAV_ITEMS.map((item) => item.id)
      const savedOrder = (Array.isArray(parsed?.order) ? parsed.order : []).map((id: string) => id === 'advies' ? 'tips' : id)
      const cleanedSavedOrder = savedOrder.filter((id: string) => defaultOrder.includes(id))
      const missingIds = defaultOrder.filter((id) => !cleanedSavedOrder.includes(id))

      setNavOrder([...cleanedSavedOrder, ...missingIds])
    } catch {
      setHiddenNavItems([])
      setNavOrder(NAV_ITEMS.map((item) => item.id))
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== getNavPrefsKey() && event.key !== `${getNavPrefsKey()}_collapsed`) return
    readPrefs()
  }

  const handleNavPrefsChanged = () => {
    readPrefs()
  }

  readPrefs()
  window.addEventListener('focus', readPrefs)
  window.addEventListener('storage', handleStorage)
  window.addEventListener('se-nav-prefs-changed', handleNavPrefsChanged)

  return () => {
    window.removeEventListener('focus', readPrefs)
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('se-nav-prefs-changed', handleNavPrefsChanged)
  }
}, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    window.localStorage.setItem(`${getNavPrefsKey()}_collapsed`, next ? '1' : '0')
    window.dispatchEvent(new CustomEvent('se-nav-prefs-changed'))
  }

  function moveNavItemBefore(draggedId: string, targetId: string) {
    if (draggedId === targetId) return

    setNavOrder((prev) => {
      const withoutDragged = prev.filter((id) => id !== draggedId)
      const targetIndex = withoutDragged.indexOf(targetId)
      if (targetIndex === -1) return prev

      const next = [...withoutDragged]
      next.splice(targetIndex, 0, draggedId)

      window.localStorage.setItem(
        getNavPrefsKey(),
        JSON.stringify({
          hidden: hiddenNavItems,
          order: next,
        })
      )
      window.dispatchEvent(new CustomEvent('se-nav-prefs-changed'))

      return next
    })
  }

  const isCollapsed = collapsed || forceCollapsed

  return (
    <aside
      style={{
        position: 'fixed',
        top: 56,
        left: 0,
        bottom: 0,
        width: isCollapsed ? 64 : 240,
        background: 'var(--s1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
        transition: 'width .28s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'width',
      }}
    >
      <nav
        style={{
          flex: 1,
          padding: '12px 8px',
          overflowY: 'auto',
        }}
      >
        {navOrder
          .map((id) => NAV_ITEMS.find((item) => item.id === id))
          .filter(Boolean)
          .filter((item) => !hiddenNavItems.includes(item!.id))
          .map((item) => {
          const colors = PAGE_COLORS[item!.id as PageKey]
          const c = isDark ? colors.dark : colors.light
          const isActive = activePage === item!.id
          const isHovered = hoveredId === item!.id

          return (
            <button
              key={item!.id}
              draggable
              onDragStart={() => {
                setDraggedNavId(item!.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverNavId(item!.id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedNavId) {
                  moveNavItemBefore(draggedNavId, item!.id)
                }
                setDraggedNavId(null)
                setDragOverNavId(null)
              }}
              onDragEnd={() => {
                setDraggedNavId(null)
                setDragOverNavId(null)
              }}
              onClick={() => setActivePage(item!.id)}
              onMouseEnter={() => setHoveredId(item!.id)}
              onMouseLeave={() => { setHoveredId(null); setPressedId(null) }}
              onPointerDown={() => setPressedId(item!.id)}
              onPointerUp={() => setPressedId(null)}
              title={isCollapsed ? item!.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCollapsed ? 0 : 12,
                padding: isCollapsed ? '8px 0' : '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                width: '100%',
                textAlign: isCollapsed ? 'center' : 'left',
                fontSize: 16,
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
                letterSpacing: '.01em',
                border: 'none',
                background: (isActive || isHovered) ? colors.bg : 'transparent',
                color: (isActive || isHovered) ? c : 'var(--muted)',
                marginBottom: 2,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                transition: 'background .15s, color .15s, transform .1s',
                transform: pressedId === item!.id ? 'scale(0.93)' : 'scale(1)',
                WebkitTapHighlightColor: 'transparent',
                opacity: draggedNavId === item!.id ? 0.45 : 1,
                position: 'relative',
              }}
            >
              {dragOverNavId === item!.id && draggedNavId !== item!.id && (
                <div
                  style={{
                    position: 'absolute',
                    top: -1,
                    left: 2,
                    right: 2,
                    height: 2,
                    borderRadius: 999,
                    background: c,
                    pointerEvents: 'none',
                  }}
                />
              )}

              <span
                style={{
                  width: 36,
                  height: 36,
                  minWidth: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: (isActive || isHovered) ? c : `${colors.light}18`,
                  color: (isActive || isHovered) ? '#FFFFFF' : c,
                  flexShrink: 0,
                  transition: 'background .15s, color .15s',
                }}
              >
                {item!.icon}
              </span>
              {!isCollapsed && <span style={{ fontWeight: isActive ? 600 : 500 }}>{item!.label}</span>}
            </button>
          )
        })}
      </nav>

      {!forceCollapsed && <div
        style={{
          padding: '12px 8px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          onClick={toggleCollapsed}
          title={isCollapsed ? 'Uitklappen' : 'Inklappen'}
          aria-label={isCollapsed ? 'Uitklappen' : 'Inklappen'}
          style={{
            width: '100%',
            minHeight: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: isCollapsed ? 0 : 12,
            padding: isCollapsed ? '8px 0' : '8px 10px',
            color: 'var(--muted)',
            cursor: 'pointer',
            transition: 'background .15s, color .15s',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--s2)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'
          }}
        >
          <span
            style={{
              width: 36,
              minWidth: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isCollapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 7l5 5-5 5" />
                <path d="M6 7l5 5-5 5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 17l-5-5 5-5" />
                <path d="M18 17l-5-5 5-5" />
              </svg>
            )}
          </span>

          {!isCollapsed && (
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              Inklappen
            </span>
          )}
        </button>
      </div>}
    </aside>
  )
}
