import { useMemo, useState } from 'react'
import { Card, Btn, Chip, H, BackBar, useNav, useDate, Badge } from '../ui'
import { ArticleView } from '../components'
import { THEMES, REGISTRY, LAWS, articleLabel, DEFAULT_ORDER } from '../lib/content'
import { useStore, update, setClass, replaceState, exportJSON, importJSON, defaultState, getState } from '../lib/store'
import { allThemeItems, dueItems } from '../lib/plan'
import { conceptOf, findHits, keyFacts } from '../lib/generators'
import { browserTTS } from '../lib/tts'
import type { Item } from '../lib/types'
import Material from './Material'
import { speakDialog } from '../lib/tts'

export default function Mas({ sub, p }: { sub?: string; p?: any }) {
  const go = useNav()
  const back = () => go({ tab: 'mas' })
  if (sub === 'clases') return <Clases back={back} p={p} />
  if (sub === 'buscar') return <Buscar back={back} />
  if (sub === 'audio') return <Audio back={back} />
  if (sub === 'ajustes') return <Ajustes back={back} />
  if (sub === 'fuentes') return <Fuentes back={back} />
  if (sub === 'material') return <Material back={back} />
  const m: [string, string, string][] = [['🎥', 'Clases', 'clases'], ['🔎', 'Buscador', 'buscar'], ['🎧', 'Audio', 'audio'], ['📚', 'Fuentes jurídicas', 'fuentes'], ['🗂', 'Material personal / academia (PDF)', 'material'], ['⚙️', 'Ajustes y copia de seguridad', 'ajustes']]
  return <div><H>Más</H><div className="space-y-2">{m.map(([e, l, k]) => <Card key={k} onClick={() => go({ tab: 'mas', sub: k })} className="flex items-center gap-3"><span className="text-2xl">{e}</span><b>{l}</b></Card>)}
    <Card onClick={() => go({ tab: 'progreso' })} className="flex items-center gap-3"><span className="text-2xl">📈</span><b>Progreso</b></Card>
    <Card onClick={() => go({ tab: 'test', sub: 'simulacro' })} className="flex items-center gap-3"><span className="text-2xl">📝</span><b>Simulacros</b></Card></div></div>
}

function Clases({ back, p }: { back: () => void; p?: any }) {
  const s = useStore((x) => x); const d = useDate()
  const [t, setT] = useState<number | null>(p?.themeId ?? null)
  if (t) { const c = s.classes[t] ?? { seen: false }; return <div><BackBar title={`Clase T${t}`} onBack={() => setT(null)} /><Card className="space-y-3"><div className="font-bold">{THEMES[t - 1].title}</div>
    <div className="flex items-center justify-between"><Chip color={c.seen ? 'green' : 'amber'}>{c.seen ? 'CLASE VISTA' : 'CLASE PENDIENTE'}</Chip><Btn kind={c.seen ? 'ghost' : 'ok'} onClick={() => update((x) => setClass(x, t, { seen: !c.seen, date: !c.seen ? d : c.date }, d))}>{c.seen ? 'Marcar pendiente' : 'Marcar vista'}</Btn></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-sm text-slate-400">Fecha</label><input type="date" defaultValue={c.date ?? ''} onBlur={(e) => update((x) => setClass(x, t, { date: e.target.value }, d))} /></div><div><label className="text-sm text-slate-400">Duración (min)</label><input type="number" defaultValue={c.minutes ?? ''} onBlur={(e) => update((x) => setClass(x, t, { minutes: +e.target.value || undefined }, d))} /></div></div>
    <div><label className="text-sm text-slate-400">Notas / puntos aclarados</label><textarea rows={3} defaultValue={c.notes ?? ''} onBlur={(e) => update((x) => setClass(x, t, { notes: e.target.value }, d))} /></div>
    <div><label className="text-sm text-slate-400">Conceptos importantes</label><textarea rows={2} defaultValue={c.key ?? ''} onBlur={(e) => update((x) => setClass(x, t, { key: e.target.value }, d))} /></div>
    <div><label className="text-sm text-slate-400">Dudas / puntos difíciles</label><textarea rows={2} defaultValue={c.doubts ?? ''} onBlur={(e) => update((x) => setClass(x, t, { doubts: e.target.value }, d))} /></div></Card></div> }
  return <div><BackBar title="Clases" onBack={back} /><div className="space-y-2">{THEMES.map((th) => { const c = s.classes[th.id]; return <Card key={th.id} onClick={() => setT(th.id)} className="flex items-center justify-between !py-3"><span className="truncate">T{th.id} · {th.title}</span><Chip color={c?.seen ? 'green' : 'amber'}>{c?.seen ? 'VISTA' : 'PENDIENTE'}</Chip></Card> })}</div></div>
}

