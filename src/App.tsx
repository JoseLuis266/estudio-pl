import { useState } from 'react'
import { NavCtx, Route } from './ui'
import Hoy from './screens/Hoy'
import Temario from './screens/Temario'
import Estudio from './screens/Estudio'
import Test from './screens/Test'
import Errores from './screens/Errores'
import Progreso from './screens/Progreso'
import Mas from './screens/Mas'

const TABS: [string, string, string][] = [['hoy', '🏠', 'Hoy'], ['temario', '📖', 'Temario'], ['estudio', '🧠', 'Estudio'], ['test', '📝', 'Test'], ['errores', '❌', 'Errores'], ['progreso', '📈', 'Progreso'], ['mas', '⋯', 'Más']]
export default function App() {
  const [r, setR] = useState<Route>({ tab: 'hoy' })
  const go = (x: Route) => { setR(x); window.scrollTo(0, 0) }
  return (
    <NavCtx.Provider value={go}>
      <div className="mx-auto min-h-full max-w-xl px-4 safe-t pb-28 pt-4">
        {r.tab === 'hoy' && <Hoy />}
        {r.tab === 'temario' && <Temario sub={r.sub} p={r.p} />}
        {r.tab === 'estudio' && <Estudio key={r.sub} sub={r.sub} p={r.p} />}
        {r.tab === 'test' && <Test sub={r.sub} />}
        {r.tab === 'errores' && <Errores />}
        {r.tab === 'progreso' && <Progreso />}
        {r.tab === 'mas' && <Mas sub={r.sub} p={r.p} />}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#1f2c47] bg-[#0b1220]/95 backdrop-blur safe-b">
        <div className="mx-auto flex max-w-xl">{TABS.map(([k, e, l]) => <button key={k} onClick={() => go({ tab: k })} className={`flex min-h-14 flex-1 flex-col items-center justify-center text-[11px] ${r.tab === k ? 'text-blue-400' : 'text-slate-400'}`}><span className="text-lg leading-none">{e}</span>{l}</button>)}</div>
      </nav>
    </NavCtx.Provider>
  )
}
