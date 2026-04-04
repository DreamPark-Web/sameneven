export const PAGE_COLORS = {
  dashboard:    { light: '#6366F1', dark: '#818CF8', bg: 'rgba(99,102,241,0.15)',   logoBg: 'rgba(99,102,241,0.04)'   },
  inkomsten:    { light: '#10B981', dark: '#34D399', bg: 'rgba(16,185,129,0.15)',   logoBg: 'rgba(16,185,129,0.04)'   },
  gezamenlijk:  { light: '#F59E0B', dark: '#FCD34D', bg: 'rgba(245,158,11,0.15)',   logoBg: 'rgba(245,158,11,0.04)'   },
  prive:        { light: '#EC4899', dark: '#F472B6', bg: 'rgba(236,72,153,0.15)',   logoBg: 'rgba(236,72,153,0.04)'   },
  sparen:       { light: '#3B82F6', dark: '#60A5FA', bg: 'rgba(59,130,246,0.15)',   logoBg: 'rgba(59,130,246,0.04)'   },
  schulden:     { light: '#EF4444', dark: '#F87171', bg: 'rgba(239,68,68,0.15)',    logoBg: 'rgba(239,68,68,0.04)'    },
  abonnementen: { light: '#F97316', dark: '#FB923C', bg: 'rgba(249,115,22,0.15)',   logoBg: 'rgba(249,115,22,0.04)'   },
  advies:       { light: '#14B8A6', dark: '#2DD4BF', bg: 'rgba(20,184,166,0.15)',   logoBg: 'rgba(20,184,166,0.04)'   },
  leden:        { light: '#8B5CF6', dark: '#A78BFA', bg: 'rgba(139,92,246,0.15)',   logoBg: 'rgba(139,92,246,0.04)'   },
  kosten:       { light: '#F59E0B', dark: '#FCD34D', bg: 'rgba(245,158,11,0.15)',   logoBg: 'rgba(245,158,11,0.04)'   },
  vermogen:     { light: '#3B82F6', dark: '#60A5FA', bg: 'rgba(59,130,246,0.15)',   logoBg: 'rgba(59,130,246,0.04)'   },
}

export type PageKey = keyof typeof PAGE_COLORS
