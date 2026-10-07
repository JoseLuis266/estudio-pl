import { Card, Chip, H, Bar, pct, useDate, useNav } from '../ui'
import { useStore } from '../lib/store'
import { dashboard, weaknesses, contentCoverage } from '../lib/stats'
import { THEMES, LAWS } from '../lib/content'
import { themeHealth, themePhase } from '../lib/plan'
import { PHASE_LABEL } from '../lib/types'

const HC: Record<string, string> = { FLOJO: 'bg-red-600', REGULAR: 'bg-orange-500', BIEN: 'bg-emerald-600', DOMINADO: 'bg-blue-500' }
export default function Progreso() {
  const s = useStore((x) => x); const d = useDate(); const go = useNav()
  const db = dashboard(s, d); const w = weaknesses(s); const cc = contentCoverage(s, LAWS)
  const att = s.attempts.filter((a) => a.kind === 'simulacro').slice(-8)
  return <div><H sub="Datos útiles, no decorativos">Progreso</H>
    <div className="mb-3 grid grid-cols-3 gap-2 text-center">
      {[[pct(db.retention), 'retención est.'], [pct(db.coverage), 'cobertura'], [db.dueToday + db.overdue, 'repasos'], [db.overdue, 'vencidos'], [db.errorsPending, 'errores'], [db.streak + ' d', 'constancia']].map(([v, l]) => <Card key={l as string} className="!p-3"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-slate-400">{l}</div></Card>)}</div>
    <Card className="mb-3"><b>30 temas</b><div className="mt-2 space-y-1 text-sm">{(Object.keys(db.phases) as (keyof typeof db.phases)[]).map((k) => <div key={k} className="flex justify-between"><span>{PHASE_LABEL[k]}</span><b>{db.phases[k]}</b></div>)}</div><div className="mt-2 text-xs text-slate-400">Tiempo estudiado (registrado): {db.minutes} min · días con estudio: {db.daysStudied}</div></Card>
    <Card className="mb-3"><b>Mapa de calor T1–T30</b><div className="mt-2 grid grid-cols-6 gap-1.5">{THEMES.map((t) => { const h = themeHealth(s, t.id, d); return <button key={t.id} onClick={() => go({ tab: 'temario', sub: 'tema', p: { themeId: t.id } })} title={PHASE_LABEL[themePhase(s, t.id, d)]} className={`min-h-11 rounded-lg text-sm font-bold ${h.label ? HC[h.label] : 'bg-[#1a2744] text-slate-500'}`}>{t.id}</button> })}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs"><span>🔴 flojo</span><span>🟠 regular</span><span>🟢 bien</span><span>🔵 dominado</span><span>⬛ sin empezar</span></div></Card>
    <Card className="mb-3"><b>Perfil de debilidades</b>{w.length > 0 && <div className="mt-2 rounded-xl bg-red-900/30 p-3"><div className="text-xs text-slate-300">TU MAYOR DEBILIDAD</div><div className="text-lg font-bold">{w[0].label.toUpperCase()}</div><button className="mt-2 min-h-11 w-full rounded-xl bg-red-700 font-semibold" onClick={() => go({ tab: 'estudio', sub: 'cat', p: { cat: w[0].cat, label: w[0].label } })}>ENTRENAR 10 MIN</button></div>}{w.length ? <div className="mt-2 space-y-2">{w.slice(0, 5).map((x, i) => <div key={x.cat}><div className="flex justify-between text-sm"><span>{i === 0 ? '⚠ ' : ''}{x.label}</span><span>{pct(x.failRate)} fallo · {x.asked} resp.</span></div><Bar v={x.failRate} color="bg-red-500" /></div>)}</div> : <div className="mt-1 text-sm text-slate-400">Necesito ≥3 respuestas por tipo de dato.</div>}</Card>
    <Card className="mb-3"><b>Simulacros</b>{att.length ? <div className="mt-2 flex h-20 items-end gap-1">{att.map((a) => <div key={a.id} className="flex-1 rounded-t bg-blue-500" style={{ height: `${Math.max(4, a.score * 10)}%` }} title={`${a.d}: ${a.score.toFixed(1)}`} />)}</div> : <div className="mt-1 text-sm text-slate-400">Aún sin simulacros.</div>}</Card>
    <Card className="mb-3"><b>Cobertura del contenido (honesta)</b>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between"><span>Temas con artículos incorporados</span><b>{cc.themesWith}/{cc.themes}</b></div>
        <div className="flex justify-between"><span>Temas con alcance pendiente de definir</span><b>{cc.themesPending}</b></div>
        <div className="flex justify-between"><span>Artículos incorporados</span><b>{cc.articles}{cc.demo ? ` (${cc.demo} DEMO)` : ''}</b></div>
        <div className="flex justify-between"><span>Con fuente verificada</span><b>{pct(cc.verifiedPct)}</b></div>
        <div className="flex justify-between"><span>Con preguntas generadas</span><b>{pct(cc.withQuestionsPct)}</b></div>
        <div className="flex justify-between"><span>Preguntas · flashcards · cloze</span><b>{cc.questions} · {cc.flashcards} · {cc.cloze}</b></div>
        <div className="flex justify-between"><span>Nunca preguntados</span><b>{pct(cc.neverAskedPct)}</b></div>
      </div>{cc.demo > 0 && <div className="mt-2"><Chip color="red">HAY CONTENIDO DEMO — NO ES LEGISLACIÓN</Chip></div>}
      {cc.articles === 0 && <div className="mt-2 text-sm text-amber-300">La app no está completa: falta importar el texto oficial.</div>}</Card>
  </div>
}
