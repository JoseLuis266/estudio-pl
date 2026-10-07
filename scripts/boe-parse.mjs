// Parser del texto consolidado de la API de datos abiertos del BOE (formato XML <bloque>/<version>/<p class=…>).
// NOTA: escrito contra el formato documentado; verificar con un BOE real en cuanto haya acceso de red (ver README).
const ent = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }
export const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => ent[m]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
const strip = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]))

// Artículos numerados con palabras (LO 2/1986: «primero», «treinta y siete»…) → cifra
const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const D = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const ORD = { primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6, séptimo: 7, octavo: 8, noveno: 9, décimo: 10 }
export function wordToNum(w) {
  const t = w.toLowerCase().trim().replace(/^art[ií]culo\s+/, '')
  const m = /^(.*?)(\s+(bis|ter|quater|quinquies|sexies|septies|octies))?$/.exec(t); const base = m[1], suf = m[2] || ''
  let n = ORD[base]
  if (!n) { const i = U.indexOf(base); if (i > 0) n = i }
  if (!n) { const mm = /^(\w+)\s+y\s+(\w+)$/.exec(base); if (mm && D[mm[1]]) { const u = U.indexOf(mm[2]); if (u > 0) n = D[mm[1]] + u } else if (D[base]) n = D[base] }
  return n ? String(n) + suf : null
}
export function parseBoeXml(xml, lawId) {
  const articles = []
  const hasHeads = /tipo="encabezado"/.test(xml)
  let preface = hasHeads, anexo = null, tit = ''
  const seen = new Set()
  for (const bm of xml.matchAll(/<bloque\b([^>]*)>([\s\S]*?)<\/bloque>/g)) {
    const a = attrs(bm[1])
    const titulo = (a.titulo || '').trim()
    if (a.tipo === 'encabezado') {
      preface = false
      if (/^anexo\b/i.test(titulo)) anexo = titulo.replace(/\.$/, '').replace(/^anexo/i, 'Anexo')
      else if (/^t[ií]tulo\b/i.test(titulo)) tit = titulo.replace(/\s+/g, ' ')
    }
    const isArt = /^art[ií]culo\b/i.test(titulo), isAnx = /^anexo\b/i.test(titulo)
    const isSub = !!anexo && !isArt && !isAnx && a.tipo !== 'encabezado' && !!(titulo || a.id)
    if (!isArt && !isAnx && !isSub) continue
    const versions = [...bm[2].matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)]
    const last = versions.length ? versions[versions.length - 1] : null
    const body = last ? last[2] : bm[2]
    const ps = [...body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)].map((m) => ({ cls: attrs(m[1]).class || '', t: strip(m[2]) })).filter((p) => p.t)
    if (!ps.length) continue
    let num, title
    if (isArt) {
      num = titulo.replace(/^art[ií]culo\s+/i, '').replace(/\.$/, '').trim()
      num = wordToNum(num) ?? num
      const h = ps.find((p) => /articulo/i.test(p.cls)); const m = h && /^art[ií]culo\s+[^.]+\.\s*(.+)$/i.exec(h.t)
      title = m ? m[1] : undefined
    } else if (isAnx) { num = titulo.replace(/\.$/, '').replace(/^anexo/i, 'Anexo'); title = undefined }
    else { num = `${anexo} · ${(titulo || a.id).replace(/\.$/, '')}`; title = undefined }
    // en artículos, el primer <p class="articulo"> es el encabezado: se excluye del cuerpo
    const body2 = isArt ? ps.filter((p) => !/articulo/i.test(p.cls)).map((p) => p.t) : ps.filter((p) => !/^anexo/i.test(p.cls)).map((p) => p.t)
    if (!body2.length) continue
    if (isArt) {
      if (anexo) num = `${anexo} · art. ${num}`
      else if (preface) { articles.push({ id: '', lawId, num, ...(title ? { title } : {}), paras: body2, pre: true }); continue }
      else if (seen.has(num)) num = `${num} (${tit || 'bis'})`
      seen.add(num)
    }
    articles.push({ id: `${lawId}:${num}`, lawId, num, ...(title ? { title } : {}), paras: body2, ...(last ? { vigencia: attrs(last[1]).fecha_vigencia } : {}) })
  }
  // artículos previos al primer encabezado: solo son de la disposición aprobatoria si su número se repite después
  const later = new Set(articles.filter((a) => !a.pre).map((a) => a.num))
  return articles.map(({ pre, ...a }) => { const num = pre && later.has(a.num) ? `RD art. ${a.num}` : a.num; return { ...a, id: `${lawId}:${num}`, num } })
}

export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(16) }
export const artHash = (a) => hashStr(a.paras.join('\n'))

/** Compara con la versión anterior: marca artículos cambiados (nunca cambia en silencio). */
export function diffLaws(prev, next, at) {
  const log = []
  if (!prev) return { articles: next, log }
  const old = new Map(prev.map((a) => [a.id, a]))
  const articles = next.map((a) => {
    const o = old.get(a.id)
    if (o && artHash(o) !== artHash(a)) { log.push({ id: a.id, at, kind: 'modificado', prevHash: artHash(o) }); return { ...a, changed: { at, prevHash: artHash(o) } } }
    if (!o) log.push({ id: a.id, at, kind: 'nuevo' })
    return o?.changed ? { ...a, changed: o.changed } : a
  })
  for (const o of prev) if (!next.find((a) => a.id === o.id)) log.push({ id: o.id, at, kind: 'eliminado' })
  return { articles, log }
}
