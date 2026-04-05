export function fmt(n: number, d = 2) {
  return '\u20AC\u00a0' + n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function fmtK(n: number, decimals = 0) {
  if (decimals > 0) {
    return '\u20AC\u00a0' + n.toLocaleString('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }
  return '\u20AC\u00a0' + Math.round(n).toLocaleString('nl-NL', { maximumFractionDigits: 0 })
}

export function sum(arr: { value: number }[]) {
  return (arr || []).reduce((a, i) => a + (i.value || 0), 0)
}
