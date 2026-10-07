import { describe, it, expect } from 'vitest'
// @ts-ignore módulo JS sin tipos
import { parseBoeXml, diffLaws, wordToNum } from '../scripts/boe-parse.mjs'
// @ts-ignore módulo JS sin tipos
import { parseBoibHtml } from '../scripts/import-boib.mjs'

const XML = `<response><data><texto>
<bloque id="a1" tipo="precepto" titulo="Artículo 1"><version id_norma="X" fecha_vigencia="19781229"><p class="articulo">Artículo 1.</p><p class="parrafo">España se constituye en un Estado social y democrático de Derecho.</p><p class="parrafo_2">2. La soberanía nacional reside en el pueblo español.</p></version></bloque>
<bloque id="a2" tipo="precepto" titulo="Artículo 24 bis"><version fecha_vigencia="20200101"><p class="articulo">Artículo 24 bis. Del plazo.</p><p class="parrafo">El plazo será de 10 días &amp; no más.</p></version></bloque>
<bloque id="ax" tipo="anexo" titulo="Anexo II"><version fecha_vigencia="20200101"><p class="anexo">ANEXO II</p><p class="parrafo">Definiciones.</p></version></bloque>
<bloque id="dd" tipo="precepto" titulo="Disposición final"><version><p class="parrafo">no entra</p></version></bloque>
</texto></data></response>`
describe('parser BOE (sobre muestra sintética del formato documentado)', () => {
  const a = parseBoeXml(XML, 'ce')
  it('extrae artículos y anexos, no disposiciones', () => { expect(a.map((x: any) => x.num)).toEqual(['1', '24 bis', 'Anexo II']) })
  it('separa encabezado, título y cuerpo; decodifica entidades', () => {
    expect(a[0].paras).toHaveLength(2); expect(a[1].title).toBe('Del plazo.'); expect(a[1].paras[0]).toBe('El plazo será de 10 días & no más.')
  })
  it('detecta cambios legislativos sin sobrescribir en silencio', () => {
    const next = parseBoeXml(XML.replace('10 días', '15 días'), 'ce'); const { articles, log } = diffLaws(a, next, '2026-10-07')
    expect(log.map((l: any) => l.kind)).toEqual(['modificado']); expect(articles[1].changed.at).toBe('2026-10-07')
  })
})

describe('numeración y BOIB', () => {
  it('artículos numerados con palabras (LO 2/1986)', () => {
    expect(wordToNum('primero')).toBe('1'); expect(wordToNum('quinto')).toBe('5'); expect(wordToNum('once')).toBe('11'); expect(wordToNum('treinta y siete')).toBe('37'); expect(wordToNum('cincuenta y cuatro')).toBe('54'); expect(wordToNum('24 bis')).toBeNull()
  })
  it('parser BOIB: artículos, título en negrita, cuerpo; ignora encabezados y anexos', () => {
    const h = '<p><strong>Artículo único</strong></p><p>Se aprueba.</p><p>TÍTULO I</p><p><strong>DISPOSICIONES</strong></p><p><strong>Artículo 1</strong></p><p><strong>Objeto</strong></p><p>1. Texto uno.</p><p>Capítulo I</p><p><strong>Cosas</strong></p><p><strong>Artículo 2</strong></p><p><strong>Armas</strong></p><p>El arma &amp; la defensa.</p><p>ANEXO 1</p><p><strong>Artículo 3</strong></p><p>x</p>'
    const a = parseBoibHtml(h, 'd'); expect(a.map((x: any) => x.num)).toEqual(['Decreto art. único', '1', '2'])
    expect(a[1].title).toBe('Objeto'); expect(a[2].paras).toEqual(['El arma & la defensa.'])
  })
})
