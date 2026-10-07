import type { Cat, Item, Question } from './types'
import { articleLabel } from './content'

/** Utilidades deterministas (tests reproducibles). */
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
export function hash(str: string) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
export function shuffle<T>(a: T[], r: () => number): T[] { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]] } return x }

const WORDS = ['un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'doce', 'quince', 'veinte', 'treinta']
const DIGITS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30, 40, 48, 50, 60, 72, 90]
const MAYORIAS = ['mayoría simple', 'mayoría absoluta', 'mayoría cualificada', 'mayoría de tres quintos', 'mayoría de dos tercios']
const ORGANOS = ['Congreso de los Diputados', 'Senado', 'Cortes Generales', 'Consell de Govern', 'Consell Insular', 'Parlamento', 'Tribunal Constitucional', 'Tribunal Supremo', 'Consejo General del Poder Judicial', 'Defensor del Pueblo', 'Ministerio Fiscal', 'Ayuntamiento', 'Presidente del Gobierno', 'Fiscal General del Estado', 'Tribunal Superior de Justicia', 'Rey', 'Gobierno']
const ORG_RE = new RegExp('(?<![\\wÁÉÍÓÚáéíóúñ])(' + [...ORGANOS].sort((a, b) => b.length - a.length).join('|') + ')(?![\\wÁÉÍÓÚáéíóúñ])', 'g')
const NUM_RE = new RegExp('(?<![\\w.,])(\\d+(?:[.,]\\d+)?|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|noventa|cien)(?=\\s+(?:días?|meses|mes|años?|horas?|miembros|diputados|senadores|votos|euros|metros|km|kilómetros|%|por ciento|puntos|plazas|grados))', 'gi')
const MAY_RE = /mayoría (?:absoluta|simple|cualificada|de tres quintos|de dos tercios|de tres cuartos|de cinco sextos)/g
const MODAL_RE = /(?<![\wáéíóú])(podrá|deberá|podrán|deberán)(?![\wáéíóú])/g
const SWAPS: [string, string][] = [['incluido', 'excluido'], ['incluidos', 'excluidos'], ['obligatorio', 'facultativo'], ['obligatoria', 'facultativa'], ['salvo', 'incluso']]
const SW_RE = new RegExp('(?<![\\wáéíóú])(' + SWAPS.flatMap((p) => p).join('|') + ')(?![\\wáéíóú])', 'g')

export interface Hit { cat: Cat; start: number; end: number; text: string }
export function findHits(s: string): Hit[] {
  const out: Hit[] = []
  const push = (re: RegExp, cat: (m: RegExpExecArray) => Cat) => { re.lastIndex = 0; let m: RegExpExecArray | null; while ((m = re.exec(s))) out.push({ cat: cat(m), start: m.index, end: m.index + m[0].length, text: m[0] }) }
  push(MAY_RE, () => 'mayoria')
  push(MODAL_RE, () => 'modal')
  push(ORG_RE, () => 'organo')
  // «Gobierno de las Illes Balears», «Gobierno del Estado»…: el órgano completo es otro; no se usa como hueco
  for (let i = out.length - 1; i >= 0; i--) if (out[i].cat === 'organo' && /^\s+de(l| las| la)?\s+(las?\s+)?(Illes|Islas|Estado|Comunidad|Autonom)/i.test(s.slice(out[i].end))) out.splice(i, 1)
  push(SW_RE, () => 'excepcion')
  NUM_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = NUM_RE.exec(s))) {
    const unit = /^\s+(\S+)/.exec(s.slice(m.index + m[0].length))?.[1] ?? ''
    out.push({ cat: /^(día|mes|año|hora)/.test(unit) ? 'plazo' : 'numero', start: m.index, end: m.index + m[0].length, text: m[0] })
  }
  out.sort((a, b) => a.start - b.start)
  return out.filter((h, i) => i === 0 || h.start >= out[i - 1].end) // sin solapes
}

/** Frases autosuficientes: se descartan elementos de lista sueltos («b) …», «Solicitar …») porque sin su encabezado son ambiguos. */
export function sentencesOf(paras: string[]): string[] {
  return paras.flatMap((p) => p.split(/(?<=[.;])\s+/)).map((s) => s.trim()).filter((s) => s.length >= 25 && !/^[a-zñ]\)\s/i.test(s) && /^(\d+\.\s+)?[A-ZÁÉÍÓÚÑ]/.test(s) && !/^(\d+\.\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(ar|er|ir)\s/.test(s))
}