function Buscar({ back }: { back: () => void }) {
  const s = useStore((x) => x); const [q, setQ] = useState(''); const [sel, setSel] = useState<Item | null>(null)
  const items = useMemo(() => allThemeItems(s), [s.settings.demo, s.settings.scope]) // eslint-disable-line
  const nq = q.trim().toLowerCase()
  const res = nq.length < 2 ? [] : items.filter((i) => (articleLabel(i) + ' ' + i.article.paras.join(' ') + ' ' + conceptOf(i, s.notes[i.id]).text).toLowerCase().includes(nq)).slice(0, 60)
  const th = nq.length < 2 ? [] : THEMES.filter((t) => (t.title + ' ' + t.scope + ' T' + t.id).toLowerCase().includes(nq))
  const mats = nq.length < 2 ? [] : s.material.filter((m) => (m.title + ' ' + m.text).toLowerCase().includes(nq)).slice(0, 20)
  if (sel) return <div><BackBar title={articleLabel(sel)} onBack={() => setSel(null)} /><Card><ArticleView item={sel} /></Card></div>
  const snip = (i: Item) => { const t = i.article.paras.join(' '); const k = t.toLowerCase().indexOf(nq); return k < 0 ? t.slice(0, 120) : (k > 40 ? '…' : '') + t.slice(Math.max(0, k - 40), k + 100) + '…' }
  return <div><BackBar title="Buscador" onBack={back} /><input autoFocus placeholder="artículo, palabra, concepto, ley o tema (p. ej. «mayoría absoluta»)" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
    {th.length > 0 && <div className="mb-2 text-sm text-slate-400">Temas: {th.map((t) => <Chip key={t.id}>T{t.id}</Chip>)}</div>}
    <div className="mb-2 text-sm text-slate-400">{nq.length >= 2 ? `${res.length} resultado(s)` : `Texto indexado: ${items.length} artículos`}</div>
    <div className="space-y-2">{res.map((i) => <Card key={i.id} onClick={() => setSel(i)} className="!py-3"><div className="font-semibold">T{i.themeId} · {articleLabel(i)}</div><div className="text-sm text-slate-300">{snip(i)}</div></Card>)}</div>
    {mats.length > 0 && <div className="mt-3"><div className="mb-1 text-sm text-slate-400">En tu material personal:</div>{mats.map((m) => { const k = m.text.toLowerCase().indexOf(nq); return <Card key={m.id} className="mb-2 !py-3"><div className="font-semibold">{m.title} <Badge k="personal" /></div><div className="text-sm text-slate-300">{k < 0 ? '' : '…' + m.text.slice(Math.max(0, k - 40), k + 100) + '…'}</div></Card> })}</div>}</div>
}

