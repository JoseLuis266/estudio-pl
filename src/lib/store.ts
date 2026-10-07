import { useSyncExternalStore } from 'react'
import type { Grade, Question } from './types'
import { Mem, newMem, review, touch, LADDER } from './srs'
import { addDays } from './dates'
import { DEFAULT_ORDER } from './content'
import type { Note } from './generators'

export interface Settings {
  minMorning: number; minAfternoon: number; maxItemsDay: number; secPerItem: number
  restDay: number // 0 = domingo
  order: number[]; coverageDays: number; demo: boolean; scope: Record<number, string>
  classMinutes: number
}
export interface Ev { d: string; k: string; itemId?: string; themeId?: number; g?: Grade; ok?: boolean; ms?: number; x?: string }
export interface ErrRec { id: string; kind: 'q' | 'item'; itemId: string; themeId: number; q?: Question; given?: string; fails: number; streak: number; first: string; lastFail: string; lastOk?: string; due: string }
export interface ClassRec { seen: boolean; date?: string; minutes?: number; notes?: string; doubts?: string; key?: string }
export interface MatRec { id: string; title: string; themeId?: number; itemId?: string; text: string; origin: 'personal' | 'academia'; file?: string; at: string }
export interface Attempt { id: string; d: string; kind: string; n: number; ok: number; ko: number; blank: number; score: number; sec: number; weak: Record<string, number> }

export interface State {
  v: 1
  settings: Settings
  mem: Record<string, Mem>
  events: Ev[]
  errors: Record<string, ErrRec>
  classes: Record<number, ClassRec>
  assignments: Record<string, number>
  notes: Record<string, Note>
  reports: Record<string, { reason: string; at: string }>
  weekly: Record<string, { done: boolean; at?: string; grades: Record<string, Grade> }>
  attempts: Attempt[]
  qstats: Record<string, { asked: number; ok: number; ko: number; last: string }>
  skipped: Record<string, true> // temas "dar por terminado" sin memorizar todo
  material: MatRec[] // MATERIAL PERSONAL: separado siempre del texto oficial
}

export const defaultState = (): State => ({
  v: 1,
  settings: { minMorning: 120, minAfternoon: 150, maxItemsDay: 60, secPerItem: 40, restDay: 0, order: DEFAULT_ORDER, coverageDays: 30, demo: false, scope: {}, classMinutes: 60 },
  mem: {}, events: [], errors: {}, classes: {}, assignments: {}, notes: {}, reports: {}, weekly: {}, attempts: [], qstats: {}, skipped: {}, material: []
})

// ---------- reductores puros (testeables) ----------
const ev = (s: State, e: Ev): State => ({ ...s, events: [...s.events, e].slice(-60000) })

export function memorize(s: State, itemId: string, themeId: number, d: string, grade: Grade, ms = 0): State {
  const m = s.mem[itemId] ?? newMem(themeId, d)
  const mem = { ...m, lastRecall: d, asked: m.asked + 1, ...(grade === 0 ? { lastFail: d } : { lastSuccess: d }) }
  let n: State = { ...s, mem: { ...s.mem, [itemId]: mem } }
  if (grade === 0) n = { ...n, notes: { ...n.notes, [itemId]: { ...n.notes[itemId], status: 'DIFICIL' } } }
  else if (n.notes[itemId]?.status === 'DIFICIL' && grade >= 2) n = { ...n, notes: { ...n.notes, [itemId]: { ...n.notes[itemId], status: undefined } } }
  return ev(n, { d, k: 'memorize', itemId, themeId, g: grade, ms })
}

export function reviewItem(s: State, itemId: string, d: string, grade: Grade, kind = 'review', ms?: number): State {
  const m = s.mem[itemId]
  if (!m) return s
  let n: State = { ...s, mem: { ...s.mem, [itemId]: review(m, grade, d, ms) } }
  n = ev(n, { d, k: kind, itemId, themeId: m.themeId, g: grade, ms })
  if (grade <= 1) n = failItem(n, itemId, m.themeId, d)
  else n = okError(n, 'item:' + itemId, d)
  return n
}

function failItem(s: State, itemId: string, themeId: number, d: string): State {
  const id = 'item:' + itemId
  const e = s.errors[id]
  return { ...s, errors: { ...s.errors, [id]: { id, kind: 'item', itemId, themeId, fails: (e?.fails ?? 0) + 1, streak: 0, first: e?.first ?? d, lastFail: d, lastOk: e?.lastOk, due: addDays(d, 1) } } }
}
function okError(s: State, id: string, d: string): State {
  const e = s.errors[id]
  if (!e) return s
  const streak = e.streak + 1
  return { ...s, errors: { ...s.errors, [id]: { ...e, streak, lastOk: d, due: addDays(d, LADDER[Math.min(streak, LADDER.length - 1)]) } } }
}

