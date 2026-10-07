import { ReactNode, useMemo, useRef, useState } from 'react'
import { Card, Btn, Chip, H, BackBar, useNav, useDate, Bar, Empty } from '../ui'
import { RecallSession, QuizRunner, QuizResultView, QuizResult } from '../components'
import { THEMES, articleLabel } from '../lib/content'
import { useStore, update, memorize, reviewItem, answerQuestion, completeWeekly, saveAttempt, recordFlash, assignTheme } from '../lib/store'
import { allThemeItems, buildDay, itemsOf, weeklyItems, themeHealth, dueItems, staleItems } from '../lib/plan'
import { findHits, sentencesOf } from '../lib/generators'
import { buildQuiz, quick5, weeklyTest } from '../lib/quiz'
import { conceptOf, flashcards, Flash, shuffle, rng, hash } from '../lib/generators'
import { weekStart } from '../lib/dates'
import type { Grade, Item, Question } from '../lib/types'

function QuizFlow({ make, title, kind, back }: { make: () => Question[]; title: string; kind: string; back: () => void }) {
  const d = useDate(); const [res, setRes] = useState<QuizResult | null>(null)
  const [qs] = useState(make) // congeladas: el estado cambia al responder y no debe reordenar la sesión
  if (res) return <QuizResultView r={res} label={title} onClose={back} />
  return <QuizRunner questions={qs} title={title} onAnswer={(q, g, ms) => update((s) => answerQuestion(s, q, g, d, ms))} onFinish={(r) => { update((s) => saveAttempt(s, { id: kind + Date.now(), d, kind, n: r.n, ok: r.ok, ko: r.ko, blank: r.blank, score: r.score, sec: r.sec, weak: r.weak })); setRes(r) }} />
}

function FlashDrill({ dir, back }: { dir: 'art2con' | 'con2art'; back: () => void }) {
  const s = useStore((x) => x); const d = useDate()
  const cards = useMemo<Flash[]>(() => {
    const items = allThemeItems(s); const pool = items.filter((i) => s.mem[i.id]); const src = pool.length ? pool : items
    return shuffle(src.flatMap((i) => flashcards(i, s.notes[i.id])).filter((f) => f.kind === dir), rng(hash(d + dir))).slice(0, 15)
    // eslint-disable-next-line
  }, [dir])
  const [k, setK] = useState(0); const [rev, setRev] = useState(false); const t0 = useRef(Date.now())
  const c = cards[k]
  if (!c) return <Card className="text-center"><div className="mb-3 text-lg font-bold">{cards.length ? '✅ Tarjetas terminadas' : 'No hay tarjetas (importa texto o activa DEMO)'}</div><Btn onClick={back}>Volver</Btn></Card>
  return <div><div className="mb-2 text-sm text-slate-400">{dir === 'art2con' ? 'Artículo → concepto' : 'Concepto → artículo'} · {k + 1}/{cards.length}</div><Bar v={k / cards.length} />
    <Card className="mt-3"><div className="mb-4 text-2xl font-bold">{c.front}</div>{rev ? <><div className="mb-1 text-sm text-slate-400">Respuesta</div><div className="mb-4 text-xl text-emerald-300">{c.back}</div><div className="grid grid-cols-2 gap-2"><Btn kind="danger" onClick={() => { update((s2) => recordFlash(s2, c.itemId, c.kind, false, d, Date.now() - t0.current)); setK(k + 1); setRev(false); t0.current = Date.now() }}>Fallé</Btn><Btn kind="ok" onClick={() => { update((s2) => recordFlash(s2, c.itemId, c.kind, true, d, Date.now() - t0.current)); setK(k + 1); setRev(false); t0.current = Date.now() }}>Acerté</Btn></div></> : <Btn className="w-full" onClick={() => setRev(true)}>Revelar</Btn>}</Card></div>
}

