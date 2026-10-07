import type { Item, Phase } from './types'
import type { State } from './store'
import { addDays, weekStart, weekday, diffDays } from './dates'
import { Mem, retrievability } from './srs'
import { THEMES, themeItems } from './content'

export const isStudyDay = (d: string, s: State) => weekday(d) !== s.settings.restDay
export const dayMode = (d: string): 'normal' | 'sabado' | 'domingo' => (weekday(d) === 6 ? 'sabado' : weekday(d) === 0 ? 'domingo' : 'normal')

export const itemsOf = (s: State, themeId: number): Item[] => themeItems(THEMES[themeId - 1], s.settings.demo, s.settings.scope)
export const allThemeItems = (s: State): Item[] => THEMES.flatMap((t) => itemsOf(s, t.id))

export interface ThemeProg { total: number; memorized: number; first?: string; last?: string; next?: string; reps: number; avgR: number; coverage: number; stability: number; lapses: number; maxStep: number; minStep: number }
export function themeProgress(s: State, themeId: number, d: string, items = itemsOf(s, themeId)): ThemeProg {
  const ms = items.map((i) => s.mem[i.id]).filter(Boolean) as Mem[]
  const cov = ms.filter((m) => m.lastRecall && diffDays(m.lastRecall, d) <= s.settings.coverageDays).length
  const firsts = ms.map((m) => m.firstAt).sort()
  return {
    total: items.length, memorized: ms.length, first: firsts[0],
    last: ms.map((m) => m.last).sort().pop(), next: ms.map((m) => m.due).sort()[0],
    reps: ms.reduce((a, m) => a + m.reps, 0),
    avgR: ms.length ? ms.reduce((a, m) => a + retrievability(m, d), 0) / ms.length : 0,
    coverage: items.length ? cov / items.length : 0,
    stability: ms.length ? ms.reduce((a, m) => a + m.stability, 0) / ms.length : 0,
    lapses: ms.reduce((a, m) => a + m.lapses, 0),
    maxStep: Math.max(0, ...ms.map((m) => m.step)), minStep: ms.length ? Math.min(...ms.map((m) => m.step)) : 0
  }
}

export function themePhase(s: State, themeId: number, d: string): Phase {
  const items = itemsOf(s, themeId); const p = themeProgress(s, themeId, d, items)
  if (!p.memorized) return 'NO_INICIADO'
  if (p.memorized < p.total) return 'PRIMERA'
  const ms = items.map((i) => s.mem[i.id])
  if (ms.every((m) => m.stability >= 60 && retrievability(m, d) >= 0.85 && (!m.lastFail || diffDays(m.lastFail, d) > 30))) return 'DOMINADO'
  return p.minStep >= 3 ? 'MANTENIMIENTO' : 'CONSOLIDACION'
}

/** Salud 0..1 combinando retención estimada y cobertura (no solo percepción). */
export function themeHealth(s: State, themeId: number, d: string): { score: number; label: 'FLOJO' | 'REGULAR' | 'BIEN' | 'DOMINADO' | null } {
  const p = themeProgress(s, themeId, d)
  if (!p.memorized) return { score: 0, label: null }
  const acc = p.reps ? 1 - p.lapses / p.reps : 1
  const score = (p.avgR * 0.5 + p.coverage * 0.25 + acc * 0.25) * (p.memorized / Math.max(1, p.total))
  const label = themePhase(s, themeId, d) === 'DOMINADO' ? 'DOMINADO' : score >= 0.75 ? 'BIEN' : score >= 0.5 ? 'REGULAR' : 'FLOJO'
  return { score, label }
}

/** Tema de memorización de hoy: asignación manual > tema en curso (incompleto) > siguiente del orden. */
export function todayTheme(s: State, d: string): number | null {
  if (!isStudyDay(d, s) || weekday(d) === 6) return null // el sábado no hay contenido nuevo
  if (s.assignments[d]) return s.assignments[d]
  const order = s.settings.order
  const done = (id: number) => { const it = itemsOf(s, id); return s.skipped[id] || (it.length > 0 && it.every((i) => s.mem[i.id])) }
  const inProgress = order.find((id) => { const it = itemsOf(s, id); return it.length && it.some((i) => s.mem[i.id]) && !done(id) })
  if (inProgress) return inProgress
  return order.find((id) => itemsOf(s, id).length > 0 && !done(id)) ?? order.find((id) => !done(id)) ?? null
}

