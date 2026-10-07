import { describe, it, expect } from 'vitest'
import { defaultState, memorize, reviewItem, setClass, completeWeekly, State } from '../src/lib/store'
import { buildDay, todayTheme, weeklyItems, dueItems, itemsOf, themePhase, themeProgress, themeHealth, staleItems } from '../src/lib/plan'
import { dashboard } from '../src/lib/stats'
import { addDays } from '../src/lib/dates'

const MON = '2026-10-05', TUE = '2026-10-06', WED = '2026-10-07', THU = '2026-10-08', FRI = '2026-10-09', SAT = '2026-10-10', SUN = '2026-10-11', MON2 = '2026-10-12'
const base = (): State => { const s = defaultState(); s.settings.demo = true; return s }
const memAll = (s: State, theme: number, d: string) => itemsOf(s, theme).reduce((acc, i) => memorize(acc, i.id, theme, d, 2), s)

describe('plan diario', () => {
  it('con demo, T18 y T19 tienen artículos; el orden empieza en T18', () => {
    const s = base(); expect(itemsOf(s, 18).length).toBeGreaterThan(0); expect(todayTheme(s, MON)).toBe(18)
  })
  it('lun-vie: tema nuevo; sábado y domingo: NO hay memorización nueva', () => {
    const s = base(); expect(todayTheme(s, WED)).toBe(18); expect(todayTheme(s, SAT)).toBeNull(); expect(todayTheme(s, SUN)).toBeNull()
    expect(buildDay(s, SUN).restDay).toBe(true); expect(buildDay(s, SUN).reviews).toHaveLength(0)
  })
  it('tema memorizado miércoles aparece sábado (repaso integral y vencido si no se repasó)', () => {
    let s = memAll(base(), 18, WED)
    expect(weeklyItems(s, SAT).map((i) => i.themeId)).toContain(18)
    expect(dueItems(s, SAT).some((x) => x.item.themeId === 18)).toBe(true)
  })
  it('tema memorizado viernes aparece sábado', () => {
    const s = memAll(base(), 18, FRI)
    expect(weeklyItems(s, SAT)).toHaveLength(itemsOf(s, 18).length); expect(dueItems(s, SAT).length).toBe(itemsOf(s, 18).length)
  })
  it('semana siguiente: lo del lunes anterior ya no es "nuevo de la semana"', () => {
    const s = memAll(base(), 18, MON); expect(weeklyItems(s, addDays(SAT, 7))).toHaveLength(0)
  })
  it('ejemplo del enunciado: T18 d1, T19 d2 → día 3: T18 D+3 no vence aún (D+1 ya hecho), T19 D+1 sí', () => {
    let s = memAll(base(), 18, MON)
    for (const i of itemsOf(s, 18)) s = reviewItem(s, i.id, TUE, 2) // D+1 de T18 → próximo en 3 días (jueves)
    s = memAll(s, 19, TUE)
    const wed = dueItems(s, WED).map((x) => x.item.themeId)
    expect(wed).toContain(19); expect(wed).not.toContain(18) // T18 no aparece solo por ser antiguo
    const fri = dueItems(s, FRI).map((x) => x.item.themeId); expect(fri).toContain(18) // D+1 repasado el martes → siguiente a 3 días
  })
  it('cambio de bloque: al terminar T18-T30 se pasa a T7 y el bloque anterior sigue en mantenimiento', () => {
    let s = memAll(base(), 18, MON); s = memAll(s, 19, TUE)
    s = { ...s, skipped: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [18 + i, true as const])) }
    expect(todayTheme(s, WED)).toBe(7)
    expect(dueItems(s, WED).some((x) => x.item.themeId === 18)).toBe(true) // sigue apareciendo cuando vence
  })
  it('cambio T7-T17 → T1-T6 mantiene ambos bloques anteriores', () => {
    let s = base(); s = { ...s, skipped: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i + 7, true as const])) }
    expect(todayTheme(s, WED)).toBe(1)
    s = memAll(s, 18, MON); expect(dueItems(s, TUE).some((x) => x.item.themeId === 18)).toBe(true)
  })
  it('clase pendiente sigue apareciendo hasta marcarse vista', () => {
    let s = base(); expect(buildDay(s, WED).classThemes).toEqual([18])
    s = memAll(s, 18, WED); expect(buildDay(s, THU).classThemes).toContain(18)
    s = setClass(s, 18, { seen: true, date: THU }, THU); expect(buildDay(s, FRI).classThemes).not.toContain(18)
  })
  it('exceso de repasos: se prioriza, no se borra (lo diferido sigue vencido)', () => {
    let s = memAll(base(), 18, MON); s = memAll(s, 19, MON)
    s.settings.minAfternoon = 1; s.settings.classMinutes = 0; s.settings.secPerItem = 40
    const p = buildDay(s, TUE); expect(p.reviews.length + p.deferred.length).toBe(itemsOf(s, 18).length + itemsOf(s, 19).length)
    expect(p.deferred.length).toBeGreaterThan(0)
    expect(buildDay(s, addDays(TUE, 1)).reviews.length + buildDay(s, addDays(TUE, 1)).deferred.length).toBeGreaterThanOrEqual(p.deferred.length)
  })
  it('un fallo en el repaso crea error pendiente y adelanta el repaso', () => {
    let s = memAll(base(), 18, MON); const id = itemsOf(s, 18)[0].id
    s = reviewItem(s, id, TUE, 0); expect(Object.values(s.errors).length).toBe(1); expect(s.mem[id].due).toBe(WED)
  })
  it('sábado: completar repaso integral aplica las valoraciones', () => {
    let s = memAll(base(), 18, WED); const its = itemsOf(s, 18)
    s = completeWeekly(s, '2026-10-05', Object.fromEntries(its.map((i, k) => [i.id, k === 0 ? 0 : 2])) as any, SAT)
    expect(s.weekly['2026-10-05'].done).toBe(true); expect(s.mem[its[0].id].lapses).toBe(1)
  })
  it('estados de tema y salud', () => {
    let s = base(); expect(themePhase(s, 18, WED)).toBe('NO_INICIADO')
    const its = itemsOf(s, 18); s = memorize(s, its[0].id, 18, WED, 2); expect(themePhase(s, 18, WED)).toBe('PRIMERA')
    s = memAll(s, 18, WED); expect(themePhase(s, 18, WED)).toBe('CONSOLIDACION')
    expect(themeHealth(s, 18, WED).label).not.toBeNull()
  })
  it('cobertura baja si no se recupera en 30 días aunque nunca haya fallado', () => {
    const s = memAll(base(), 18, MON)
    expect(themeProgress(s, 18, addDays(MON, 3)).coverage).toBe(1)
    expect(themeProgress(s, 18, addDays(MON, 45)).coverage).toBe(0)
  })
  it('detecta contenido no revisado recientemente aunque nunca haya fallado', () => {
    const s = memAll(base(), 18, MON); expect(staleItems(s, addDays(MON, 10))).toHaveLength(0); expect(staleItems(s, addDays(MON, 40)).length).toBe(itemsOf(s, 18).length)
  })
  it('progreso/dashboard coherente', () => {
    const s = memAll(base(), 18, MON); const d = dashboard(s, TUE)
    expect(d.memorized).toBe(itemsOf(s, 18).length); expect(d.phases.NO_INICIADO).toBe(29); expect(d.dueToday).toBe(itemsOf(s, 18).length)
  })
})