/** Alternativas plausibles para un hit (mismo tipo de dato). Nunca incluye la respuesta correcta. */
export function alternatives(h: Hit, r: () => number, n = 3): string[] {
  let pool: string[]
  if (h.cat === 'mayoria') pool = MAYORIAS
  else if (h.cat === 'modal') pool = /n$/.test(h.text) ? ['podrán', 'deberán', 'no podrán', 'no deberán'] : ['podrá', 'deberá', 'no podrá', 'no deberá']
  else if (h.cat === 'organo') pool = ORGANOS.filter((o) => !((h.text === 'Gobierno' && o === 'Consell de Govern') || (h.text === 'Consell de Govern' && o === 'Gobierno')))
  else if (h.cat === 'excepcion') { const p = SWAPS.find((x) => x.includes(h.text.toLowerCase())); pool = p ? p.filter((x) => x !== h.text.toLowerCase()) : [] }
  else {
    const isWord = /^[a-záéíóú]+$/i.test(h.text)
    const v = parseFloat(h.text.replace(',', '.'))
    const base = isWord ? WORDS : DIGITS.map(String)
    pool = [...base].sort((a, b) => Math.abs(Math.log((numVal(a) + 1) / (v + 1))) - Math.abs(Math.log((numVal(b) + 1) / (v + 1))))
    pool = pool.slice(0, 8)
  }
  const lower = h.text.toLowerCase()
  return shuffle(pool.filter((x) => x.toLowerCase() !== lower), r).slice(0, n)
}
function numVal(s: string) { const i = WORDS.indexOf(s); return i >= 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30][i] : parseFloat(s) }

const BLANK = '_____'
export function genForItem(item: Item): Question[] {
  const out: Question[] = []
  const src = articleLabel(item) + (item.law.demo ? ' (DEMO)' : '')
  sentencesOf(item.article.paras).forEach((s, si) => {
    const hits = findHits(s).slice(0, 2)
    hits.forEach((h, hi) => {
      const r = rng(hash(item.id + si + hi))
      const alts = alternatives(h, r)
      if (alts.length < 2) return
      const base = `${item.id}#${si}.${hi}`
      const explain = `Texto ${item.law.demo ? 'DEMO (ficticio)' : 'oficial'}: «${s}» — ${src}`
      out.push({ id: base + '.m', itemId: item.id, themeId: item.themeId, kind: 'mcq', cat: h.cat, prompt: s.slice(0, h.start) + BLANK + s.slice(h.end), options: shuffle([h.text, ...alts], r), answer: h.text, explanation: explain, source: src, generated: true })
      // Detecta el error: una versión con UN detalle cambiado (falsa) o el original (verdadera)
      const falsify = hash(base) % 2 === 0
      out.push({ id: base + '.t', itemId: item.id, themeId: item.themeId, kind: 'tf', cat: h.cat, prompt: falsify ? s.slice(0, h.start) + alts[0] + s.slice(h.end) : s, answer: falsify ? 'F' : 'V', explanation: falsify ? `Falso: el texto dice «${h.text}», no «${alts[0]}». ${explain}` : `Verdadero. ${explain}`, source: src, generated: true })
    })
  })
  out.push(...genArticleQs(item))
  return out
}

/** Artículo ↔ contenido usando el TÍTULO OFICIAL del artículo (solo si es único en la norma). */
const cleanT = (t: string) => t.replace(/\.$/, '').trim()
export function genArticleQs(item: Item): Question[] {
  const t = item.article.title; if (!t) return []
  const law = item.law; const titled = law.articles.filter((a) => a.title && !/^(RD art|Decreto art)/.test(a.num))
  if (titled.filter((a) => cleanT(a.title!).toLowerCase() === cleanT(t).toLowerCase()).length !== 1) return []
  const r = rng(hash(item.id + '#art'))
  const others = shuffle(titled.filter((a) => a.id !== item.article.id && cleanT(a.title!).toLowerCase() !== cleanT(t).toLowerCase()), r)
  if (others.length < 3) return []
  const src = articleLabel(item) + (law.demo ? ' (DEMO)' : '')
  const exp = `Título oficial del ${src}: «${cleanT(t)}».`
  const idx = law.articles.indexOf(item.article)
  const near = titled.filter((a) => a.id !== item.article.id).sort((a, b) => Math.abs(law.articles.indexOf(a) - idx) - Math.abs(law.articles.indexOf(b) - idx)).slice(0, 6)
  const lab = (n: string) => (/^anexo/i.test(n) ? n : 'art. ' + n)
  return [
    { id: item.id + '#a1', itemId: item.id, themeId: item.themeId, kind: 'mcq', cat: 'articulo', prompt: `¿Qué regula el ${lab(item.article.num)} de ${law.short}?`, options: shuffle([cleanT(t), ...others.slice(0, 3).map((a) => cleanT(a.title!))], r), answer: cleanT(t), explanation: exp, source: src, generated: true },
    ...(near.length >= 3 ? [{ id: item.id + '#a2', itemId: item.id, themeId: item.themeId, kind: 'mcq' as const, cat: 'articulo' as const, prompt: `¿Qué artículo de ${law.short} regula «${cleanT(t)}»?`, options: shuffle([lab(item.article.num), ...shuffle(near, r).slice(0, 3).map((a) => lab(a.num))], r), answer: lab(item.article.num), explanation: exp, source: src, generated: true as const }] : [])
  ]
}

