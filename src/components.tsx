import { useEffect, useMemo, useRef, useState } from 'react'
import type { Grade, Item, Question } from './lib/types'
import { CAT_LABEL } from './lib/types'
import { Card, Btn, Chip, Badge, GradeButtons, Bar, H, pct } from './ui'
import { articleLabel } from './lib/content'
import { autoEsquema, autoPostit, compareRecall, conceptOf, keyFacts, RecallResult } from './lib/generators'
import { update, setNote, reportQuestion, useStore } from './lib/store'

const SrcInfo = ({ item }: { item: Item }) => {
  const l = item.law
  return (
    <div className="text-xs text-slate-400">
      {l.demo ? <Badge k="demo" /> : l.verified ? <Chip color="green">FUENTE VERIFICADA</Chip> : <Chip color="red">SIN VERIFICAR</Chip>}{' '}
      {l.sourceUrl && <a className="underline" href={l.sourceUrl} target="_blank" rel="noreferrer">{l.sourceUrl}</a>}
      <div>Consultado: {l.checkedAt || '—'} · Versión: {l.version || '—'} · Alcance: {item.conf}</div>
      {l.warning && <div className="mt-1 font-semibold text-amber-300">⚠️ {l.warning}</div>}
      {item.article.changed && <div className="mt-1 font-bold text-amber-300">⚠️ POSIBLE CAMBIO LEGISLATIVO ({item.article.changed.at}) — revisa el texto</div>}
    </div>
  )
}
export const OfficialText = ({ item }: { item: Item }) => (
  <div>
    <div className="mb-1 flex flex-wrap items-center gap-2"><Badge k={item.law.demo ? 'demo' : 'oficial'} /><b>{articleLabel(item)}</b>{item.article.title && <span className="text-slate-300">· {item.article.title.replace(/\.$/, '')}</span>}{item.law.warning && <Chip color="amber">texto original, no consolidado</Chip>}</div>
    <div className="space-y-2 text-[17px] leading-relaxed">{item.article.paras.map((p, i) => <p key={i}>{p}</p>)}</div>
  </div>
)