/** Congela la lista de elementos al empezar: el estado cambia con cada valoración y no debe saltar elementos. */
function Frozen({ make, render, empty, back }: { make: () => Item[]; render: (items: Item[]) => ReactNode; empty: string; back: () => void }) {
  const [items] = useState(make)
  return items.length ? render(items) : <div><BackBar title="Sesión" onBack={back} /><Empty>{empty}</Empty></div>
}

function Sabado({ back }: { back: () => void }) {
  const s = useStore((x) => x); const d = useDate(); const go = useNav()
  const week = weekStart(d); const items = useMemo(() => weeklyItems(s, d), [d]) // eslint-disable-line
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1)
  const grades = useRef<Record<string, Grade>>({})
  const themes = [...new Set(items.map((i) => i.themeId))]
  const [res, setRes] = useState<QuizResult | null>(null)
  const qs = useMemo(() => weeklyTest(s, items, d), [phase === 3]) // eslint-disable-line
  const errs = Object.values(s.errors).filter((e) => e.streak < 3)
  const steps = ['1 Integral', '2 Errores', '3 Test', '4 Balance']
  return <div><BackBar title="Repaso del sábado" onBack={back} />
    <div className="mb-3 flex gap-1">{steps.map((l, i) => <Chip key={l} color={phase === i + 1 ? 'blue' : phase > i + 1 ? 'green' : 'slate'}>{l}</Chip>)}</div>
    {phase === 1 && (items.length ? <RecallSession items={items} mode="weekly" title={`Temas de la semana: ${themes.map((t) => 'T' + t).join(', ')}`} onGrade={(i, g) => { grades.current[i.id] = g }} onDone={() => { update((x) => completeWeekly(x, week, grades.current, d)); setPhase(2) }} />
      : <Card className="text-center"><div className="mb-3">Esta semana no hay temas memorizados por primera vez.</div><Btn onClick={() => setPhase(2)}>Continuar</Btn></Card>)}
    {phase === 2 && <div><H sub="Errores, artículos débiles, números/plazos y competencias confundidas">Errores semanales</H>
      {errs.length ? <Card className="mb-3 space-y-2 text-sm">{errs.slice(0, 15).map((e) => <div key={e.id} className="border-b border-[#1f2c47] pb-2">{e.q ? e.q.prompt : `Recuerdo de ${e.itemId}`}<div className="text-xs text-slate-400">fallado {e.fails}× · {e.q ? e.q.cat : 'artículo'}</div></div>)}{errs.length > 15 && <div>… y {errs.length - 15} más</div>}</Card> : <Card className="mb-3">Sin errores pendientes 🎉</Card>}
      <Btn className="w-full" onClick={() => setPhase(3)}>Siguiente: test semanal</Btn></div>}
    {phase === 3 && (res ? <><QuizResultView r={res} label="Test semanal mixto" onClose={() => setPhase(4)} /></> : <QuizRunner questions={qs} title="Test semanal (nuevo + errores + mantenimiento)" onAnswer={(q, g, ms) => update((x) => answerQuestion(x, q, g, d, ms))} onFinish={(r) => { update((x) => saveAttempt(x, { id: 'w' + Date.now(), d, kind: 'semanal', n: r.n, ok: r.ok, ko: r.ko, blank: r.blank, score: r.score, sec: r.sec, weak: r.weak })); setRes(r) }} />)}
    {phase === 4 && <div><H sub="Datos objetivos: retención + cobertura + aciertos (no solo tu percepción)">Balance</H>
      {themes.length ? themes.map((t) => { const h = themeHealth(s, t, d); const em = { FLOJO: '🔴', REGULAR: '🟠', BIEN: '🟢', DOMINADO: '🔵' }[h.label ?? 'FLOJO']; return <Card key={t} className="mb-2 flex items-center justify-between"><span>{em} T{t} · {THEMES[t - 1].title}</span><Chip>{h.label}</Chip></Card> }) : <Card>Sin temas nuevos esta semana.</Card>}
      <Btn className="mt-3 w-full" onClick={() => { back(); go({ tab: 'progreso' }) }}>Ver progreso</Btn></div>}
  </div>
}

