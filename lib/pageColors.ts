export const PAGE_COLORS = {
  dashboard: { light: '#6366F1', dark: '#818CF8', bg: 'rgba(99,102,241,0.15)',  logoBg: 'rgba(99,102,241,0.04)',  bgCard: 'rgba(99,102,241,0.06)',  bdCard: 'rgba(99,102,241,0.2)'  },
  inkomsten: { light: '#10B981', dark: '#34D399', bg: 'rgba(16,185,129,0.15)',  logoBg: 'rgba(16,185,129,0.04)',  bgCard: 'rgba(16,185,129,0.06)',  bdCard: 'rgba(16,185,129,0.2)'  },
  kosten:    { light: '#D97706', dark: '#FBBF24', bg: 'rgba(217,119,6,0.15)',   logoBg: 'rgba(217,119,6,0.04)',   bgCard: 'rgba(217,119,6,0.06)',   bdCard: 'rgba(217,119,6,0.2)'   },
  vermogen:  { light: '#3B82F6', dark: '#60A5FA', bg: 'rgba(59,130,246,0.15)',  logoBg: 'rgba(59,130,246,0.04)',  bgCard: 'rgba(59,130,246,0.06)',  bdCard: 'rgba(59,130,246,0.2)'  },
  tips:      { light: '#E11D48', dark: '#FB7185', bg: 'rgba(225,29,72,0.15)',   logoBg: 'rgba(225,29,72,0.04)',   bgCard: 'rgba(225,29,72,0.06)',   bdCard: 'rgba(225,29,72,0.2)'   },
  leden:     { light: '#6366F1', dark: '#818CF8', bg: 'rgba(99,102,241,0.15)',  logoBg: 'rgba(99,102,241,0.04)',  bgCard: 'rgba(99,102,241,0.06)',  bdCard: 'rgba(99,102,241,0.2)'  },
}

export type PageKey = keyof typeof PAGE_COLORS
