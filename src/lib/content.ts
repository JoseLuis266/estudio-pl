import syllabus from '../../content/syllabus.json'
import registry from '../../content/laws-registry.json'
import demo from '../../content/demo/demo.json'
import type { Article, Item, LawFile, SourceDef, ThemeDef } from './types'

const files = import.meta.glob('../generated/laws/*.json', { eager: true, import: 'default' }) as Record<string, LawFile>
export const THEMES = syllabus as unknown as ThemeDef[]
export const REGISTRY = registry as { id: string; name: string; short: string; boeId: string | null; expect: string; boibOnly?: boolean }[]
export const LAWS: Record<string, LawFile> = {}
for (const f of Object.values(files)) LAWS[f.id] = f
export const DEMO_LAW = demo as unknown as LawFile

/** Orden de memorización: T18→T30, T7→T17, T1→T6. */
export const DEFAULT_ORDER: number[] = [
  ...range(18, 30), ...range(7, 17), ...range(1, 6)
]
function range(a: number, b: number) { const r: number[] = []; for (let i = a; i <= b; i++) r.push(i); return r }

export const BLOCK_NAME = { 1: 'Bloque 1 · Constitución y organización (T1-T6)', 2: 'Bloque 2 · Tráfico (T7-T17)', 3: 'Bloque 3 · Derecho policial, penal, LOPD, igualdad (T18-T30)' } as const

const baseNum = (num: string) => { const m = /^(\d+)/.exec(num); return m ? parseInt(m[1], 10) : NaN }

/** ¿El artículo entra en el rango "a-b" o "Anexo X"? */
export function inRange(a: Article, r: string): boolean {
  if (/^anexo/i.test(r)) { const n = a.num.toLowerCase(), q = r.toLowerCase(); return n === q || n.startsWith(q + ' ·') }
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(r.trim())
  if (!m) return false
  const n = baseNum(a.num)
  return !isNaN(n) && n >= +m[1] && n <= +m[2]
}

export function parseRanges(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (/^\d+$/.test(x) ? `${x}-${x}` : x))
}

export interface ScopeOverrides { [themeId: number]: string }

/** Artículos (items de estudio) de un tema. Con `demo`, los temas sin contenido real usan el fixture DEMO. */
export function themeItems(t: ThemeDef, demoOn: boolean, overrides: ScopeOverrides = {}): Item[] {
  const out: Item[] = []
  const srcs: SourceDef[] = overrides[t.id] !== undefined
    ? t.sources.map((s) => ({ ...s, whole: false, ranges: parseRanges(overrides[t.id]), conf: 'por-confirmar' as const }))
    : t.sources
  for (const s of srcs) {
    const law = LAWS[s.law]
    if (!law) continue
    const arts = s.whole ? law.articles : law.articles.filter((a) => (s.ranges ?? []).some((r) => inRange(a, r)))
    for (const a of arts) out.push({ id: `t${t.id}:${a.id}`, themeId: t.id, article: a, law, conf: s.conf })
  }
  if (!out.length && demoOn && (t.id === 18 || t.id === 19)) {
    const half = t.id === 18 ? DEMO_LAW.articles.slice(0, 3) : DEMO_LAW.articles.slice(3)
    for (const a of half) out.push({ id: `t${t.id}:${a.id}`, themeId: t.id, article: a, law: DEMO_LAW, conf: 'pendiente' })
  }
  return out
}

export function allItems(demoOn: boolean, overrides: ScopeOverrides = {}): Item[] {
  return THEMES.flatMap((t) => themeItems(t, demoOn, overrides))
}

export const articleLabel = (i: Item) => `${i.law.short} · ${/^anexo/i.test(i.article.num) ? i.article.num : 'art. ' + i.article.num}`
export const articleText = (a: Article) => a.paras.join('\n')