export default function Estudio({ sub, p }: { sub?: string; p?: any }) {
  const s = useStore((x) => x); const d = useDate(); const go = useNav()
  const back = () => go({ tab: 'estudio' })
  if (sub === 'memorizar') {
    const t = THEMES[p.themeId - 1]; const all = itemsOf(s, t.id); const pending = all.filter((i) => !s.mem[i.id])
    return <Memorizar themeId={t.id} all={all} pending={pending} back={back} />
  }
  if (sub === 'repasos') return <Frozen make={() => buildDay(s, d).reviews.map((x) => x.item)} empty="Nada vence hoy 🎉" back={back} render={(items) => <RecallSession items={items} mode="review" title="Repasos programados" onGrade={(i, g, ms) => update((x) => reviewItem(x, i.id, d, g, 'review', ms))} onDone={back} />} />
  if (sub === 'tema-repaso') return <Frozen make={() => itemsOf(s, p.themeId).filter((i) => s.mem[i.id])} empty="Nada memorizado en este tema" back={back} render={(items) => <RecallSession items={items} mode="weekly" title={`Repaso integral T${p.themeId}`} onGrade={(i, g, ms) => update((x) => reviewItem(x, i.id, d, g, 'integral', ms))} onDone={back} />} />
  if (sub === 'sabado') return <Sabado back={back} />
  if (sub === 'quick5') { return <div><BackBar title="Repaso rápido · 5 min" onBack={back} /><QuizFlow make={() => { const qs = quick5(s, d); return qs.length ? qs : buildQuiz(s, { n: 10 }, d) }} title="Repaso 5 min" kind="5min" back={back} /></div> }
  if (sub === 'cloze') return <div><BackBar title="Cloze · huecos" onBack={back} /><QuizFlow make={() => buildQuiz(s, { n: 15, kinds: ['mcq'] }, d)} title="Cloze" kind="cloze" back={back} /></div>
  if (sub === 'detecta') return <div><BackBar title="Detecta el error" onBack={back} /><QuizFlow make={() => buildQuiz(s, { n: 15, kinds: ['tf'] }, d)} title="Detecta el error" kind="detecta" back={back} /></div>
  if (sub === 'olvidados') return <Frozen make={() => staleItems(s, d)} empty="Todo lo memorizado se ha recuperado recientemente ✔" back={back} render={(items) => <RecallSession items={items} mode="weekly" title="Contenido no revisado recientemente" onGrade={(i, g, ms) => update((x) => reviewItem(x, i.id, d, g, 'cobertura', ms))} onDone={back} />} />
  if (sub === 'cat') return <div><BackBar title={`Entrenar: ${p.label}`} onBack={back} /><QuizFlow make={() => buildQuiz(s, { n: 20, cats: [p.cat] }, d)} title={`Entrenar 10 min · ${p.label}`} kind={'cat:' + p.cat} back={back} /></div>
  if (sub === 'tema-test') return <div><BackBar title={`Test corto T${p.themeId}`} onBack={back} /><QuizFlow make={() => buildQuiz(s, { n: 10, themes: [p.themeId] }, d)} title={`Test corto T${p.themeId}`} kind="tema" back={back} /></div>
  if (sub === 'comp-inv') return <CompInv back={back} />
  if (sub === 'competencias') return <div><BackBar title="¿De quién es esta competencia?" onBack={back} /><QuizFlow make={() => buildQuiz(s, { n: 15, cats: ['organo'] }, d)} title="Competencias / órganos" kind="competencias" back={back} /></div>
  if (sub === 'art2con' || sub === 'con2art') return <div><BackBar title="Flashcards" onBack={back} /><FlashDrill dir={sub} back={back} /></div>
  if (sub === 'libre') return <Libre back={back} />
  const menu: [string, string, string, string?][] = [
    ['🧠', 'Repasos programados', 'repasos'], ['🗓', 'Repaso del sábado', 'sabado'], ['✍️', 'Recuerdo libre', 'libre'],
    ['🔁', 'Artículo → concepto', 'art2con'], ['↩️', 'Concepto → artículo', 'con2art'], ['🧩', 'Cloze (huecos)', 'cloze'],
    ['🕵️', 'Detecta el error', 'detecta'], ['🏛', 'Competencias', 'competencias'], ['🧭', 'Competencias de… (inverso)', 'comp-inv'], ['🕰', 'No revisado recientemente', 'olvidados'], ['⚡', 'Repaso 5 min', 'quick5'], ['🎧', 'Audio', 'audio']
  ]
  const today = buildDay(s, d).newTheme
  return <div><H sub="Recuperación activa: recordar antes de mirar">Estudio</H>
    {today && <Card className="mb-3 border-blue-500/60"><div className="text-sm text-slate-400">Mañana · primera memorización</div><div className="mb-2 font-bold">T{today} · {THEMES[today - 1].title}</div><div className="flex gap-2"><Btn className="flex-1" disabled={!itemsOf(s, today).length} onClick={() => go({ tab: 'estudio', sub: 'memorizar', p: { themeId: today } })}>Memorizar</Btn><Btn kind="ghost" onClick={() => update((x) => assignTheme(x, d, s.settings.order[(s.settings.order.indexOf(today) + 1) % 30]))}>Cambiar tema</Btn></div></Card>}
    <div className="grid grid-cols-2 gap-2">{menu.map(([e, l, k]) => <Card key={k} onClick={() => (k === 'audio' ? go({ tab: 'mas', sub: 'audio' }) : go({ tab: 'estudio', sub: k }))} className="!p-3 text-center"><div className="text-3xl">{e}</div><div className="mt-1 text-sm font-semibold">{l}</div></Card>)}</div></div>
}

