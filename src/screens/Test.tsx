import { useState } from 'react'
import { Card, Btn, Chip, H, useDate, BackBar, pct } from '../ui'
import { QuizRunner, QuizResultView, QuizResult } from '../components'
import { THEMES, REGISTRY } from '../lib/content'
import { useStore, update, answerQuestion, saveAttempt } from '../lib/store'
import { buildQuiz, QuizConfig } from '../lib/quiz'
import { CAT_LABEL, Cat, Question } from '../lib/types'

export default function Test({ sub }: { sub?: string }) {
  const s = useStore((x) => x); const d = useDate()
  const exam = sub === 'simulacro'
  const [scope, setScope] = useState<'all' | 'b1' | 'b2' | 'b3' | 'themes' | 'law'>('all')
  const [themes, setThemes] = useState<number[]>([]); const [law, setLaw] = useState('')
  const [n, setN] = useState(20); const [mins, setMins] = useState(exam ? 30 : 0); const [pen, setPen] = useState(exam ? 0.33 : 0)
  const [blank, setBlank] = useState(exam); const [kind, setKind] = useState<'both' | 'mcq' | 'tf'>('both')
  const [onlyErr, setOnlyErr] = useState(false); const [onlyDue, setOnlyDue] = useState(false); const [cat, setCat] = useState<Cat | ''>('')
  const [run, setRun] = useState<{ qs: Question[] } | null>(null); const [res, setRes] = useState<QuizResult | null>(null)
  const label = exam ? 'Simulacro' : 'Test'
  if (res) return <QuizResultView r={res} label={label} onClose={() => { setRes(null); setRun(null) }} />
  if (run) return <QuizRunner questions={run.qs} title={label} exam={exam} timeLimit={mins * 60} penalty={pen} allowBlank={blank} onAnswer={(q, g, ms) => update((x) => answerQuestion(x, q, g, d, ms))} onFinish={(r) => { update((x) => saveAttempt(x, { id: label + Date.now(), d, kind: exam ? 'simulacro' : 'test', n: r.n, ok: r.ok, ko: r.ko, blank: r.blank, score: r.score, sec: r.sec, weak: r.weak })); setRes(r) }} />
  const start = () => {
    const cfg: QuizConfig = { n, onlyErrors: onlyErr, onlyDue, kinds: kind === 'both' ? undefined : [kind], cats: cat ? [cat] : undefined }
    if (scope === 'b1' || scope === 'b2' || scope === 'b3') cfg.block = +scope[1] as 1 | 2 | 3
    if (scope === 'themes') cfg.themes = themes
    if (scope === 'law') cfg.law = law
    setRun({ qs: buildQuiz(s, cfg, d) })
  }
  const attempts = s.attempts.filter((a) => (exam ? a.kind === 'simulacro' : a.kind !== 'simulacro')).slice(-6).reverse()
  return <div><H sub="Distractores plausibles: podrá/deberá, simple/absoluta, órganos, plazos…">{exam ? 'Simulacro' : 'Test'}</H>
    <div className="mb-3 flex gap-2"><Chip color={!exam ? 'blue' : 'slate'}>Test</Chip><Chip color={exam ? 'blue' : 'slate'}>Simulacro</Chip></div>
    <Card className="mb-3 space-y-3">
      <div><label className="text-sm text-slate-400">Ámbito</label><select value={scope} onChange={(e) => setScope(e.target.value as any)}><option value="all">Todo el temario</option><option value="b1">Bloque 1 (T1-T6)</option><option value="b2">Bloque 2 (T7-T17)</option><option value="b3">Bloque 3 (T18-T30)</option><option value="themes">Temas concretos…</option><option value="law">Una ley…</option></select></div>
      {scope === 'themes' && <div className="flex flex-wrap gap-1">{THEMES.map((t) => <button key={t.id} onClick={() => setThemes((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))} className={`min-h-9 rounded-lg px-2 text-sm ${themes.includes(t.id) ? 'bg-blue-600' : 'bg-[#1a2744]'}`}>T{t.id}</button>)}</div>}
      {scope === 'law' && <select value={law} onChange={(e) => setLaw(e.target.value)}><option value="">— elige —</option>{REGISTRY.map((l) => <option key={l.id} value={l.id}>{l.short}</option>)}</select>}
      <div className="grid grid-cols-2 gap-2"><div><label className="text-sm text-slate-400">Nº preguntas</label><input type="number" min={1} max={200} value={n} onChange={(e) => setN(+e.target.value || 1)} /></div><div><label className="text-sm text-slate-400">Minutos (0 = sin límite)</label><input type="number" min={0} value={mins} onChange={(e) => setMins(+e.target.value || 0)} /></div></div>
      <div className="grid grid-cols-2 gap-2"><div><label className="text-sm text-slate-400">Tipo</label><select value={kind} onChange={(e) => setKind(e.target.value as any)}><option value="both">Mixto</option><option value="mcq">Huecos (opción múltiple)</option><option value="tf">Detecta el error (V/F)</option></select></div><div><label className="text-sm text-slate-400">Penalización</label><select value={pen} onChange={(e) => setPen(+e.target.value)}><option value={0}>Sin penalización</option><option value={0.25}>−0,25</option><option value={0.33}>−0,33</option><option value={0.5}>−0,5</option></select></div></div>
      <div><label className="text-sm text-slate-400">Tipo de dato</label><select value={cat} onChange={(e) => setCat(e.target.value as Cat | '')}><option value="">Todos</option>{(Object.keys(CAT_LABEL) as Cat[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></div>
      <label className="flex min-h-11 items-center gap-2"><input className="!w-5" type="checkbox" checked={onlyErr} onChange={(e) => setOnlyErr(e.target.checked)} /> Solo mis errores</label>
      <label className="flex min-h-11 items-center gap-2"><input className="!w-5" type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} /> Solo artículos con repaso vencido</label>
      {exam && <label className="flex min-h-11 items-center gap-2"><input className="!w-5" type="checkbox" checked={blank} onChange={(e) => setBlank(e.target.checked)} /> Permitir dejar en blanco</label>}
      <Btn className="w-full" onClick={start}>Empezar {label.toLowerCase()}</Btn></Card>
    <H>Historial</H>{attempts.length ? attempts.map((a) => <Card key={a.id} className="mb-2 flex justify-between !py-3 text-sm"><span>{a.d} · {a.kind}</span><span><b>{a.score.toFixed(1)}</b>/10 · {a.ok}✔ {a.ko}✘ {a.blank}○ · {pct(a.ok / Math.max(1, a.n))}</span></Card>) : <Card className="text-slate-400">Sin intentos todavía.</Card>}
    <div className="mt-3 text-xs text-slate-500">Las preguntas se generan automáticamente a partir del texto oficial importado (marcadas PREGUNTA GENERADA). Usa ⚑ para reportar las ambiguas.</div>
  </div>
}
