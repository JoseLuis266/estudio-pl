// Recorta content/laws/*.json (texto completo importado) a los artículos que el programa exige → src/generated/laws
// (así el bundle de la PWA pesa lo justo). Ejecuta tras `npm run import:boe`; npm lo hace solo antes de dev/build/test.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const syllabus = JSON.parse(readFileSync(new URL('content/syllabus.json', root), 'utf8'))
const out = new URL('src/generated/laws/', root)
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
const baseNum = (n) => { const m = /^(\d+)/.exec(n); return m ? +m[1] : NaN }
const inRange = (a, r) => {
  if (/^anexo/i.test(r)) { const n = a.num.toLowerCase(), q = r.toLowerCase(); return n === q || n.startsWith(q + ' ·') }
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(r.trim()); const n = baseNum(a.num)
  return !!m && !isNaN(n) && n >= +m[1] && n <= +m[2]
}
const need = {} // law → {whole, ranges[]}
for (const t of syllabus) for (const s of t.sources) { const x = (need[s.law] ??= { whole: false, ranges: [] }); if (s.whole) x.whole = true; x.ranges.push(...(s.ranges ?? [])) }
let total = 0
const dir = new URL('content/laws/', root)
if (existsSync(dir)) for (const f of readdirSync(dir)) {
  const law = JSON.parse(readFileSync(new URL(f, dir), 'utf8')); const n = need[law.id]
  if (!n) continue
  const articles = law.articles.filter((a) => n.whole || n.ranges.some((r) => inRange(a, r)))
  writeFileSync(new URL(f, out), JSON.stringify({ ...law, articles })); total += articles.length
}
console.log(`content: ${total} artículos en el bundle`)