function Memorizar({ themeId, all, pending, back }: { themeId: number; all: Item[]; pending: Item[]; back: () => void }) {
  const d = useDate(); const s = useStore((x) => x)
  const [queue, setQueue] = useState<Item[] | null>(null); const on = !!queue; const t = THEMES[themeId - 1]
  if (!on) return <div><BackBar title={`Memorizar T${themeId}`} onBack={back} />
    <Card className="mb-3"><div className="mb-1 font-bold">{t.title}</div><div className="mb-2 text-sm text-slate-300">{t.scope}</div><Bar v={all.length ? (all.length - pending.length) / all.length : 0} /><div className="mt-1 text-xs text-slate-400">{all.length - pending.length}/{all.length} memorizados · objetivo hoy: {pending.length} artículos pendientes</div></Card>
    <Card className="mb-3 text-sm text-slate-300"><b>Método:</b> leer y entender → ocultar → intentar recordar → revelar → comparar → repetir si hay fallo. Cada 4 artículos: recuperación acumulativa; al final: mapa del tema. Cuida: vocabulario jurídico, órganos, competencias, números, plazos, mayorías, excepciones, podrá/deberá.</Card>
    <div className="mb-3 space-y-1">{all.map((i) => <div key={i.id} className="flex justify-between rounded-lg bg-[#101a30] px-3 py-2 text-sm"><span>{articleLabel(i)}</span><Chip color={s.mem[i.id] ? 'green' : 'slate'}>{s.mem[i.id] ? 'memorizada' : 'no iniciada'}</Chip></div>)}</div>
    <Btn className="w-full" disabled={!pending.length} onClick={() => setQueue(pending)}>{pending.length ? 'Comenzar' : 'Todo memorizado ✔'}</Btn>
    <Btn kind="ghost" className="mt-2 w-full" onClick={() => { update((x) => ({ ...x, skipped: { ...x.skipped, [themeId]: true } })); back() }}>Dar tema por terminado (pasar al siguiente)</Btn></div>
  return <RecallSession items={queue!} mode="memorize" title={`T${themeId} · primera memorización`} onGrade={(i, g, ms) => update((x) => memorize(x, i.id, themeId, d, g, ms))} onDone={back} />
}