// ---------- Conceptos / flashcards ----------
export interface Note { concept?: string; postit?: string; esquema?: string; personal?: string; trampas?: string; status?: 'EN_PROCESO' | 'DIFICIL' }
export function conceptOf(item: Item, note?: Note): { text: string; kind: 'personal' | 'oficial' | 'auto' } {
  if (note?.concept) return { text: note.concept, kind: 'personal' }
  if (item.article.concept || item.article.title) return { text: (item.article.concept ?? item.article.title)!, kind: 'oficial' }
  const first = sentencesOf(item.article.paras)[0] ?? item.article.paras[0] ?? ''
  const w = first.split(/\s+/)
  return { text: w.slice(0, 14).join(' ') + (w.length > 14 ? '…' : ''), kind: 'auto' }
}
export interface Flash { id: string; itemId: string; themeId: number; kind: 'art2con' | 'con2art'; front: string; back: string }
export function flashcards(item: Item, note?: Note): Flash[] {
  const c = conceptOf(item, note).text; const lab = articleLabel(item)
  return [
    { id: item.id + '#f1', itemId: item.id, themeId: item.themeId, kind: 'art2con', front: lab, back: c },
    { id: item.id + '#f2', itemId: item.id, themeId: item.themeId, kind: 'con2art', front: c, back: lab }
  ]
}
export function keyFacts(item: Item) { return sentencesOf(item.article.paras).flatMap((s) => findHits(s).length ? [{ s, hits: findHits(s) }] : []) }
export function autoPostit(item: Item): string {
  const f = keyFacts(item)
  return (f.length ? f.map((x) => '• ' + x.s) : item.article.paras.map((p) => '• ' + p)).join('\n')
}
export function autoEsquema(item: Item): string {
  const lab = /^anexo/i.test(item.article.num) ? item.article.num.toUpperCase() : 'ART. ' + item.article.num
  const lines = [lab]
  item.article.paras.forEach((p, i, a) => {
    const last = i === a.length - 1
    const hs = findHits(p)
    lines.push(`${last ? '└──' : '├──'} ${p.length > 110 ? p.slice(0, 107) + '…' : p}`)
    hs.forEach((h, j) => lines.push(`${last ? '    ' : '│   '}${j === hs.length - 1 ? '└──' : '├──'} [${h.cat}] ${h.text}`))
  })
  return lines.join('\n')
}

// ---------- Recuerdo libre (comparación léxica, NO semántica) ----------
const STOP = new Set('para como esta este esos esas sobre entre desde hasta cuando donde cual cuyo cuya será serán serán sido tiene tienen todo toda todos todas otro otra otros otras podrá podrán deberá deberán misma mismo mismos mismas aquel aquella'.split(' '))
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const toks = (s: string) => norm(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !STOP.has(w)).map(stem)
/** raíz aproximada: tolera flexión (miembro/miembros, elegido/elegidos) */
const stem = (w: string) => (/^\d/.test(w) ? w : w.slice(0, 6))
/** token normalizado → palabra original (para mostrar con tildes) */
const originals = (s: string) => { const m = new Map<string, string>(); for (const w of s.split(/[^A-Za-z0-9ñÑáéíóúÁÉÍÓÚüÜ]+/)) { const n = norm(w); if (n.length >= 4 && !m.has(stem(n))) m.set(stem(n), w.toLowerCase()) } return m }
export interface RecallResult { recordado: string[]; omitido: string[]; incorrecto: string[]; inventado: string[]; score: number; suggested: 0 | 1 | 2 | 3 }
export function compareRecall(user: string, paras: string[]): RecallResult {
  const text = paras.join(' ')
  const art = new Set(toks(text))
  const u = new Set(toks(user))
  const keyHits = new Set(findHits(text).map((h) => norm(h.text)))
  const key = [...art]
  const recordado = key.filter((k) => u.has(k))
  const keyFirst = [...key].sort((a, b) => (/\d/.test(b) ? 1 : 0) - (/\d/.test(a) ? 1 : 0))
  const orig = originals(text)
  const omitido = keyFirst.filter((k) => !u.has(k)).slice(0, 15).map((k) => orig.get(k) ?? k)
  const userHits = findHits(user).map((h) => norm(h.text))
  const userNums = (user.match(/\d+/g) ?? [])
  const artNums = new Set(text.match(/\d+/g) ?? [])
  const incorrecto = [...userHits.filter((h) => !keyHits.has(h)), ...userNums.filter((n) => !artNums.has(n))]
  const inventado = [...u].filter((w) => w.length >= 6 && !art.has(w)).slice(0, 10)
  const score = key.length ? recordado.length / key.length : 0
  let suggested: 0 | 1 | 2 | 3 = score >= 0.85 ? 3 : score >= 0.6 ? 2 : score >= 0.3 ? 1 : 0
  if (incorrecto.length && suggested > 1) suggested = 1
  return { recordado, omitido, incorrecto, inventado, score, suggested }
}
