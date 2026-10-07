import type { State } from './store'
import { allThemeItems, dueItems, themePhase, itemsOf } from './plan'
import { THEMES } from './content'
import { retrievability } from './srs'
import { diffDays, addDays } from './dates'
import { genForItem, flashcards, findHits } from './generators'
import { CAT_LABEL, Cat, Phase } from './types'

export function dashboard(s: State, d: string) {
  const items = allThemeItems(s)
  const mems = items.map((i) => s.mem[i.id]).filter(Boolean)
  const phases: Record<Phase, number> = { NO_INICIADO: 0, PRIMERA: 0, CONSOLIDACION: 0, MANTENIMIENTO: 0, DOMINADO: 0 }
  THEMES.forEach((t) => { phases[themePhase(s, t.id, d)]++ })
  const retention = mems.length ? mems.reduce((a, m) => a + retrievability(m, d), 0) / mems.length : 0
  const covered = mems.filter((m) => m.lastRecall && diffDays(m.lastRecall, d) <= s.settings.coverageDays).length
  const due = dueItems(s, d)
  const errorsPending = Object.values(s.errors).filter((e) => e.streak < 3).length
  const minutes = Math.round(s.events.reduce((a, e) => a + Math.min(e.ms ?? 0, 120000), 0) / 60000)
  const days = new Set(s.events.map((e) => e.d))
  let streak = 0
  for (let x = days.has(d) ? d : addDays(d, -1); days.has(x); x = addDays(x, -1)) streak++
  return { phases, retention, coverage: items.length ? covered / items.length : 0, itemsTotal: items.length, memorized: mems.length, dueToday: due.filter((x) => x.mem.due === d).length, overdue: due.filter((x) => x.mem.due < d).length, errorsPending, minutes, streak, daysStudied: days.size }
}

/** Debilidades por tipo de dato (fallos / intentos en tests y detecta-error). */
export function weaknesses(s: State): { cat: Cat; label: string; asked: number; failRate: number }[] {
  const acc: Record<string, { a: number; f: number }> = {}
  for (const e of s.events) {
    if (!e.k.startsWith('q:') || !e.x) continue
    const r = (acc[e.x] ??= { a: 0, f: 0 }); r.a++; if (!e.ok) r.f++
  }
  return Object.entries(acc).map(([cat, r]) => ({ cat: cat as Cat, label: CAT_LABEL[cat as Cat], asked: r.a, failRate: r.f / r.a })).filter((x) => x.asked >= 3).sort((a, b) => b.failRate - a.failRate)
}

/** Cobertura del CONTENIDO incorporado (honesta: no presenta como completo lo que no lo está). */
export function contentCoverage(s: State, laws: Record<string, { verified: boolean }>) {
  const items = allThemeItems(s)
  const themesWith = THEMES.filter((t) => itemsOf(s, t.id).length > 0).length
  const themesPending = THEMES.filter((t) => t.pending || t.sources.every((x) => x.conf === 'pendiente')).length
  let q = 0, fc = 0, cz = 0, withQ = 0, neverAsked = 0
  for (const i of items) {
    const qs = genForItem(i).filter((x) => !s.reports[x.id])
    q += qs.length; cz += qs.filter((x) => x.kind === 'mcq' && x.cat !== 'articulo').length; fc += flashcards(i, s.notes[i.id]).length
    if (qs.length) withQ++
    if (!qs.some((x) => s.qstats[x.id]) && !s.mem[i.id]?.asked) neverAsked++
  }
  const verified = items.filter((i) => laws[i.law.id]?.verified).length
  const demo = items.filter((i) => i.law.demo).length
  return { themes: THEMES.length, themesWith, themesPending, articles: items.length, demo, verifiedPct: items.length ? verified / items.length : 0, questions: q, flashcards: fc, cloze: cz, withQuestionsPct: items.length ? withQ / items.length : 0, neverAskedPct: items.length ? neverAsked / items.length : 0, hits: items.reduce((a, i) => a + findHits(i.article.paras.join(' ')).length, 0) }
}