function Libre({ back }: { back: () => void }) {
  const s = useStore((x) => x); const [it, setIt] = useState<Item | null>(null); const d = useDate()
  const items = allThemeItems(s).filter((i) => s.mem[i.id]); const due = new Set(dueItems(s, d).map((x) => x.item.id))
  if (it) return <RecallSession items={[it]} mode="review" title="Recuerdo libre" onGrade={(i, g, ms) => update((x) => reviewItem(x, i.id, d, g, 'libre', ms))} onDone={() => setIt(null)} />
  return <div><BackBar title="Recuerdo libre" onBack={back} /><div className="mb-2 text-sm text-slate-400">«Dime todo lo que recuerdes del artículo X». Elige uno memorizado:</div>
    {items.length ? <div className="space-y-2">{items.map((i) => <Card key={i.id} onClick={() => setIt(i)} className="flex justify-between !py-3"><span>{articleLabel(i)} <span className="text-slate-400">· {conceptOf(i, s.notes[i.id]).text.slice(0, 40)}</span></span>{due.has(i.id) && <Chip color="amber">vence</Chip>}</Card>)}</div> : <Empty>Aún no has memorizado artículos.</Empty>}</div>
}

/** Modo inverso: «Dime competencias de X» → intentar recordar → revelar frases OFICIALES donde aparece el órgano. */
function CompInv({ back }: { back: () => void }) {
  const s = useStore((x) => x)
  const [onlyMem, setOnlyMem] = useState(false)
  const items = useMemo(() => { const all = allThemeItems(s); return onlyMem ? all.filter((i) => s.mem[i.id]) : all }, [onlyMem, s.settings.demo]) // eslint-disable-line
  const map = useMemo(() => {
    const m = new Map<string, { s: string; i: Item }[]>()
    for (const i of items) for (const sn of sentencesOf(i.article.paras)) for (const h of findHits(sn)) if (h.cat === 'organo') { const k = h.text; m.set(k, [...(m.get(k) ?? []), { s: sn, i }]) }
    return [...m.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)
  }, [items])
  const [org, setOrg] = useState<string | null>(null); const [rev, setRev] = useState(false)
  if (org) { const xs = map.find(([k]) => k === org)?.[1] ?? []; return <div><BackBar title={org} onBack={() => { setOrg(null); setRev(false) }} />
    <Card className="mb-3"><div className="mb-2 text-xl">Dime competencias / funciones de: <b>{org}</b></div><textarea rows={4} placeholder="Escribe lo que recuerdes (opcional)" />{!rev && <Btn className="mt-2 w-full" onClick={() => setRev(true)}>Revelar ({xs.length} menciones)</Btn>}</Card>
    {rev && <div className="space-y-2">{xs.map((x, k) => <Card key={k} className="!py-3 text-sm"><Chip color="green">{articleLabel(x.i)}</Chip><div className="mt-1">{x.s}</div></Card>)}</div>}</div> }
  return <div><BackBar title="Competencias de… (inverso)" onBack={back} /><div className="mb-2 text-sm text-slate-400">Elige un órgano. Las respuestas son frases literales del texto oficial (no mnemotecnia).</div><label className="mb-2 flex min-h-11 items-center gap-2 text-sm"><input className="!w-5" type="checkbox" checked={onlyMem} onChange={(e) => setOnlyMem(e.target.checked)} /> Solo artículos ya memorizados</label>
    {map.length ? <div className="grid grid-cols-2 gap-2">{map.map(([k, v]) => <Card key={k} onClick={() => setOrg(k)} className="!p-3"><div className="font-semibold">{k}</div><div className="text-xs text-slate-400">{v.length} menciones</div></Card>)}</div> : <Empty>Sin órganos con ≥2 menciones en esta selección.</Empty>}</div>
}
