// Genera PNGs (192/512/180) sin dependencias: escudo azul sobre fondo oscuro.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      // escudo: ancho decrece con v desde 0.15..0.9
      const half = v < 0.6 ? 0.30 : 0.30 * (1 - (v - 0.6) / 0.32)
      const inShield = v > 0.15 && v < 0.92 && Math.abs(u - 0.5) < Math.max(half, 0)
      // "P" simple (barra + bucle) y barra de L
      const bar = (a, b, c, d) => u > a && u < b && v > c && v < d
      const white = bar(0.34, 0.40, 0.32, 0.72) || bar(0.34, 0.52, 0.32, 0.38) || bar(0.34, 0.52, 0.48, 0.54) || bar(0.50, 0.56, 0.32, 0.54) || bar(0.62, 0.68, 0.32, 0.72) || bar(0.62, 0.74, 0.66, 0.72)
      const i = y * (size * 4 + 1) + 1 + x * 4
      const [r, g, b] = inShield ? (white ? [255, 255, 255] : [37, 99, 235]) : [11, 18, 32]
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
for (const [n, s] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) writeFileSync(new URL(`../public/${n}`, import.meta.url), png(s))
console.log('icons ok')
