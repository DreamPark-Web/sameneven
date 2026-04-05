export const MEMBER_COLORS = [
  { bg: '#6366F1', light: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)'  },
  { bg: '#10B981', light: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)'  },
  { bg: '#F59E0B', light: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)'  },
  { bg: '#EC4899', light: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.25)'  },
  { bg: '#3B82F6', light: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)'  },
  { bg: '#EF4444', light: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)'   },
  { bg: '#8B5CF6', light: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)'  },
  { bg: '#14B8A6', light: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.25)'  },
]

export function getMemberColor(index: number) {
  return MEMBER_COLORS[index % MEMBER_COLORS.length]
}
