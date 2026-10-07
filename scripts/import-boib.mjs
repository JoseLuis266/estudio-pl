// Importa disposiciones del BOIB (versión HTML ELI oficial) → content/laws/<id>.json
// Uso: npm run import:boib
// OJO: el BOIB solo ofrece el texto ORIGINAL publicado (no consolidado). Las modificaciones posteriores
// no se incorporan: se marca en `warning` para que la app lo muestre.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { decode, diffLaws } from './boe-parse.mjs'

const root = new URL('../', import.meta.url)
const SOURCES = [{
  id: 'decreto40-2019', short: 'Decreto 40/2019',
  name: 'Decreto 40/2019, de 24 de mayo, Reglamento marco de coordinación de las policías locales de las Illes Balears',
  url: 'https://www.caib.es/eboibfront/eli/es-ib/d/2019/05/24/40/dof/spa/html',
  version: 'BOIB 25/05/2019 · texto original publicado (no consolidado)',
  warning: 'Texto ORIGINAL del BOIB de 2019. El decreto ha sido modificado después (p. ej. disposición final 8ª de la Ley 4/2026 y otros): comprueba con tu temario los artículos afectados.'
}]

export function parseBoibHtml(html, lawId) {
  const ps = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => {
    const raw = m[1]; const t = decode(raw.replace(/<[^>]+>/g, '')).replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim()
    return { t, bold: /<strong>/.test(raw) && !/<\/strong>[^<\s]/.test(raw.replace(/<\/?span[^>]*>/g, '')) }
  }).filter((p) => p.t)
  const articles = []; let cur = null, inReg = false, pendingTitle = false, preface = true
  for (const p of ps) {
    if (/^ANEXO\b/.test(p.t)) break
    if (/^T[ÍI]TULO\b/.test(p.t)) { preface = false; inReg = true; cur = null; continue }
    if (/^(Cap[íi]tulo|Secci[óo]n)\b/i.test(p.t) && p.t.length < 40) { cur = null; pendingTitle = 'head'; continue }
    if (pendingTitle === 'head') { pendingTitle = false; if (p.bold) continue }
    const m = /^Art[íi]culo\s+(\d+(?:\s+(?:bis|ter|quater))?|único)\.?$/i.exec(p.t)
    if (m) {
      const num = (preface && !inReg ? 'Decreto art. ' : '') + m[1]
      cur = { id: `${lawId}:${num}`, lawId, num, paras: [] }; articles.push(cur); pendingTitle = true; continue
    }
    if (!cur) continue
    if (pendingTitle === true) { pendingTitle = false; if (p.bold && p.t.length < 160) { cur.title = p.t; continue } }
    cur.paras.push(p.t)
  }
  return articles.filter((a) => a.paras.length)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const today = new Date().toISOString().slice(0, 10)
  const changesPath = new URL('content/changes-log.json', root)
  const changes = existsSync(changesPath) ? JSON.parse(readFileSync(changesPath, 'utf8')) : []
  for (const s of SOURCES) {
    const r = await fetch(s.url); if (!r.ok) { console.error(`✗ ${s.id}: HTTP ${r.status}`); process.exitCode = 1; continue }
    const parsed = parseBoibHtml(await r.text(), s.id)
    if (parsed.length < 10) { console.error(`✗ ${s.id}: formato inesperado (${parsed.length} artículos)`); process.exitCode = 1; continue }
    const file = new URL(`content/laws/${s.id}.json`, root)
    const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
    const { articles, log } = diffLaws(prev?.articles, parsed, today)
    if (log.length && prev) { changes.push(...log.map((l) => ({ law: s.id, ...l }))); console.log(`  ⚠️ POSIBLE CAMBIO en ${s.id}: ${log.length}`) }
    writeFileSync(file, JSON.stringify({ id: s.id, name: s.name, short: s.short, boeId: null, sourceUrl: s.url, checkedAt: today, version: s.version, verified: true, warning: s.warning, articles }, null, 1))
    console.log(`✓ ${s.id}: ${articles.length} artículos`)
  }
  writeFileSync(changesPath, JSON.stringify(changes, null, 1))
}
