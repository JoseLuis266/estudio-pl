import { describe, it, expect } from 'vitest'
import { newMem, review, retrievability, LADDER } from '../src/lib/srs'
import { addDays, weekday, weekStart } from '../src/lib/dates'

const D0 = '2026-10-05' // lunes
describe('escalera D+1/D+3/D+7/D+14/D+30', () => {
  it('primera memorización programa D+1', () => { expect(newMem(18, D0).due).toBe(addDays(D0, 1)) })
  it('aciertos "Bien" recorren 1→3→7→14→30', () => {
    let m = newMem(18, D0); const got: number[] = [m.interval]
    for (let i = 0; i < 4; i++) { m = review(m, 2, m.due); got.push(m.interval) }
    expect(got).toEqual(LADDER.slice(0, 5)); expect(got.at(-1)).toBe(30)
  })
  it('fechas absolutas D+1, D+4, D+11, D+25, D+55', () => {
    let m = newMem(18, D0); const due: string[] = [m.due]
    for (let i = 0; i < 4; i++) { m = review(m, 2, m.due); due.push(m.due) }
    expect(due).toEqual([1, 4, 11, 25, 55].map((n) => addDays(D0, n)))
  })
})
describe('fallos y dominio', () => {
  it('fallo grave adelanta el siguiente repaso a 1 día y reinicia escalera', () => {
    let m = newMem(18, D0); for (let i = 0; i < 3; i++) m = review(m, 2, m.due)
    expect(m.interval).toBe(14)
    const f = review(m, 0, m.due); expect(f.interval).toBe(1); expect(f.step).toBe(0); expect(f.lapses).toBe(1)
  })
  it('"Parcial" acorta el intervalo sin avanzar escalera', () => {
    let m = newMem(18, D0); m = review(m, 2, m.due); const p = review(m, 1, m.due); expect(p.interval).toBeLessThan(m.interval); expect(p.step).toBe(m.step)
  })
  it('tema dominado: los intervalos crecen más allá de 30 días', () => {
    let m = newMem(18, D0); const ivs: number[] = []
    for (let i = 0; i < 8; i++) { m = review(m, 3, m.due, 3000); ivs.push(m.interval) }
    expect(ivs.at(-1)!).toBeGreaterThan(60); expect(ivs.at(-1)!).toBeLessThanOrEqual(365)
    for (let i = 1; i < ivs.length; i++) expect(ivs[i]).toBeGreaterThanOrEqual(ivs[i - 1])
  })
  it('respuesta lenta degrada "Perfecto" a "Bien"', () => {
    const m = newMem(18, D0); expect(review(m, 3, m.due, 60000).interval).toBe(review(m, 2, m.due).interval)
  })
  it('repaso prematuro no avanza la escalera', () => {
    let m = newMem(18, D0); m = review(m, 2, m.due) // intervalo 3
    const early = review(m, 2, addDays(m.last, 1)); expect(early.step).toBe(m.step)
  })
  it('retención estimada: 0,9 en t=estabilidad y decrece', () => {
    const m = { ...newMem(1, D0), stability: 10, last: D0 }
    expect(retrievability(m, addDays(D0, 10))).toBeCloseTo(0.9, 2)
    expect(retrievability(m, addDays(D0, 60))).toBeLessThan(retrievability(m, addDays(D0, 10)))
  })
})
describe('fechas', () => {
  it('días de la semana y lunes de semana', () => {
    expect(weekday('2026-10-07')).toBe(3); expect(weekday('2026-10-10')).toBe(6); expect(weekday('2026-10-11')).toBe(0)
    expect(weekStart('2026-10-10')).toBe('2026-10-05'); expect(weekStart('2026-10-11')).toBe('2026-10-05')
  })
  it('cambio de mes/año', () => { expect(addDays('2026-12-31', 1)).toBe('2027-01-01') })
})
