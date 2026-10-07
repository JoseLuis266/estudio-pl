import { ReactNode, useEffect, useState, createContext, useContext } from 'react'
import { today } from './lib/dates'
import type { Grade } from './lib/types'
import { GRADE_LABEL } from './lib/types'

export type Route = { tab: string; sub?: string; p?: any }
export const NavCtx = createContext<(r: Route) => void>(() => {})
export const useNav = () => useContext(NavCtx)

/** Fecha de trabajo (permite ?d=AAAA-MM-DD para probar). */
export function useDate() {
  const [d, setD] = useState(() => new URLSearchParams(location.search).get('d') || today())
  useEffect(() => { const f = () => { if (!new URLSearchParams(location.search).get('d')) setD(today()) }; window.addEventListener('focus', f); return () => window.removeEventListener('focus', f) }, [])
  return d
}

export const Card = ({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => (
  <div onClick={onClick} className={`rounded-2xl border border-[#1f2c47] bg-[#101a30] p-4 ${onClick ? 'active:bg-[#16223d] cursor-pointer' : ''} ${className}`}>{children}</div>
)
export const H = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <div className="mb-3"><h2 className="text-xl font-bold">{children}</h2>{sub && <div className="text-sm text-slate-400">{sub}</div>}</div>
)
export const Btn = ({ children, onClick, kind = 'primary', disabled, className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'ok'; disabled?: boolean; className?: string }) => {
  const k = { primary: 'bg-blue-600 text-white', ghost: 'bg-[#1a2744] text-slate-200', danger: 'bg-red-700 text-white', ok: 'bg-emerald-600 text-white' }[kind]
  return <button disabled={disabled} onClick={onClick} className={`min-h-12 rounded-xl px-4 py-3 font-semibold active:opacity-80 disabled:opacity-40 ${k} ${className}`}>{children}</button>
}
export const Chip = ({ children, color = 'slate' }: { children: ReactNode; color?: string }) => {
  const c: Record<string, string> = { slate: 'bg-slate-700/60 text-slate-200', blue: 'bg-blue-600/30 text-blue-200', green: 'bg-emerald-600/30 text-emerald-200', red: 'bg-red-600/30 text-red-200', amber: 'bg-amber-500/30 text-amber-200', violet: 'bg-violet-600/30 text-violet-200', cyan: 'bg-cyan-600/30 text-cyan-200' }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c[color]}`}>{children}</span>
}
export const Bar = ({ v, color = 'bg-blue-500' }: { v: number; color?: string }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a2744]"><div className={`h-full ${color}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%` }} /></div>
)
export const pct = (v: number) => `${Math.round(v * 100)}%`

/** Distinción visual obligatoria de tipos de contenido. */
export const KIND = {
  oficial: ['TEXTO OFICIAL', 'green'], didactica: ['EXPLICACIÓN DIDÁCTICA', 'blue'], postit: ['POST-IT', 'amber'], esquema: ['ESQUEMA', 'cyan'],
  pregunta: ['PREGUNTA GENERADA', 'violet'], personal: ['MATERIAL PERSONAL', 'slate'], demo: ['DEMO · NO ES LEGISLACIÓN', 'red'], pendiente: ['PENDIENTE DE FUENTE', 'red']
} as const
export const Badge = ({ k }: { k: keyof typeof KIND }) => <Chip color={KIND[k][1]}>{KIND[k][0]}</Chip>

export const GRADE_COLOR = ['bg-red-700', 'bg-amber-600', 'bg-emerald-600', 'bg-blue-600']
export function GradeButtons({ onGrade }: { onGrade: (g: Grade) => void }) {
  return <div className="grid grid-cols-2 gap-2">{([0, 1, 2, 3] as Grade[]).map((g) => <button key={g} onClick={() => onGrade(g)} className={`min-h-14 rounded-xl px-2 font-semibold text-white active:opacity-80 ${GRADE_COLOR[g]}`}>{GRADE_LABEL[g]}</button>)}</div>
}
export const Empty = ({ children }: { children: ReactNode }) => <Card className="text-center text-slate-300">{children}</Card>
export const BackBar = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="mb-3 flex items-center gap-2"><button onClick={onBack} className="min-h-11 min-w-11 rounded-xl bg-[#1a2744] text-lg">←</button><div className="truncate text-lg font-bold">{title}</div></div>
)