export function answerQuestion(s: State, q: Question, given: string, d: string, ms?: number): State {
  const ok = given === q.answer
  const st = s.qstats[q.id] ?? { asked: 0, ok: 0, ko: 0, last: d }
  let n: State = { ...s, qstats: { ...s.qstats, [q.id]: { asked: st.asked + 1, ok: st.ok + (ok ? 1 : 0), ko: st.ko + (ok ? 0 : 1), last: d } } }
  if (n.mem[q.itemId]) n = { ...n, mem: { ...n.mem, [q.itemId]: touch(n.mem[q.itemId], d, ok) } }
  if (!ok) {
    const e = n.errors[q.id]
    n = { ...n, errors: { ...n.errors, [q.id]: { id: q.id, kind: 'q', itemId: q.itemId, themeId: q.themeId, q, given, fails: (e?.fails ?? 0) + 1, streak: 0, first: e?.first ?? d, lastFail: d, lastOk: e?.lastOk, due: addDays(d, 1) } } }
  } else n = okError(n, q.id, d)
  return ev(n, { d, k: 'q:' + q.kind, itemId: q.itemId, themeId: q.themeId, ok, ms, x: q.cat })
}

export function setClass(s: State, themeId: number, c: Partial<ClassRec>, d: string): State {
  return ev({ ...s, classes: { ...s.classes, [themeId]: { ...s.classes[themeId], ...c, seen: c.seen ?? s.classes[themeId]?.seen ?? false } } }, { d, k: 'class', themeId, ok: c.seen })
}
export function setNote(s: State, itemId: string, n: Partial<Note>): State { return { ...s, notes: { ...s.notes, [itemId]: { ...s.notes[itemId], ...n } } } }
export function reportQuestion(s: State, qid: string, reason: string, d: string): State { return { ...s, reports: { ...s.reports, [qid]: { reason, at: d } } } }
export function assignTheme(s: State, d: string, themeId: number): State { return { ...s, assignments: { ...s.assignments, [d]: themeId } } }
export function saveAttempt(s: State, a: Attempt): State { return ev({ ...s, attempts: [...s.attempts, a] }, { d: a.d, k: 'attempt:' + a.kind, ms: a.sec * 1000 }) }
export function completeWeekly(s: State, week: string, grades: Record<string, Grade>, d: string): State {
  let n: State = { ...s, weekly: { ...s.weekly, [week]: { done: true, at: d, grades } } }
  for (const [id, g] of Object.entries(grades)) n = reviewItem(n, id, d, g, 'weekly')
  return n
}

// ---------- persistencia ----------
const KEY = 'pl-estudio-v1'
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function loadState(storage: KV | null): State {
  try {
    const raw = storage?.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch { /* corrupto: cae al estado por defecto (no se pisa hasta el siguiente guardado) */ }
  return defaultState()
}
export function migrate(o: any): State {
  const d = defaultState()
  if (!o || o.v !== 1) throw new Error('Formato de copia no válido')
  return { ...d, ...o, settings: { ...d.settings, ...o.settings } }
}
export function saveState(s: State, storage: KV | null) { try { storage?.setItem(KEY, JSON.stringify(s)) } catch { /* cuota */ } }
export const exportJSON = (s: State) => JSON.stringify({ app: 'oposicion-pl', exportedAt: new Date().toISOString(), ...s }, null, 1)
export function importJSON(txt: string): State { const o = JSON.parse(txt); delete o.app; delete o.exportedAt; return migrate(o) }

// ---------- store reactivo ----------
const ls = (): KV | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }
let state: State = loadState(ls())
const subs = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
export const getState = () => state
export function update(fn: (s: State) => State) {
  state = fn(state)
  subs.forEach((f) => f())
  clearTimeout(timer); timer = setTimeout(() => saveState(state, ls()), 200)
}
export function replaceState(s: State) { update(() => s) }
export const useStore = <T,>(sel: (s: State) => T): T => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => sel(state))
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => saveState(state, ls()))

const MAX_MAT = 400_000 // caracteres por documento (texto plano; nunca se ejecuta)
export function addMaterial(s: State, m: Omit<MatRec, 'id' | 'at'>, d: string): State {
  const rec: MatRec = { ...m, title: m.title.trim().slice(0, 200) || 'Sin título', text: m.text.slice(0, MAX_MAT), id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: d }
  return { ...s, material: [...s.material, rec] }
}
export const deleteMaterial = (s: State, id: string): State => ({ ...s, material: s.material.filter((m) => m.id !== id) })

export function recordFlash(s: State, itemId: string, kind: string, ok: boolean, d: string, ms: number): State {
  const m = s.mem[itemId]
  const n = m ? { ...s, mem: { ...s.mem, [itemId]: touch(m, d, ok) } } : s
  return ev(n, { d, k: 'flash:' + kind, itemId, themeId: m?.themeId, ok, ms })
}
