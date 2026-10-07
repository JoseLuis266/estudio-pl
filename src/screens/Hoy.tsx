import { useMemo } from 'react'
import { Card, Btn, Chip, H, useNav, useDate, Empty } from '../ui'
import { useStore } from '../lib/store'
import { buildDay, groupByTheme, itemsOf, themeProgress, staleItems } from '../lib/plan'
import { THEMES } from '../lib/content'
import { DAYS, fmt } from '../lib/dates'

export default function Hoy() {
  const s = useStore((x) => x); const d = useDate(); const go = useNav()
  const plan = useMemo(() => buildDay(s, d), [s, d])
  const hour = new Date().getHours()
  const wd = DAYS[new Date(d + 'T12:00').getDay()]
  const nt = plan.newTheme ? THEMES[plan.newTheme - 1] : null
  const ntp = plan.newTheme ? themeProgress(s, plan.newTheme, d) : null
  const groups = groupByTheme(plan.reviews)
  const stale = useMemo(() => staleItems(s, d).length, [s, d])
  const totalItems = THEMES.reduce((a, t) => a + itemsOf(s, t.id).length, 0)
  return (
    <div>
      <div className="mb-4"><div className="text-sm text-slate-400">{hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches'}</div><h1 className="text-3xl font-extrabold capitalize">{wd} <span className="text-lg font-medium text-slate-400">{fmt(d)}</span></h1></div>
      {totalItems === 0 && <Card className="mb-3 border-red-500/60"><b>Aún no hay texto legal cargado.</b><div className="mt-1 text-sm text-slate-300">La estructura T1–T30 está, pero el texto oficial se importa desde el BOE (<code>npm run import:boe</code>). Para probar la app activa el modo DEMO (texto ficticio) en Más → Ajustes.</div><Btn className="mt-3" kind="ghost" onClick={() => go({ tab: 'mas', sub: 'ajustes' })}>Ir a Ajustes</Btn></Card>}
      {plan.mode === 'domingo' || plan.restDay ? <Card className="mb-3 text-center"><div className="text-2xl">😌 Descanso</div><div className="mt-1 text-slate-300">Hoy no hay memorización nueva. Si algo urge, un repaso ligero opcional:</div><Btn className="mt-3" kind="ghost" onClick={() => go({ tab: 'estudio', sub: 'quick5' })}>Repaso 5 min</Btn></Card> : null}
      {plan.mode === 'sabado' && <Card className="mb-3 border-blue-500/60"><div className="text-lg font-bold">🗓 Repaso del sábado</div><div className="mb-3 text-sm text-slate-300">Consolidación semanal: integral → errores → test → balance.{plan.weeklyThemes.length ? ` Temas nuevos de la semana: ${plan.weeklyThemes.map((t) => 'T' + t).join(', ')}.` : ' Esta semana no hay temas nuevos memorizados.'}</div><Btn onClick={() => go({ tab: 'estudio', sub: 'sabado' })} className="w-full">Comenzar repaso del sábado</Btn></Card>}
      {!plan.restDay && plan.mode === 'normal' && <>
        <H>🌅 Mañana</H>
        {nt ? <Card className="mb-4"><div className="flex items-start justify-between gap-2"><div><div className="text-sm text-slate-400">Primera memorización</div><div className="text-xl font-bold">T{nt.id} · {nt.title}</div></div><Chip color="blue">{ntp!.memorized}/{ntp!.total || '—'}</Chip></div>
          {nt.pending && <div className="mt-2 text-sm text-amber-300">PENDIENTE DE FUENTE: {nt.pending}</div>}
          <div className="mt-3 flex gap-2"><Btn className="flex-1" onClick={() => go({ tab: 'estudio', sub: 'memorizar', p: { themeId: nt.id } })} disabled={!ntp!.total}>Comenzar</Btn><Btn kind="ghost" onClick={() => go({ tab: 'temario', sub: 'tema', p: { themeId: nt.id } })}>Ver tema</Btn></div></Card> : <Empty>No hay más temas por memorizar 🎉</Empty>}
        <H>🌆 Tarde</H>
        <Card className="mb-3"><div className="mb-2 font-bold">🎥 Clases</div>{plan.classThemes.length ? plan.classThemes.slice(0, 3).map((t) => <div key={t} className="mb-2 flex items-center justify-between"><span>Clase T{t}{t === plan.newTheme ? ' (hoy)' : ' (pendiente)'}</span><Btn kind="ghost" onClick={() => go({ tab: 'mas', sub: 'clases', p: { themeId: t } })}>Ver / marcar vista</Btn></div>) : <div className="text-slate-400">Sin clases pendientes ✔</div>}</Card>
        <Card className="mb-3"><div className="mb-2 flex items-center justify-between"><b>🧠 Repasos de hoy</b><Chip color={plan.reviews.length ? 'amber' : 'green'}>{plan.reviews.length}</Chip></div>
          {groups.length ? groups.map((g) => <div key={g.themeId} className="mb-1 flex justify-between text-sm"><span>T{g.themeId} — {g.items.length} art.</span><span className="text-slate-400">{[...new Set(g.items.map((x) => 'D+' + x.mem.interval))].join(' ')}{g.items.some((x) => x.overdue > 0) ? ' · vencido' : ''}</span></div>) : <div className="text-slate-400">Nada vence hoy.</div>}
          {plan.deferred.length > 0 && <div className="mt-2 rounded-lg bg-amber-900/30 p-2 text-sm">⚠ {plan.deferred.length} reprogramados por falta de tiempo (priorizados, no borrados; siguen vencidos).</div>}
          <Btn className="mt-3 w-full" disabled={!plan.reviews.length} onClick={() => go({ tab: 'estudio', sub: 'repasos' })}>Repasar</Btn></Card>
        {nt && ntp!.memorized > 0 && <Card className="mb-3"><div className="flex items-center justify-between"><b>📝 Recuerdo / test corto T{nt.id}</b><Btn kind="ghost" onClick={() => go({ tab: 'estudio', sub: 'tema-test', p: { themeId: nt.id } })}>10 preguntas</Btn></div></Card>}
        {stale > 0 && <Card className="mb-3 border-amber-500/60"><div className="flex items-center justify-between"><div><b>🕰 Contenido no revisado recientemente</b><div className="text-sm text-slate-400">{stale} artículos sin recuperar en {s.settings.coverageDays} días (aunque nunca hayan fallado)</div></div><Btn kind="ghost" onClick={() => go({ tab: 'estudio', sub: 'olvidados' })}>Repasar</Btn></div></Card>}
        <Card className="mb-3"><div className="flex items-center justify-between"><b>❌ Errores pendientes</b><Chip color={plan.errorsDue ? 'red' : 'green'}>{plan.errorsDue}</Chip></div><Btn className="mt-3 w-full" kind="ghost" onClick={() => go({ tab: 'errores' })}>Abrir cuaderno de errores</Btn></Card>
        <div className="mb-3 text-center text-sm text-slate-400">Tiempo estimado: {Math.floor(plan.estMin / 60)} h {plan.estMin % 60} min</div>
      </>}
      <Btn kind="ghost" className="w-full" onClick={() => go({ tab: 'estudio', sub: 'quick5' })}>⚡ Repaso rápido — 5 min</Btn>
    </div>
  )
}