function Audio({ back }: { back: () => void }) {
  const s = useStore((x) => x); const d = useDate()
  const [mode, setMode] = useState('tema'); const [theme, setTheme] = useState(18); const [playing, setPlaying] = useState(false)
  const items = allThemeItems(s).filter((i) => i.themeId === theme)
  const build = () => {
    if (mode === 'tema') return items.map((i) => `${articleLabel(i)}. ${i.article.paras.join(' ')}`).join(' ')
    if (mode === 'r15' || mode === 'r5') { const f = items.flatMap((i) => keyFacts(i).map((x) => `${articleLabel(i)}: ${x.s}`)); return f.slice(0, mode === 'r5' ? 8 : 30).join(' ') }
    if (mode === 'nums') return items.flatMap((i) => keyFacts(i).filter((x) => x.hits.some((h) => ['numero', 'plazo', 'mayoria'].includes(h.cat))).map((x) => `${articleLabel(i)}: ${x.s}`)).join(' ')
    if (mode === 'errores') return Object.values(s.errors).filter((e) => e.q && e.streak < 3).map((e) => `${e.q!.prompt.replace('_____', 'blanco')}. Respuesta: ${e.q!.answer}.`).join(' ')
    return dueItems(s, d).map((x) => `${articleLabel(x.item)}: ${conceptOf(x.item, s.notes[x.item.id]).text}.`).join(' ')
  }
  const text = build()
  const dialog = () => {
    const src = mode === 'errores' ? Object.values(s.errors).filter((e) => e.q && e.streak < 3).map((e) => [e.q!.prompt.replace('_____', '¿qué falta?'), e.q!.answer]) : items.map((i) => [`${articleLabel(i)}. ¿Qué dice?`, i.article.paras.join(' ')])
    return src.flatMap(([a, b]) => [{ who: 'A' as const, text: a }, { who: 'B' as const, text: b }])
  }
  return <div><BackBar title="Audio" onBack={back} />
    <Card className="mb-3 space-y-3"><div><label className="text-sm text-slate-400">Modo</label><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="tema">Tema completo</option><option value="r15">Resumen 15 min</option><option value="r5">Resumen 5 min</option><option value="nums">Números y plazos</option><option value="errores">Errores</option><option value="dia">Repaso del día</option></select></div>
      {['tema', 'r15', 'r5', 'nums'].includes(mode) && <div><label className="text-sm text-slate-400">Tema</label><select value={theme} onChange={(e) => setTheme(+e.target.value)}>{THEMES.map((t) => <option key={t.id} value={t.id}>T{t.id} · {t.title}</option>)}</select></div>}
      {!browserTTS.available() && <div className="text-sm text-amber-300">Este navegador no ofrece síntesis de voz.</div>}
      <div className="text-sm text-slate-400">{text ? `${text.split(/\s+/).length} palabras ≈ ${Math.max(1, Math.round(text.split(/\s+/).length / 150))} min · voz del dispositivo (proveedor intercambiable; «dos voces» usa dos voces del dispositivo, o la misma con distinto tono).` : 'Sin contenido para este modo.'}</div>
      <Btn disabled={!text || !browserTTS.available()} className="w-full" onClick={() => { if (playing) { browserTTS.stop(); setPlaying(false) } else { setPlaying(true); browserTTS.speak(text).then(() => setPlaying(false)) } }}>{playing ? '■ Parar' : '▶ Escuchar'}</Btn>
      {['tema', 'errores'].includes(mode) && <Btn kind="ghost" disabled={playing || !browserTTS.available()} className="w-full" onClick={() => { setPlaying(true); speakDialog(dialog()).then(() => setPlaying(false)) }}>🎙 Formato dos voces (pregunta → respuesta)</Btn>}</Card></div>
}