export interface DueItem { item: Item; mem: Mem; r: number; prio: number; overdue: number }
export function dueItems(s: State, d: string): DueItem[] {
  const all = allThemeItems(s)
  const out: DueItem[] = []
  for (const item of all) {
    const m = s.mem[item.id]
    if (!m || m.due > d) continue
    const overdue = diffDays(m.due, d); const r = retrievability(m, d)
    const diff = s.notes[item.id]?.status === 'DIFICIL' ? 3 : 0
    out.push({ item, mem: m, r, overdue, prio: overdue + (1 - r) * 10 + m.lapses * 2 + diff })
  }
  return out.sort((a, b) => b.prio - a.prio)
}

export interface DayPlan {
  date: string; mode: 'normal' | 'sabado' | 'domingo'; restDay: boolean
  newTheme: number | null
  classThemes: number[] // clase del tema nuevo + clases pendientes de temas ya empezados
  reviews: DueItem[]; deferred: DueItem[]
  errorsDue: number
  estMin: number
  weeklyThemes: number[]
}

export function weeklyItems(s: State, d: string): Item[] {
  const ws = weekStart(d), we = addDays(ws, 5)
  return allThemeItems(s).filter((i) => { const m = s.mem[i.id]; return m && m.firstAt >= ws && m.firstAt <= we })
}

export function buildDay(s: State, d: string): DayPlan {
  const mode = dayMode(d); const restDay = !isStudyDay(d, s)
  const newTheme = todayTheme(s, d)
  const due = restDay ? [] : dueItems(s, d)
  const errorsDue = Object.values(s.errors).filter((e) => e.due <= d && e.streak < 3).length
  // Clases pendientes: la del tema nuevo de hoy y, además, cualquier clase aún sin ver de temas ya empezados
  const classThemes: number[] = []
  if (!restDay && mode !== 'sabado') {
    if (newTheme && !s.classes[newTheme]?.seen) classThemes.push(newTheme)
    for (const id of s.settings.order) if (!classThemes.includes(id) && themeProgress(s, id, d).memorized > 0 && !s.classes[id]?.seen) classThemes.push(id)
  }
  const classMin = classThemes.length ? s.settings.classMinutes : 0
  const budgetSec = Math.max(0, s.settings.minAfternoon - classMin) * 60 - errorsDue * 20
  const cap = Math.min(s.settings.maxItemsDay, Math.max(0, Math.floor(budgetSec / s.settings.secPerItem)))
  const reviews = due.slice(0, cap)
  const deferred = due.slice(cap)
  const weeklyThemes = [...new Set(weeklyItems(s, d).map((i) => i.themeId))]
  const estMin = Math.round(((newTheme ? s.settings.minMorning : 0) + classMin + (reviews.length * s.settings.secPerItem + errorsDue * 20) / 60))
  return { date: d, mode, restDay, newTheme, classThemes, reviews, deferred, errorsDue, estMin, weeklyThemes }
}

export const groupByTheme = (xs: DueItem[]) => {
  const g = new Map<number, DueItem[]>()
  xs.forEach((x) => g.set(x.item.themeId, [...(g.get(x.item.themeId) ?? []), x]))
  return [...g.entries()].map(([themeId, items]) => ({ themeId, items }))
}

/** Contenido memorizado que no ha pasado por recuperación en la ventana de cobertura, aunque nunca haya fallado. */
export function staleItems(s: State, d: string): Item[] {
  return allThemeItems(s).filter((i) => { const m = s.mem[i.id]; return m && diffDays(m.lastRecall ?? m.firstAt, d) > s.settings.coverageDays })
}
