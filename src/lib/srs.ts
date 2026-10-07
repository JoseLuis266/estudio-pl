import { Grade } from './types'
import { addDays, diffDays } from './dates'

/** Escalera inicial exigida: D+1, D+3, D+7, D+14, D+30. Después, crecimiento tipo FSRS-lite (estabilidad/dificultad). */
export const LADDER = [1, 3, 7, 14, 30]

export interface Mem {
  themeId: number
  firstAt: string // D0
  step: number // nº de recuperaciones exitosas encadenadas (posición en la escalera)
  interval: number
  stability: number // días en los que R baja a 0,9
  difficulty: number // 1..10
  due: string
  last: string // última exposición (memorización o repaso)
  reps: number
  lapses: number
  asked: number
  lastRecall?: string
  lastSuccess?: string
  lastFail?: string
}

export function newMem(themeId: number, date: string): Mem {
  return { themeId, firstAt: date, step: 0, interval: LADDER[0], stability: 1, difficulty: 5, due: addDays(date, LADDER[0]), last: date, reps: 0, lapses: 0, asked: 0 }
}

/** Retención estimada (curva FSRS: R(S)=0,9). */
export function retrievability(m: Mem, date: string): number {
  const t = Math.max(0, diffDays(m.last, date))
  return Math.pow(1 + t / (9 * Math.max(m.stability, 0.3)), -1)
}

const DD = [1, 0.3, -0.1, -0.3]

export function review(m: Mem, grade: Grade, date: string, ms?: number): Mem {
  const n: Mem = { ...m, reps: m.reps + 1, asked: m.asked + 1, last: date, lastRecall: date }
  const elapsed = Math.max(0, diffDays(m.last, date))
  let g: Grade = grade
  if (g === 3 && ms != null && ms > 20000) g = 2 // respuesta lenta: no cuenta como "perfecto"
  n.difficulty = Math.min(10, Math.max(1, m.difficulty + DD[g]))
  if (g === 0) {
    n.lapses = m.lapses + 1; n.lastFail = date; n.step = 0; n.interval = 1
    n.stability = Math.max(0.5, m.stability * 0.4)
  } else if (g === 1) {
    n.lastSuccess = date; n.interval = Math.max(1, Math.round(m.interval * 0.5))
    n.stability = Math.max(0.5, m.stability * 0.8)
  } else {
    n.lastSuccess = date
    if (elapsed < m.interval * 0.5) { n.interval = m.interval } // repaso prematuro: no avanza escalera
    else {
      const next = m.step + (g === 3 ? 2 : 1)
      let iv = next < LADDER.length ? LADDER[next] : Math.round(Math.max(m.interval, LADDER[LADDER.length - 1]) * (g === 3 ? 3 : 2.2))
      if (n.difficulty > 7.5) iv *= 0.8
      else if (n.difficulty < 3) iv *= 1.15
      n.step = Math.min(next, LADDER.length + 6)
      n.interval = Math.min(365, Math.max(1, Math.round(iv)))
    }
    n.stability = Math.max(m.stability, n.interval)
  }
  n.due = addDays(date, n.interval)
  return n
}

/** Registra una exposición (p. ej. aparecer en un test) sin tocar el calendario si no hay resultado de recuerdo. */
export function touch(m: Mem, date: string, ok: boolean): Mem {
  const n = { ...m, asked: m.asked + 1, last: m.last, lastRecall: date }
  if (ok) n.lastSuccess = date
  else { n.lastFail = date; if (n.due > addDays(date, 1)) n.due = addDays(date, 1) }
  return n
}
