'use client'

import { useState, useEffect } from 'react'
import { PAGE_COLORS } from '@/lib/pageColors'
import Gezamenlijk from './Gezamenlijk'
import Prive from './Prive'
import Abonnementen from './Abonnementen'

const TABS = [
  { id: 'gezamenlijk', label: 'Gezamenlijk' },
  { id: 'prive', label: 'Privé' },
  { id: 'abonnementen', label: 'Abonnementen' },
]

export default function Kosten() {
  const [activeTab, setActiveTab] = useState('gezamenlijk')
  const [isDark, setIsDark] = useState(false)
  const colors = PAGE_COLORS.kosten
  const c = isDark ? colors.dark : colors.light

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)', marginBottom: 20 }}>Kosten</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                padding: '7px 16px',
                borderRadius: 7,
                cursor: 'pointer',
                border: isActive ? 'none' : `1px solid var(--border)`,
                background: isActive ? (isDark ? colors.bg : colors.light) : 'transparent',
                color: isActive ? (isDark ? colors.dark : '#FFFFFF') : 'var(--muted)',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {activeTab === 'gezamenlijk' && <Gezamenlijk />}
      {activeTab === 'prive' && <Prive />}
      {activeTab === 'abonnementen' && <Abonnementen />}
      <div style={{ position: 'absolute', bottom: -50, right: -50, pointerEvents: 'none', zIndex: 0 }}>
        <svg width="300" height="300" viewBox="0 0 200 200">
          <polygon points="65,18 135,18 192,62 100,175 8,62" fill={c} opacity="0.06" />
          <polygon points="65,18 135,18 100,62" fill={c} opacity="0.1" />
        </svg>
      </div>
    </div>
  )
}
