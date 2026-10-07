// Importa texto consolidado oficial desde la API de datos abiertos del BOE y escribe content/laws/<id>.json
// Uso:  npm run import:boe                (todas las leyes del registro con boeId)
//       npm run import:boe -- ce lecrim   (solo esas)
//       npm run import:boe -- ley4-2013=BOE-A-2013-XXXX   (asignar identificador BOE a una ley sin boeId)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseBoeXml, diffLaws } from './boe-parse.mjs'

const root = new URL('../', import.meta.url)
const registry = JSON.parse(readFileSync(new URL('content/laws-registry.json', root), 'utf8'))
const args = process.argv.slice(2)
const overrides = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.split('=')))
const only = args.filter((a) => !a.includes('='))
const today = new Date().toISOString().slice(0, 10)
const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/'
mkdirSync(new URL('content/laws/', root), { recursive: true })
const changesPath = new URL('content/changes-log.json', root)
const changes = existsSync(changesPath) ? JSON.parse(readFileSync(changesPath, 'utf8')) : []

async function get(url) {
  const r = await fetch(url, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`)
  return r.text()
}
let ok = 0, fail = 0
for (const law of registry) {
  if (only.length && !only.includes(law.id)) continue
  const boeId = overrides[law.id] || law.boeId
  if (!boeId) { console.log(`· ${law.id}: sin identificador BOE (PENDIENTE DE FUENTE${law.boibOnly ? ': solo BOIB' : ''})`); continue }
  try {
    const meta = await get(`${API}${boeId}/metadatos`)
    const title = (/<titulo>([\s\S]*?)<\/titulo>/.exec(meta)?.[1] ?? '').replace(/\s+/g, ' ')
    if (!title.toLowerCase().includes(law.expect.toLowerCase())) throw new Error(`el título «${title.slice(0, 80)}» no contiene «${law.expect}» — identificador BOE dudoso, no se importa`)
    const version = /<fecha_actualizacion>([^<]*)</.exec(meta)?.[1] ?? ''
    const xml = await get(`${API}${boeId}/texto`)
    const parsed = parseBoeXml(xml, law.id)
    if (!parsed.length) throw new Error('no se encontraron artículos (formato XML inesperado)')
    const file = new URL(`content/laws/${law.id}.json`, root)
    const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
    const { articles, log } = diffLaws(prev?.articles, parsed, today)
    if (log.length && prev) { changes.push(...log.map((l) => ({ law: law.id, ...l }))); console.log(`  ⚠️ POSIBLE CAMBIO LEGISLATIVO en ${law.id}: ${log.length} artículos`) }
    writeFileSync(file, JSON.stringify({ id: law.id, name: law.name, short: law.short, boeId, sourceUrl: `https://www.boe.es/buscar/act.php?id=${boeId}`, checkedAt: today, version, verified: true, articles }, null, 1))
    console.log(`✓ ${law.id}: ${articles.length} artículos (${version || 'sin fecha'})`); ok++
  } catch (e) { console.error(`✗ ${law.id}: ${e.message}`); fail++ }
}
writeFileSync(changesPath, JSON.stringify(changes, null, 1))
console.log(`\nImportadas: ${ok} · con error: ${fail}`)
process.exit(fail ? 1 : 0)
