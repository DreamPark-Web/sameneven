export function fmt(n: number, d = 2) {
  return '\u20AC\u00a0' + n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function fmtK(n: number) {
  return '\u20AC\u00a0' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function sum(arr: { value: number }[]) {
  return (arr || []).reduce((a, i) => a + (i.value || 0), 0)
}
