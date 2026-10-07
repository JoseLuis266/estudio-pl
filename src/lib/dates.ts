const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) }
export const today = () => iso(new Date())
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
export const weekday = (s: string) => parse(s).getDay() // 0 dom … 6 sáb
export const weekStart = (s: string) => addDays(s, -((weekday(s) + 6) % 7)) // lunes
export const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const fmt = (s: string) => { const d = parse(s); return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()}/${d.getMonth() + 1}` }
