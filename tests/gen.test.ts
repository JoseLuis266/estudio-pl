import { describe, it, expect } from 'vitest'
import { findHits, genForItem, alternatives, rng, compareRecall, conceptOf, flashcards } from '../src/lib/generators'
import { inRange, parseRanges, themeItems, THEMES, DEFAULT_ORDER, LAWS } from '../src/lib/content'
import { buildQuiz, weeklyTest, quick5 } from '../src/lib/quiz'
import { defaultState, answerQuestion, reportQuestion, memorize, exportJSON, importJSON, saveState, loadState, KV, addMaterial } from '../src/lib/store'
import { itemsOf } from '../src/lib/plan'
import { weaknesses, contentCoverage } from '../src/lib/stats'

const T = 'El veto del Senado requiere mayoría absoluta. La Comisión deberá reunirse cada tres meses y el Presidente podrá convocar con 48 horas de antelación.'
const demoState = () => { const s = defaultState(); s.settings.demo = true; return s }

describe('programa', () => {
  it('30 temas y orden T18→T30, T7→T17, T1→T6', () => {
    expect(THEMES).toHaveLength(30); expect(DEFAULT_ORDER.slice(0, 3)).toEqual([18, 19, 20]); expect(DEFAULT_ORDER[13]).toBe(7); expect(DEFAULT_ORDER.at(-1)).toBe(6); expect(new Set(DEFAULT_ORDER).size).toBe(30)
  })
  it('rangos de artículos', () => {
    const a = (num: string) => ({ id: 'x', lawId: 'x', num, paras: [] })
    expect(inRange(a('24 bis'), '24-30')).toBe(true); expect(inRange(a('31'), '24-30')).toBe(false); expect(inRange(a('Anexo II'), 'Anexo II')).toBe(true); expect(parseRanges('1-9, 166')).toEqual(['1-9', '166-166'])
  })
  it('los 30 temas tienen artículos oficiales (BOE/BOIB), ninguno DEMO', () => {
    const n = (id: number) => themeItems(THEMES[id - 1], false).length
    for (let id = 1; id <= 30; id++) expect(n(id), 'T' + id).toBeGreaterThan(0)
    expect(themeItems(THEMES[19], false).every((i) => i.law.id === 'decreto40-2019' && !!i.law.warning)).toBe(true) // T20: BOIB original, avisado
    expect(themeItems(THEMES[16], false).some((i) => i.law.id === 'orden2223-2014')).toBe(true) // T17: Orden INT/2223/2014
    expect(themeItems(THEMES[0], false).every((i) => !i.law.demo)).toBe(true)
  })
  it('alcance real: T1 = CE arts 1-9 y 166-169; T26 = seguridad vial (379-385 ter)', () => {
    const nums = (id: number) => themeItems(THEMES[id - 1], false).map((i) => i.article.num)
    expect(nums(1)).toContain('1'); expect(nums(1)).toContain('168'); expect(nums(1)).not.toContain('10')
    expect(nums(26)).toContain('385 ter'); expect(nums(26)).not.toContain('386')
    expect(nums(21)).toContain('5'); expect(nums(21)).toContain('54') // LO 2/1986 numerada con letras en el BOE
  })
})
describe('generadores', () => {
  it('detecta mayorías, modales, órganos, plazos y números', () => {
    const cats = findHits(T).map((h) => h.cat); for (const c of ['mayoria', 'organo', 'modal', 'plazo']) expect(cats).toContain(c)
    expect(findHits(T).some((h) => h.text === '48')).toBe(true)
  })
  it('alternativas nunca incluyen la respuesta correcta', () => {
    for (const h of findHits(T)) { const alts = alternatives(h, rng(1)); expect(alts.map((x) => x.toLowerCase())).not.toContain(h.text.toLowerCase()) }
  })
  it('preguntas: respuesta correcta presente en opciones; V/F falsas difieren del original', () => {
    const it = { id: 't1:x', themeId: 1, conf: 'alta' as const, law: { id: 'x', short: 'X', name: 'X', boeId: null, sourceUrl: '', checkedAt: '', version: '', verified: true, articles: [] }, article: { id: 'x:1', lawId: 'x', num: '1', paras: [T] } }
    const qs = genForItem(it); expect(qs.length).toBeGreaterThan(3)
    for (const q of qs) { if (q.kind === 'mcq') { expect(q.options).toContain(q.answer); expect(q.prompt).toContain('_____') } else if (q.answer === 'F') expect(T.includes(q.prompt)).toBe(false); else expect(T.includes(q.prompt)).toBe(true) }
    expect(genForItem(it).map((q) => q.id)).toEqual(qs.map((q) => q.id)) // determinista
  })
  it('recuerdo libre: detecta omitidos e incorrectos (números distintos)', () => {
    const r = compareRecall('el senado requiere mayoría absoluta y 30 días', [T]); expect(r.incorrecto).toContain('30'); expect(r.omitido.length).toBeGreaterThan(0)
    expect(compareRecall(T, [T]).suggested).toBe(3)
  })
  it('concepto→artículo y artículo→concepto', () => {
    const it: any = { id: 'a', themeId: 1, law: { short: 'CE' }, article: { num: '104', paras: ['Las Fuerzas y Cuerpos de seguridad actuarán bajo la dirección del Gobierno.'] } }
    const [a, b] = flashcards(it); expect(a.front).toBe('CE · art. 104'); expect(b.back).toBe('CE · art. 104'); expect(conceptOf(it).kind).toBe('auto'); expect(conceptOf(it, { concept: 'BANDOS' }).text).toBe('BANDOS')
  })
})
describe('tests, errores, informes', () => {
  it('fallo → cuaderno de errores; aciertos posteriores espacian; reportada se excluye', () => {
    let s = demoState(); const qs = buildQuiz(s, { n: 5, seed: 3 }, '2026-10-07'); expect(qs.length).toBeGreaterThan(0)
    const q = qs[0]; s = answerQuestion(s, q, 'ZZZ', '2026-10-07'); expect(s.errors[q.id].fails).toBe(1)
    expect(buildQuiz(s, { n: 5, onlyErrors: true }, '2026-10-08').map((x) => x.id)).toContain(q.id)
    s = answerQuestion(s, q, q.answer, '2026-10-08'); s = answerQuestion(s, q, q.answer, '2026-10-12'); expect(s.errors[q.id].streak).toBe(2); expect(s.errors[q.id].due > '2026-10-12').toBe(true)
    s = reportQuestion(s, q.id, 'ambigua', '2026-10-12'); expect(buildQuiz(s, { n: 50 }, '2026-10-13').map((x) => x.id)).not.toContain(q.id)
  })
  it('semanal y 5 minutos devuelven preguntas', () => {
    let s = demoState(); for (const i of itemsOf(s, 18)) s = memorize(s, i.id, 18, '2026-10-05', 2)
    expect(weeklyTest(s, itemsOf(s, 18), '2026-10-10').length).toBeGreaterThan(0); expect(quick5(s, '2026-10-06').length).toBeGreaterThan(0)
  })
  it('debilidades por tipo de dato', () => {
    let s = demoState(); const qs = buildQuiz(s, { n: 20, seed: 1 }, '2026-10-07')
    for (const q of qs) s = answerQuestion(s, q, 'nope', '2026-10-07'); const w = weaknesses(s); expect(w.length).toBeGreaterThan(0); expect(w[0].failRate).toBe(1)
  })
  it('cobertura de contenido honesta', () => {
    const c = contentCoverage(demoState(), LAWS); expect(c.themes).toBe(30); expect(c.articles).toBeGreaterThan(300); expect(c.verifiedPct).toBe(1); expect(c.demo).toBe(0); expect(c.themesWith).toBeGreaterThanOrEqual(26)
  })
})
describe('persistencia y backup', () => {
  it('guardar/cargar/exportar/importar', () => {
    const mem: Record<string, string> = {}; const kv: KV = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v } }
    let s = demoState(); for (const i of itemsOf(s, 18)) s = memorize(s, i.id, 18, '2026-10-05', 3)
    saveState(s, kv); expect(loadState(kv)).toEqual(s)
    expect(importJSON(exportJSON(s))).toEqual(s)
    expect(() => importJSON('{"v":2}')).toThrow(); expect(loadState({ getItem: () => 'basura{', setItem() {} }).v).toBe(1)
  })
})

describe('ampliaciones', () => {
  it('preguntas artículo ↔ título oficial: respuesta única y en opciones', () => {
    const items = THEMES.flatMap((t) => themeItems(t, false))
    const it = items.find((i) => i.law.id === 'ley4-2013' && i.article.num === '1')!
    const qs = genForItem(it).filter((q) => q.cat === 'articulo'); expect(qs.length).toBe(2)
    for (const q of qs) { expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4) }
  })
  it('material personal separado del oficial y en la copia', () => {
    let s = defaultState(); s = addMaterial(s, { title: 'Apuntes T17', themeId: 17, text: 'x'.repeat(10), origin: 'academia' }, '2026-10-07')
    expect(s.material).toHaveLength(1); expect(importJSON(exportJSON(s)).material).toHaveLength(1)
    expect(addMaterial(s, { title: '', text: 'y'.repeat(500_000), origin: 'personal' }, '2026-10-07').material[1].text.length).toBe(400_000)
  })
  it('recuerdo libre tolera flexión (raíces)', () => {
    expect(compareRecall('quince miembro elegido', ['Estará formado por quince miembros elegidos.']).omitido).not.toContain('miembros')
  })
})
