import { useState } from 'react'
import { Card, Btn, Chip, BackBar, Badge, useDate } from '../ui'
import { THEMES } from '../lib/content'
import { useStore, update, addMaterial, deleteMaterial, MatRec } from '../lib/store'

/** Extrae TEXTO de un PDF en el navegador (pdf.js cargado bajo demanda). Nunca se ejecuta contenido importado. */
async function pdfText(f: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent()
    out.push(c.items.map((it: any) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''))
  }
  return out.join('\n\n').replace(/[ \t]+\n/g, '\n')
}

export function MaterialList({ items, compact }: { items: MatRec[]; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!items.length) return <div className="text-sm text-slate-400">Sin material personal.</div>
  return <div className="space-y-2">{items.map((m) => <Card key={m.id} className="!py-3">
    <div className="flex items-start justify-between gap-2"><button className="min-h-10 flex-1 text-left font-semibold" onClick={() => setOpen(open === m.id ? null : m.id)}>{m.title}</button><Badge k="personal" /></div>
    <div className="text-xs text-slate-400">{m.origin === 'academia' ? 'Academia' : 'Propio'}{m.themeId ? ` · T${m.themeId}` : ''}{m.file ? ` · ${m.file}` : ''} · {m.at}</div>
    {open === m.id && <><pre className="mt-2 max-h-96 overflow-y-auto rounded-xl bg-[#0d1527] p-3 text-sm">{m.text}</pre>{!compact && <Btn kind="danger" className="mt-2" onClick={() => { if (confirm('¿Borrar este material?')) update((s) => deleteMaterial(s, m.id)) }}>Borrar</Btn>}</>}
  </Card>)}</div>
}

export default function Material({ back }: { back: () => void }) {
  const mats = useStore((s) => s.material); const d = useDate()
  const [title, setTitle] = useState(''); const [theme, setTheme] = useState<number | ''>(''); const [origin, setOrigin] = useState<'personal' | 'academia'>('academia')
  const [text, setText] = useState(''); const [file, setFile] = useState<string | undefined>(); const [msg, setMsg] = useState(''); const [filter, setFilter] = useState<number | ''>('')
  const load = async (f?: File) => {
    if (!f) return
    if (f.size > 30_000_000) { setMsg('✘ Archivo demasiado grande (máx. 30 MB)'); return }
    setMsg('Leyendo…')
    try {
      const t = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await pdfText(f) : /\.(txt|md|markdown|csv)$/i.test(f.name) || f.type.startsWith('text/') ? await f.text() : null
      if (t === null) { setMsg('✘ Formato no admitido (PDF, TXT o MD)'); return }
      setText(t); setFile(f.name); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); setMsg(`✔ ${t.length.toLocaleString('es')} caracteres extraídos (solo texto). Revisa y guarda.`)
    } catch (e) { setMsg('✘ No se pudo leer: ' + (e as Error).message) }
  }
  const save = () => { update((s) => addMaterial(s, { title, themeId: theme || undefined, text, origin, file }, d)); setTitle(''); setText(''); setFile(undefined); setMsg('✔ Guardado como MATERIAL PERSONAL (no modifica la legislación oficial)') }
  const shown = mats.filter((m) => !filter || m.themeId === filter)
  return <div><BackBar title="Material personal / academia" onBack={back} />
    <Card className="mb-3 space-y-3"><div className="flex items-center gap-2"><b>Añadir</b><Badge k="personal" /></div>
      <div className="text-sm text-slate-400">Apuntes, post-its o temario de academia (PDF/TXT/MD o texto pegado). Se guarda aparte: nunca sustituye al texto oficial del BOE/BOIB.</div>
      <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(e) => load(e.target.files?.[0])} />
      <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-2"><select value={theme} onChange={(e) => setTheme(e.target.value ? +e.target.value : '')}><option value="">Sin tema</option>{THEMES.map((t) => <option key={t.id} value={t.id}>T{t.id}</option>)}</select><select value={origin} onChange={(e) => setOrigin(e.target.value as any)}><option value="academia">Academia</option><option value="personal">Propio</option></select></div>
      <textarea rows={6} placeholder="…o pega aquí el texto" value={text} onChange={(e) => setText(e.target.value)} />
      {msg && <div className="text-sm">{msg}</div>}
      <Btn className="w-full" disabled={!text.trim()} onClick={save}>Guardar material</Btn></Card>
    <div className="mb-2 flex items-center justify-between"><b>Guardado ({mats.length})</b><select className="!w-32" value={filter} onChange={(e) => setFilter(e.target.value ? +e.target.value : '')}><option value="">Todos</option>{THEMES.map((t) => <option key={t.id} value={t.id}>T{t.id}</option>)}</select></div>
    <MaterialList items={shown} />
    {mats.length > 0 && <div className="mt-2"><Chip>El material se incluye en la copia de seguridad y en el buscador</Chip></div>}
  </div>
}
