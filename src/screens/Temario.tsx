import { useState } from 'react'
import { Card, Chip, H, BackBar, Bar, useNav, useDate, pct, Btn } from '../ui'
import { ArticleView } from '../components'
import { THEMES, BLOCK_NAME, articleLabel } from '../lib/content'
import { useStore } from '../lib/store'
import { itemsOf, themePhase, themeProgress, themeHealth } from '../lib/plan'
import { PHASE_LABEL } from '../lib/types'
import type { Item } from '../lib/types'
import { MaterialList } from './Material'

const PC: Record<string, string> = { NO_INICIADO: 'slate', PRIMERA: 'blue', CONSOLIDACION: 'amber', MANTENIMIENTO: 'cyan', DOMINADO: 'green' }

export default function Temario({ sub, p }: { sub?: string; p?: any }) {
  const s = useStore((x) => x); const d = useDate(); const go = useNav()
  const [art, setArt] = useState<Item | null>(null)
  if (sub === 'tema' && p?.themeId) {
    const t = THEMES[p.themeId - 1]; const items = itemsOf(s, t.id); const pr = themeProgress(s, t.id, d, items)
    if (art) return <div><BackBar title={articleLabel(art)} onBack={() => setArt(null)} /><Card><ArticleView item={art} /></Card></div>
    const ev = s.events.filter((e) => e.themeId === t.id).slice(-40).reverse()
    const cl = s.classes[t.id]
    return (
      <div><BackBar title={`T${t.id} · ${t.title}`} onBack={() => go({ tab: 'temario' })} />
        <Card className="mb-3"><div className="mb-2 text-sm text-slate-300">{t.scope}</div>
          <div className="flex flex-wrap gap-2"><Chip color={PC[themePhase(s, t.id, d)]}>{PHASE_LABEL[themePhase(s, t.id, d)]}</Chip><Chip>Memorizados {pr.memorized}/{pr.total}</Chip><Chip>Cobertura {pct(pr.coverage)}</Chip><Chip>Retención {pct(pr.avgR)}</Chip>{t.sources.map((x, i) => <Chip key={i} color={x.conf === 'alta' ? 'green' : x.conf === 'pendiente' ? 'red' : 'amber'}>alcance: {x.conf}</Chip>)}</div>
          {t.pending && <div className="mt-2 text-sm text-amber-300">PENDIENTE DE FUENTE: {t.pending}</div>}
          <div className="mt-3 flex gap-2"><Btn disabled={!items.length} onClick={() => go({ tab: 'estudio', sub: 'memorizar', p: { themeId: t.id } })}>Memorizar</Btn><Btn kind="ghost" onClick={() => go({ tab: 'estudio', sub: 'tema-repaso', p: { themeId: t.id } })} disabled={!pr.memorized}>Repaso integral</Btn></div></Card>
        <H>Artículos / apartados</H>
        {items.length === 0 ? <Card className="text-slate-300">Sin artículos incorporados. Importa el texto oficial (<code>npm run import:boe</code>) y/o define el rango en Más → Ajustes → Alcance.</Card> :
          <div className="mb-4 space-y-2">{items.map((i) => { const m = s.mem[i.id]; const st = s.notes[i.id]?.status; return (
            <Card key={i.id} onClick={() => setArt(i)} className="flex items-center justify-between !py-3"><div><div className="font-semibold">{articleLabel(i)}</div><div className="text-xs text-slate-400">{m ? `vence ${m.due} · ${m.reps} rep.` : ''}</div></div>
              <Chip color={st === 'DIFICIL' ? 'red' : m ? 'green' : st === 'EN_PROCESO' ? 'amber' : 'slate'}>{st === 'DIFICIL' ? 'DIFÍCIL' : m ? 'MEMORIZADA' : st === 'EN_PROCESO' ? 'EN PROCESO' : 'NO INICIADA'}</Chip></Card>) })}</div>}
        <H>Material personal</H><div className="mb-4"><MaterialList compact items={s.material.filter((m) => m.themeId === t.id)} /></div>
        <H>Historial</H>
        <Card className="mb-3 text-sm"><div>Primera memorización: {pr.first ?? '—'} · Último repaso: {pr.last ?? '—'} · Próximo: {pr.next ?? '—'}</div><div>Clase: {cl?.seen ? `vista ${cl.date ?? ''}` : 'pendiente'} · Repasos: {pr.reps} · Fallos: {pr.lapses}</div>
          <div className="mt-2 max-h-56 overflow-y-auto">{ev.length ? ev.map((e, i) => <div key={i} className="border-t border-[#1f2c47] py-1 text-slate-300">{e.d} · {e.k}{e.g !== undefined ? ` · nota ${e.g}` : ''}{e.ok !== undefined ? (e.ok ? ' ✔' : ' ✘') : ''}</div>) : <span className="text-slate-500">Sin eventos todavía.</span>}</div></Card>
      </div>
    )
  }
  return (
    <div><H sub="Toca un tema para ver artículos, historial y estudiar">Temario · 30 temas</H>
      {([1, 2, 3] as const).slice().reverse().map((b) => (
        <div key={b} className="mb-4"><div className="mb-2 text-sm font-semibold text-slate-400">{BLOCK_NAME[b]}</div>
          <div className="space-y-2">{THEMES.filter((t) => t.block === b).map((t) => { const pr = themeProgress(s, t.id, d); const ph = themePhase(s, t.id, d); const h = themeHealth(s, t.id, d); return (
            <Card key={t.id} onClick={() => go({ tab: 'temario', sub: 'tema', p: { themeId: t.id } })} className="!py-3">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-semibold">T{t.id} · {t.title}</div><div className="text-xs text-slate-400">{pr.total ? `${pr.total} art.` : 'sin artículos incorporados'}{t.pending ? ' · PENDIENTE DE FUENTE' : ''}</div></div><Chip color={PC[ph]}>{h.label ?? PHASE_LABEL[ph]}</Chip></div>
              <div className="mt-2"><Bar v={pr.total ? pr.memorized / pr.total : 0} /></div></Card>) })}</div></div>))}
    </div>
  )
}
