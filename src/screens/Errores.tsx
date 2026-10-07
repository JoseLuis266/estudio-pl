import { useState } from 'react'
import { Card, Btn, Chip, H, useDate, Empty, BackBar } from '../ui'
import { QuizRunner, QuizResultView, QuizResult } from '../components'
import { useStore, update, answerQuestion, saveAttempt } from '../lib/store'
import { buildQuiz } from '../lib/quiz'
import { CAT_LABEL } from '../lib/types'
import { THEMES } from '../lib/content'
import type { Question } from '../lib/types'

export default function Errores() {
  const s = useStore((x) => x); const d = useDate()
  const [run, setRun] = useState<Question[] | null>(null); const [res, setRes] = useState<QuizResult | null>(null)
  const all = Object.values(s.errors).sort((a, b) => b.fails - a.fails || (a.lastFail < b.lastFail ? 1 : -1))
  const pend = all.filter((e) => e.streak < 3); const done = all.filter((e) => e.streak >= 3)
  if (res) return <QuizResultView r={res} label="Repaso de errores" onClose={() => { setRes(null); setRun(null) }} />
  if (run) return <div><BackBar title="Repasar mis errores" onBack={() => setRun(null)} /><QuizRunner questions={run} title="Errores" onAnswer={(q, g, ms) => update((x) => answerQuestion(x, q, g, d, ms))} onFinish={(r) => { update((x) => saveAttempt(x, { id: 'e' + Date.now(), d, kind: 'errores', n: r.n, ok: r.ok, ko: r.ko, blank: r.blank, score: r.score, sec: r.sec, weak: r.weak })); setRes(r) }} /></div>
  return <div><H sub="Los fallos se guardan solos. Los recurrentes salen más; los dominados se espacian.">Cuaderno de errores</H>
    <Card className="mb-3 flex items-center justify-between"><div><div className="text-3xl font-bold">{pend.length}</div><div className="text-sm text-slate-400">pendientes · {done.length} dominados</div></div><Btn disabled={!pend.some((e) => e.q)} onClick={() => setRun(buildQuiz(s, { n: 20, onlyErrors: true }, d))}>Repasar mis errores</Btn></Card>
    {all.length === 0 && <Empty>Sin errores todavía. Cuando falles algo aparecerá aquí.</Empty>}
    <div className="space-y-2">{all.map((e) => <Card key={e.id} className="!py-3">
      <div className="mb-1 flex flex-wrap gap-1"><Chip color={e.streak >= 3 ? 'green' : 'red'}>{e.streak >= 3 ? 'dominado' : `racha ${e.streak}/3`}</Chip><Chip>T{e.themeId} · {THEMES[e.themeId - 1]?.title.slice(0, 28)}</Chip>{e.q && <Chip color="amber">{CAT_LABEL[e.q.cat]}</Chip>}<Chip color="red">fallado {e.fails}×</Chip></div>
      <div className="text-sm">{e.q ? e.q.prompt : 'Recuerdo de artículo (repaso fallado)'}</div>
      {e.q && <div className="mt-1 text-sm"><span className="text-red-300">Tu respuesta: {e.given || '—'}</span> · <span className="text-emerald-300">Correcta: {e.q.answer}</span></div>}
      {e.q && <div className="mt-1 text-xs text-slate-400">{e.q.source} · último fallo {e.lastFail}{e.lastOk ? ` · último acierto ${e.lastOk}` : ''} · próximo {e.due}</div>}</Card>)}</div></div>
}
