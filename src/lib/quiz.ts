import type { Cat, Item, Question } from './types'
import type { State } from './store'
import { genForItem, rng, shuffle, hash } from './generators'
import { dueItems, allThemeItems, themeProgress } from './plan'
import { retrievability } from './srs'

export interface QuizConfig {
  themes?: number[]; block?: 1 | 2 | 3; law?: string; article?: string
  kinds?: ('mcq' | 'tf')[]; cats?: Cat[]
  onlyErrors?: boolean; onlyDue?: boolean; n: number; seed?: number
}

export const validQuestions = (s: State, items: Item[]) => items.flatMap((i) => genForItem(i)).filter((q) => !s.reports[q.id])

/** Peso de selección: errores recurrentes, olvido probable y no preguntadas recientemente primero (cobertura). */
export function weightOf(s: State, q: Question, d: string): number {
  const st = s.qstats[q.id]; const m = s.mem[q.itemId]
  let w = 1
  if (!st) w += 1.5 // nunca preguntada
  else w += st.ko * 1.5 - st.ok * 0.3
  if (s.errors[q.id] && s.errors[q.id].streak < 3) w += 3
  if (m) w += (1 - retrievability(m, d)) * 3
  return Math.max(0.2, w)
}

export function buildQuiz(s: State, cfg: QuizConfig, d: string): Question[] {
  let items = allThemeItems(s)
  if (cfg.themes?.length) items = items.filter((i) => cfg.themes!.includes(i.themeId))
  if (cfg.block) items = items.filter((i) => blockOf(i.themeId) === cfg.block)
  if (cfg.law) items = items.filter((i) => i.law.id === cfg.law)
  if (cfg.article) items = items.filter((i) => i.article.num === cfg.article)
  if (cfg.onlyDue) { const due = new Set(dueItems(s, d).map((x) => x.item.id)); items = items.filter((i) => due.has(i.id)) }
  let qs = validQuestions(s, items).filter((q) => (!cfg.kinds || cfg.kinds.includes(q.kind as 'mcq' | 'tf')) && (!cfg.cats || cfg.cats.includes(q.cat)))
  if (cfg.onlyErrors) qs = Object.values(s.errors).filter((e) => e.q && !s.reports[e.id]).map((e) => e.q!).filter((q) => !cfg.themes?.length || cfg.themes.includes(q.themeId))
  const r = rng(cfg.seed ?? hash(d + qs.length))
  // muestreo ponderado sin reemplazo
  const pool = qs.map((q) => ({ q, k: Math.pow(r(), 1 / weightOf(s, q, d)) })).sort((a, b) => b.k - a.k)
  return shuffle(pool.slice(0, cfg.n).map((x) => x.q), r)
}
export const blockOf = (t: number): 1 | 2 | 3 => (t <= 6 ? 1 : t <= 17 ? 2 : 3)

/** Test semanal mixto: nuevo de la semana + errores + muestra de mantenimiento. */
export function weeklyTest(s: State, weekItems: Item[], d: string, n = 20): Question[] {
  const r = rng(hash('w' + d))
  const nuevo = validQuestions(s, weekItems)
  const err = Object.values(s.errors).filter((e) => e.q && e.streak < 3 && !s.reports[e.id]).map((e) => e.q!)
  const wk = new Set(weekItems.map((i) => i.id))
  const old = validQuestions(s, allThemeItems(s).filter((i) => s.mem[i.id] && !wk.has(i.id) && themeProgress(s, i.themeId, d).memorized > 0))
  const take = (xs: Question[], k: number) => shuffle(xs, r).slice(0, k)
  const seen = new Set<string>()
  return shuffle([...take(nuevo, Math.ceil(n * 0.5)), ...take(err, Math.ceil(n * 0.25)), ...take(old, Math.ceil(n * 0.25))].filter((q) => !seen.has(q.id) && !!seen.add(q.id)), r).slice(0, n)
}

/** Repaso rápido 5 min: errores vencidos + preguntas de artículos vencidos/débiles, números primero. */
export function quick5(s: State, d: string): Question[] {
  const r = rng(hash('q5' + d))
  const errs = Object.values(s.errors).filter((e) => e.q && e.due <= d && e.streak < 3 && !s.reports[e.id]).map((e) => e.q!)
  const due = dueItems(s, d).slice(0, 15).map((x) => x.item)
  const dueQs = validQuestions(s, due).sort((a, b) => (a.cat === 'numero' || a.cat === 'plazo' ? -1 : 0) - (b.cat === 'numero' || b.cat === 'plazo' ? -1 : 0))
  const seen = new Set<string>()
  return [...shuffle(errs, r), ...dueQs].filter((q) => !seen.has(q.id) && !!seen.add(q.id)).slice(0, 12)
}
