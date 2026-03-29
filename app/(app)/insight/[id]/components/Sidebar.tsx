'use client'

import { useEffect, useState } from 'react'

function getNavPrefsKey() {
  if (typeof window === 'undefined') return 'se_nav_nohousehold'
  const path = window.location.pathname.split('/')
  const householdId = path[path.length - 1] || 'nohousehold'
  return `se_nav_${householdId}`
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a3 3 0 0 1 0 5.74" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  )
}

function DollarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function TrendDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M21 10v7h-7" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'inkomsten', label: 'Inkomsten', icon: <ArrowUpIcon /> },
  { id: 'gezamenlijk', label: 'Gezamenlijke Kosten', icon: <UsersIcon /> },
  { id: 'prive', label: 'Privé Kosten', icon: <PersonIcon /> },
  { id: 'sparen', label: 'Sparen', icon: <DollarIcon /> },
  { id: 'schulden', label: 'Schulden', icon: <TrendDownIcon /> },
  { id: 'abonnementen', label: 'Abonnementen', icon: <BellIcon /> },
  { id: 'advies', label: 'Advies', icon: <InfoIcon /> },
  { id: 'leden', label: 'Leden', icon: <UsersIcon /> },
]

export default function Sidebar({
  activePage,
  setActivePage,
}: {
  activePage: string
  setActivePage: (p: string) => void
}) {
  const [hiddenNavItems, setHiddenNavItems] = useState<string[]>([])
  const [navOrder, setNavOrder] = useState<string[]>(NAV_ITEMS.map((item) => item.id))
  const [draggedNavId, setDraggedNavId] = useState<string | null>(null)
  const [dragOverNavId, setDragOverNavId] = useState<string | null>(null)

  useEffect(() => {
  if (typeof window === 'undefined') return

  const readPrefs = () => {
    const raw = window.localStorage.getItem(getNavPrefsKey())
    if (!raw) {
      setHiddenNavItems([])
      setNavOrder(NAV_ITEMS.map((item) => item.id))
      return
    }

    try {
      const parsed = JSON.parse(raw)
      setHiddenNavItems(Array.isArray(parsed?.hidden) ? parsed.hidden : [])

      const defaultOrder = NAV_ITEMS.map((item) => item.id)
      const savedOrder = Array.isArray(parsed?.order) ? parsed.order : []
      const cleanedSavedOrder = savedOrder.filter((id: string) => defaultOrder.includes(id))
      const missingIds = defaultOrder.filter((id) => !cleanedSavedOrder.includes(id))

      setNavOrder([...cleanedSavedOrder, ...missingIds])
    } catch {
      setHiddenNavItems([])
      setNavOrder(NAV_ITEMS.map((item) => item.id))
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== getNavPrefsKey()) return
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

  return (
    <aside
      style={{
        position: 'fixed',
        top: 60,
        left: 0,
        bottom: 0,
        width: 240,
        background: 'var(--s1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
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
          const active = activePage === item!.id

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
                border: active ? '1px solid rgba(var(--accent-rgb),.18)' : '1px solid transparent',
                background: active ? 'rgba(var(--accent-rgb),.10)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--muted)',
                marginBottom: 2,
                transition: 'background .15s, color .15s, border-color .15s',
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
                    height: 1,
                    borderRadius: 999,
                    background: 'var(--accent)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              <span
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item!.icon}
              </span>
              <span>{item!.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}