function Ajustes({ back }: { back: () => void }) {
  const st = useStore((x) => x.settings); const [msg, setMsg] = useState(''); const [th, setTh] = useState(1)
  const set = (k: string, v: any) => update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }))
  const num = (k: keyof typeof st, label: string) => <div><label className="text-sm text-slate-400">{label}</label><input type="number" min={0} value={st[k] as number} onChange={(e) => set(k, +e.target.value || 0)} /></div>
  const dl = () => { const b = new Blob([exportJSON(getState())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `copia-estudio-${new Date().toISOString().slice(0, 10)}.json`; a.click() }
  const imp = async (f?: File) => { if (!f) return; try { replaceState(importJSON(await f.text())); setMsg('✔ Copia restaurada') } catch (e) { setMsg('✘ Archivo no válido: ' + (e as Error).message) } }
  return <div><BackBar title="Ajustes" onBack={back} />
    <Card className="mb-3 space-y-3"><b>Carga de trabajo</b><div className="grid grid-cols-2 gap-2">{num('minMorning', 'Min. mañana')}{num('minAfternoon', 'Min. tarde')}{num('maxItemsDay', 'Máx. artículos/día')}{num('secPerItem', 'Seg. por artículo')}{num('classMinutes', 'Min. de clase')}{num('coverageDays', 'Ventana cobertura (días)')}</div>
      <div><label className="text-sm text-slate-400">Día de descanso</label><select value={st.restDay} onChange={(e) => set('restDay', +e.target.value)}>{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div></Card>
    <Card className="mb-3 space-y-3"><b>Orden de memorización</b><div className="text-sm text-slate-300">{st.order.map((t) => 'T' + t).join(' → ')}</div><Btn kind="ghost" onClick={() => set('order', DEFAULT_ORDER)}>Restaurar T18→T30, T7→T17, T1→T6</Btn></Card>
    <Card className="mb-3 space-y-3"><b>Alcance de artículos por tema</b><div className="text-sm text-slate-400">Define qué artículos exige el programa (p. ej. «1-9, 166-169»). Vacío = el alcance por defecto del tema (ver Temario).</div>
      <select value={th} onChange={(e) => setTh(+e.target.value)}>{THEMES.map((t) => <option key={t.id} value={t.id}>T{t.id} · {t.title}</option>)}</select>
      <input key={th} placeholder="1-9, 166-169, Anexo II" defaultValue={st.scope[th] ?? ''} onBlur={(e) => { const sc = { ...st.scope }; if (e.target.value.trim()) sc[th] = e.target.value.trim(); else delete sc[th]; set('scope', sc) }} /></Card>
    <Card className="mb-3 space-y-2"><b>Modo DEMO</b><div className="text-sm text-slate-400">Carga texto FICTICIO en T18/T19 para probar la app mientras no hay legislación importada. Apágalo cuando uses datos reales.</div><label className="flex min-h-11 items-center gap-2"><input className="!w-5" type="checkbox" checked={st.demo} onChange={(e) => set('demo', e.target.checked)} /> Activar DEMO <Badge k="demo" /></label></Card>
    <Card className="mb-3 space-y-2"><b>Copia de seguridad</b><div className="text-sm text-slate-400">Todo tu progreso vive en este dispositivo. Exporta con frecuencia (p. ej. cada sábado) y guarda el archivo en iCloud/Drive.</div><Btn onClick={dl} className="w-full">⬇ Exportar copia (JSON)</Btn><label className="block"><span className="mb-1 block text-sm text-slate-400">Restaurar desde archivo</span><input type="file" accept="application/json" onChange={(e) => imp(e.target.files?.[0])} /></label>{msg && <div className="text-sm">{msg}</div>}
      <Btn kind="danger" className="w-full" onClick={() => { if (confirm('¿Borrar TODO el progreso? Exporta antes una copia.')) replaceState(defaultState()) }}>Borrar todo el progreso</Btn></Card>
  </div>
}

function Fuentes({ back }: { back: () => void }) {
  return <div><BackBar title="Fuentes jurídicas" onBack={back} /><div className="mb-2 text-sm text-slate-400">Solo BOE/BOIB. Registro: tema, norma, artículo, fuente, URL, fecha de consulta, versión, vigencia, última verificación.</div>
    <div className="space-y-2">{REGISTRY.map((r) => { const l = LAWS[r.id]; return <Card key={r.id} className="!py-3"><div className="font-semibold">{r.short} <span className="font-normal text-slate-400">· {r.name}</span></div>
      <div className="mt-1 flex flex-wrap gap-1">{l ? <><Chip color="green">IMPORTADA · {l.articles.length} art.</Chip><Chip>consultada {l.checkedAt}</Chip><Chip>versión {l.version || '—'}</Chip></> : <Chip color="red">PENDIENTE DE FUENTE</Chip>}{!r.boeId && <Chip color="amber">{(r as any).boibOnly ? 'solo BOIB: importación manual' : 'falta identificador BOE'}</Chip>}</div>
      {l?.sourceUrl && <a className="text-xs text-blue-300 underline" href={l.sourceUrl} target="_blank" rel="noreferrer">{l.sourceUrl}</a>}</Card> })}</div></div>
}
