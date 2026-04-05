'use client'

import { useState, useEffect } from 'react'
import { useInsight } from '@/lib/insight-context'
import { PAGE_COLORS } from '@/lib/pageColors'
import { getRelevanteTips, type Tip } from '@/lib/tips'

const CATEGORIE_LABELS: Record<string, string> = {
  buffer: 'Buffer',
  schulden: 'Schulden',
  sparen: 'Sparen',
  kosten: 'Kosten',
  verdeling: 'Verdeling',
  algemeen: 'Algemeen',
}

const CATEGORIE_ORDER = ['buffer', 'schulden', 'sparen', 'kosten', 'verdeling', 'algemeen']

function priorityStyle(prioriteit: Tip['prioriteit'], isDark: boolean): { color: string; bg: string; border: string; label: string } {
  if (prioriteit === 'hoog') {
    return {
      color: isDark ? '#FB923C' : '#EA580C',
      bg: 'rgba(234,88,12,0.06)',
      border: '1px solid rgba(234,88,12,0.2)',
      label: 'AANDACHT',
    }
  }
  if (prioriteit === 'medium') {
    return {
      color: isDark ? '#60A5FA' : '#2563EB',
      bg: 'rgba(37,99,235,0.06)',
      border: '1px solid rgba(37,99,235,0.2)',
      label: 'TIP',
    }
  }
  return {
    color: isDark ? '#9CA3AF' : '#6B7280',
    bg: 'rgba(107,114,128,0.06)',
    border: '1px solid rgba(107,114,128,0.2)',
    label: 'INFO',
  }
}

function goTo(page: string, tab?: string) {
  const params = new URLSearchParams(window.location.search)
  params.set('page', page)
  if (tab) params.set('tab', tab); else params.delete('tab')
  window.history.replaceState(null, '', `?${params.toString()}`)
  window.dispatchEvent(new CustomEvent('se-navigate', { detail: { page } }))
}

export default function Tips() {
  const { data, isSingleUser } = useInsight()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const colors = PAGE_COLORS.tips
  const c = isDark ? colors.dark : colors.light

  const tips = getRelevanteTips(data, isSingleUser)

  const grouped: Record<string, Tip[]> = {}
  for (const tip of tips) {
    if (!grouped[tip.categorie]) grouped[tip.categorie] = []
    grouped[tip.categorie].push(tip)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>Tips</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          {isSingleUser
            ? 'Persoonlijke tips op basis van wat je hebt ingevuld...'
            : 'Persoonlijke tips op basis van wat jullie hebben ingevuld...'}
        </div>
      </div>

      {tips.length === 0 ? (
        <div style={{ borderRadius: 8, padding: '16px 18px', border: '1px solid var(--card-border)', background: 'var(--s3)', fontSize: 14, color: 'var(--muted2)' }}>
          Alles ziet er goed uit! Kom later nog eens terug.
        </div>
      ) : (
        CATEGORIE_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
              {CATEGORIE_LABELS[cat]}
            </div>
            {grouped[cat].map((tip) => {
              const ps = priorityStyle(tip.prioriteit, isDark)
              return (
                <div
                  key={tip.id}
                  style={{ borderRadius: 8, padding: '16px 18px', marginBottom: 10, border: ps.border, background: ps.bg }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6, color: ps.color }}>
                    {ps.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: tip.actie ? 8 : 6, fontFamily: 'var(--font-heading)' }}>
                    {tip.titel}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.75, marginBottom: tip.actie ? 12 : 0 }}>
                    {tip.tekst}
                  </div>
                  {tip.actie && (
                    <button
                      onClick={() => goTo(tip.actie!.pagina, tip.actie!.tab)}
                      style={{
                        display: 'inline-block',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: `1px solid ${ps.color}`,
                        color: ps.color,
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {tip.actie.label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