export function ArticleView({ item }: { item: Item }) {
  const note = useStore((s) => s.notes[item.id]) ?? {}
  const [tab, setTab] = useState('texto')
  const concept = conceptOf(item, note)
  const facts = useMemo(() => keyFacts(item), [item])
  const edit = (k: 'concept' | 'postit' | 'esquema' | 'personal' | 'trampas', label: string, auto?: string) => (
    <div>
      <textarea rows={k === 'concept' ? 2 : 5} placeholder={label} defaultValue={note[k] ?? ''} onBlur={(e) => update((s) => setNote(s, item.id, { [k]: e.target.value.trim() || undefined }))} />
      {!note[k] && auto && <div className="mt-2 rounded-xl bg-[#0d1527] p-3 text-sm"><Chip color="violet">GENERADO AUTOMÁTICAMENTE · no es texto de la ley</Chip><pre className="mt-2 font-mono text-[13px]">{auto}</pre></div>}
    </div>
  )
  const tabs = [['texto', 'Texto'], ['mapa', 'Mapa'], ['postit', 'Post-it'], ['esquema', 'Esquema'], ['datos', 'Datos'], ['trampas', 'Trampas'], ['personal', 'Personal'], ['fuente', 'Fuente']]
  return (
    <div>
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${tab === k ? 'bg-blue-600' : 'bg-[#1a2744]'}`}>{l}</button>)}</div>
      {tab === 'texto' && <OfficialText item={item} />}
      {tab === 'mapa' && <div><div className="mb-2 flex gap-2"><Badge k="didactica" /><Chip>{concept.kind === 'personal' ? 'tuyo' : concept.kind === 'oficial' ? 'título oficial' : 'auto (1ª frase)'}</Chip></div><div className="mb-2 text-lg">{articleLabel(item)} → <b>{concept.text}</b></div>{edit('concept', 'Concepto principal (tuyo; se usa en Artículo ↔ Concepto)')}</div>}
      {tab === 'postit' && <div><div className="mb-2"><Badge k="postit" /></div>{edit('postit', 'Tu post-it: máxima reducción, frase comprensible, mismo vocabulario jurídico y todos los datos preguntables', autoPostit(item))}</div>}
      {tab === 'esquema' && <div><div className="mb-2"><Badge k="esquema" /></div>{edit('esquema', 'Tu esquema rápido (árbol)', autoEsquema(item))}</div>}
      {tab === 'datos' && <div><div className="mb-2"><Badge k="didactica" /> datos preguntables detectados</div>{facts.length ? facts.map((f, i) => <div key={i} className="mb-2 text-sm">{f.hits.map((h, j) => <Chip key={j} color="amber">{CAT_LABEL[h.cat]}: {h.text}</Chip>)} <span className="text-slate-300">{f.s}</span></div>) : <div className="text-slate-400">Sin números, plazos, mayorías u órganos detectados.</div>}</div>}
      {tab === 'trampas' && <div><div className="mb-2"><Badge k="personal" /></div>{edit('trampas', 'Trampas de test / excepciones / relaciones con otros artículos')}</div>}
      {tab === 'personal' && <div><div className="mb-2"><Badge k="personal" /> separado del texto oficial, nunca lo sobrescribe</div>{edit('personal', 'Apuntes, material de academia…')}</div>}
      {tab === 'fuente' && <SrcInfo item={item} />}
    </div>
  )
}

/** Sesión de recuperación activa: recordar → revelar → comparar → valorar. (Memorización, repasos y repaso integral del sábado.) */
export function RecallSession({ items, mode, onGrade, onDone, title }: { items: Item[]; mode: 'memorize' | 'review' | 'weekly'; onGrade: (i: Item, g: Grade, ms: number) => void; onDone: () => void; title: string }) {
  type Step = { t: 'item'; item: Item } | { t: 'cum'; items: Item[] } | { t: 'map' }
  const steps = useMemo<Step[]>(() => {
    const out: Step[] = []
    items.forEach((it, k) => { out.push({ t: 'item', item: it }); if (mode === 'memorize' && (k + 1) % 4 === 0 && k + 1 < items.length) out.push({ t: 'cum', items: items.slice(k - 3, k + 1) }) })
    if (mode === 'memorize' && items.length > 1) out.push({ t: 'map' })
    return out
  }, [items, mode])
  const [k, setK] = useState(0)
  const [phase, setPhase] = useState<'read' | 'recall' | 'reveal'>(mode === 'memorize' ? 'read' : 'recall')
  const [txt, setTxt] = useState('')
  const [lectura, setLectura] = useState(false)
  const t0 = useRef(Date.now())
  const step = steps[k]
  const next = () => { setK((x) => x + 1); setTxt(''); setLectura(false); setPhase(mode === 'memorize' ? 'read' : 'recall'); t0.current = Date.now() }
  useEffect(() => { t0.current = Date.now() }, [k, phase])
  if (!step) return <Card className="text-center"><div className="mb-3 text-lg font-bold">✅ Sesión terminada</div><div className="mb-3 text-slate-300">{items.length} elemento(s) trabajados.</div><Btn onClick={onDone}>Volver</Btn></Card>
  const pr = k / steps.length
  const head = <div className="mb-3"><div className="mb-1 flex justify-between text-sm text-slate-400"><span>{title}</span><span>{k + 1}/{steps.length}</span></div><Bar v={pr} /></div>
  if (step.t === 'cum') return <div>{head}<Card><H sub="Sin mirar: di en voz alta qué dice cada uno">🔁 Recuperación acumulativa</H><ul className="mb-4 space-y-1">{step.items.map((i) => <li key={i.id} className="text-lg">• {articleLabel(i)} <span className="text-slate-400">— {conceptOf(i).text}</span></li>)}</ul><Btn onClick={next}>Hecho</Btn></Card></div>
  if (step.t === 'map') return <div>{head}<Card><H sub="Reconstruye de memoria la estructura completa del tema">🗺️ Mapa general</H><textarea rows={5} placeholder="Escribe el esqueleto del tema (opcional)" value={txt} onChange={(e) => setTxt(e.target.value)} className="mb-3" /><Btn onClick={next}>Terminar</Btn></Card></div>
  const it = step.item
  const res: RecallResult | null = phase === 'reveal' && txt.trim() ? compareRecall(txt, it.article.paras) : null
  return (
    <div>{head}
      <Card>
        <div className="mb-2 flex items-center gap-2"><b className="text-lg">{articleLabel(it)}</b><Chip color="slate">{mode === 'memorize' ? 'Primera memorización' : mode === 'weekly' ? 'Repaso integral' : 'Repaso'}</Chip></div>
        {phase === 'read' && <><div className="mb-1 text-sm text-slate-400">1 · Lee y entiende</div><OfficialText item={it} /><div className="mt-4"><Btn onClick={() => setPhase('recall')} className="w-full">Ocultar y recordar</Btn></div></>}
        {phase === 'recall' && <><div className="mb-2 text-xl">{articleLabel(it)} — ¿qué recuerdas?</div><textarea rows={5} placeholder="Escribe o dicta lo que recuerdes (opcional: si lo dices en voz alta, salta directo a revelar)" value={txt} onChange={(e) => setTxt(e.target.value)} className="mb-3" /><Btn onClick={() => setPhase('reveal')} className="w-full">Revelar</Btn></>}
        {phase === 'reveal' && <>
          <OfficialText item={it} />
          {res && <div className="mt-3 space-y-1 rounded-xl bg-[#0d1527] p-3 text-sm"><div className="text-xs text-slate-400">Comparación léxica (no semántica) · sugerencia: {['No lo recordaba', 'Parcial', 'Bien', 'Perfecto'][res.suggested]}</div>
            <div><Chip color="green">RECORDADO {res.recordado.length}</Chip> <Chip color="amber">OMITIDO {res.omitido.length}</Chip> {res.incorrecto.length > 0 && <Chip color="red">INCORRECTO</Chip>} {res.inventado.length > 0 && <Chip color="violet">POSIBLE INVENTADO</Chip>}</div>
            {res.omitido.length > 0 && <div><b>Omitido:</b> {res.omitido.join(', ')}</div>}{res.incorrecto.length > 0 && <div className="text-red-300"><b>Incorrecto:</b> {res.incorrecto.join(', ')}</div>}{res.inventado.length > 0 && <div className="text-violet-300"><b>No aparece en el texto:</b> {res.inventado.join(', ')}</div>}</div>}
          <div className="mt-4 mb-2 text-sm text-slate-400">Compara y valora honestamente:</div>
          <GradeButtons onGrade={(g) => { onGrade(it, g, Date.now() - t0.current); next() }} />
          {mode === 'weekly' && !lectura && <button className="mt-3 w-full text-sm text-slate-400 underline" onClick={() => setLectura(true)}>Lectura pausada para detectar detalles</button>}
          {lectura && <div className="mt-2 text-sm text-slate-300">Relee despacio el texto de arriba y busca detalles que no aparecen en tus ejercicios.</div>}
        </>}
      </Card>
    </div>
  )
}

export interface QuizResult { n: number; ok: number; ko: number; blank: number; score: number; sec: number; weak: Record<string, number>; answers: { q: Question; given: string }[] }

export function QuizRunner({ questions, exam = false, timeLimit = 0, penalty = 0, allowBlank = false, onAnswer, onFinish, title }: {
  questions: Question[]; exam?: boolean; timeLimit?: number; penalty?: number; allowBlank?: boolean
  onAnswer: (q: Question, given: string, ms: number) => void; onFinish: (r: QuizResult) => void; title: string
}) {
  const [k, setK] = useState(0)
  const [given, setGiven] = useState<string | null>(null)
  const [answers, setAnswers] = useState<{ q: Question; given: string }[]>([])
  const [left, setLeft] = useState(timeLimit)
  const t0 = useRef(Date.now()); const start = useRef(Date.now())
  const q = questions[k]
  const reports = useStore((s) => s.reports)
  const finish = (ans: { q: Question; given: string }[]) => {
    const ok = ans.filter((a) => a.given === a.q.answer).length, blank = ans.filter((a) => a.given === '').length + (questions.length - ans.length)
    const ko = ans.length - ok - ans.filter((a) => a.given === '').length
    const weak: Record<string, number> = {}; ans.forEach((a) => { if (a.given !== '' && a.given !== a.q.answer) weak[a.q.cat] = (weak[a.q.cat] ?? 0) + 1 })
    onFinish({ n: questions.length, ok, ko, blank, score: Math.max(0, ((ok - penalty * ko) / Math.max(1, questions.length)) * 10), sec: Math.round((Date.now() - start.current) / 1000), weak, answers: ans })
  }
  useEffect(() => { if (!timeLimit) return; const id = setInterval(() => setLeft((x) => x - 1), 1000); return () => clearInterval(id) }, [timeLimit])
  useEffect(() => { if (timeLimit && left <= 0) finish(answers) /* eslint-disable-next-line */ }, [left])
  useEffect(() => { t0.current = Date.now() }, [k])
  if (!q) return <Card>No hay preguntas con esos filtros. Memoriza primero artículos (o activa DEMO en Ajustes).</Card>
  const choose = (g: string) => {
    if (given !== null && !exam) return
    onAnswer(q, g, Date.now() - t0.current)
    const na = [...answers, { q, given: g }]; setAnswers(na)
    if (exam) { if (k + 1 >= questions.length) finish(na); else setK(k + 1) } else setGiven(g)
  }
  const nextQ = () => { if (k + 1 >= questions.length) finish(answers); else { setK(k + 1); setGiven(null) } }
  const opts = q.kind === 'tf' ? ['V', 'F'] : q.options!
  const label = (o: string) => (q.kind === 'tf' ? (o === 'V' ? 'Verdadero' : 'Falso') : o)
  return (
    <div>
      <div className="mb-3"><div className="mb-1 flex justify-between text-sm text-slate-400"><span>{title}</span><span>{timeLimit ? `⏱ ${Math.max(0, Math.floor(left / 60))}:${String(Math.max(0, left % 60)).padStart(2, '0')} · ` : ''}{k + 1}/{questions.length}</span></div><Bar v={k / questions.length} /></div>
      <Card>
        <div className="mb-2 flex gap-2"><Badge k="pregunta" /><Chip>{CAT_LABEL[q.cat]}</Chip></div>
        <div className="mb-4 text-lg leading-relaxed">{q.kind === 'tf' ? <><div className="mb-1 text-sm text-slate-400">¿Es correcta o hay un error en la afirmación?</div>«{q.prompt}»</> : q.prompt}</div>
        <div className="space-y-2">
          {opts.map((o) => {
            const show = given !== null && !exam
            const cls = !show ? 'bg-[#1a2744]' : o === q.answer ? 'bg-emerald-700' : o === given ? 'bg-red-700' : 'bg-[#1a2744] opacity-60'
            return <button key={o} onClick={() => choose(o)} className={`min-h-12 w-full rounded-xl px-3 py-3 text-left font-medium active:opacity-80 ${cls}`}>{label(o)}</button>
          })}
          {exam && allowBlank && <button onClick={() => choose('')} className="min-h-12 w-full rounded-xl bg-[#0d1527] px-3 py-2 text-slate-400">Dejar en blanco</button>}
        </div>
        {given !== null && !exam && <div className="mt-4 space-y-2">
          <div className={`font-bold ${given === q.answer ? 'text-emerald-400' : 'text-red-400'}`}>{given === q.answer ? '✔ Correcto' : `✘ Incorrecto — correcta: ${label(q.answer)}`}</div>
          <div className="rounded-xl bg-[#0d1527] p-3 text-sm text-slate-300">{q.explanation}</div>
          <div className="flex gap-2"><Btn onClick={nextQ} className="flex-1">{k + 1 >= questions.length ? 'Ver resultado' : 'Siguiente'}</Btn><ReportBtn q={q} done={!!reports[q.id]} /></div>
        </div>}
      </Card>
    </div>
  )
}
export function ReportBtn({ q, done }: { q: Question; done: boolean }) {
  const [open, setOpen] = useState(false)
  if (done) return <Chip color="amber">reportada</Chip>
  return <div className="relative"><Btn kind="ghost" onClick={() => setOpen(!open)}>⚑</Btn>{open && <div className="absolute right-0 bottom-14 z-10 w-56 rounded-xl border border-[#26334f] bg-[#101a30] p-2 shadow-xl">{['incorrecta', 'ambigua', 'fuera de temario', 'desactualizada', 'mala explicación'].map((r) => <button key={r} className="block min-h-11 w-full rounded-lg px-3 text-left active:bg-[#1a2744]" onClick={() => { update((s) => reportQuestion(s, q.id, r, new Date().toISOString().slice(0, 10))); setOpen(false) }}>{r}</button>)}</div>}</div>
}

export function QuizResultView({ r, onClose, label }: { r: QuizResult; onClose: () => void; label: string }) {
  return (
    <Card>
      <H sub={label}>Resultado</H>
      <div className="mb-3 text-5xl font-extrabold">{r.score.toFixed(1)}<span className="text-xl text-slate-400"> /10</span></div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-emerald-900/40 p-2"><div className="text-2xl font-bold">{r.ok}</div><div className="text-xs">aciertos</div></div><div className="rounded-xl bg-red-900/40 p-2"><div className="text-2xl font-bold">{r.ko}</div><div className="text-xs">errores</div></div><div className="rounded-xl bg-slate-700/40 p-2"><div className="text-2xl font-bold">{r.blank}</div><div className="text-xs">en blanco</div></div></div>
      <div className="mb-3 text-sm text-slate-300">Tiempo: {Math.floor(r.sec / 60)} min {r.sec % 60} s · {pct(r.ok / Math.max(1, r.n))} de acierto</div>
      {Object.keys(r.weak).length > 0 && <div className="mb-3 text-sm">Fallos por tipo: {Object.entries(r.weak).map(([c, n]) => <Chip key={c} color="red">{CAT_LABEL[c as keyof typeof CAT_LABEL]}: {n}</Chip>)}</div>}
      {r.answers.filter((a) => a.given !== a.q.answer).length > 0 && <details className="mb-3"><summary className="cursor-pointer text-sm underline">Ver fallos y blancos</summary>{r.answers.filter((a) => a.given !== a.q.answer).map((a, i) => <div key={i} className="mt-2 rounded-xl bg-[#0d1527] p-3 text-sm"><div>{a.q.prompt}</div><div className="mt-1 text-emerald-300">Correcta: {a.q.answer}</div><div className="text-slate-400">{a.q.explanation}</div></div>)}</details>}
      <Btn onClick={onClose} className="w-full">Cerrar</Btn>
    </Card>
  )
}
