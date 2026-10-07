export type Grade = 0 | 1 | 2 | 3 // NO LO RECORDABA | PARCIAL | BIEN | PERFECTO
export const GRADE_LABEL = ['No lo recordaba', 'Parcial', 'Bien', 'Perfecto'] as const

export interface Article {
  id: string
  lawId: string
  num: string // "104", "24 bis", "Anexo II"
  title?: string
  paras: string[]
  concept?: string
  changed?: { at: string; prevHash: string }
}
export interface LawFile {
  id: string; name: string; short: string; boeId: string | null
  sourceUrl: string; checkedAt: string; version: string; verified: boolean; demo?: boolean; warning?: string
  articles: Article[]
}
export interface SourceDef { law: string; ranges?: string[]; whole?: boolean; conf: 'alta' | 'por-confirmar' | 'pendiente' }
export interface ThemeDef { id: number; block: 1 | 2 | 3; title: string; scope: string; sources: SourceDef[]; pending?: string }
export interface Item { id: string; themeId: number; article: Article; law: LawFile; conf: SourceDef['conf'] }

export type Phase = 'NO_INICIADO' | 'PRIMERA' | 'CONSOLIDACION' | 'MANTENIMIENTO' | 'DOMINADO'
export const PHASE_LABEL: Record<Phase, string> = {
  NO_INICIADO: 'No iniciado', PRIMERA: 'Primera memorización', CONSOLIDACION: 'Consolidación',
  MANTENIMIENTO: 'Mantenimiento', DOMINADO: 'Dominado'
}

export type Cat = 'numero' | 'mayoria' | 'modal' | 'organo' | 'plazo' | 'excepcion' | 'articulo'
export const CAT_LABEL: Record<Cat, string> = {
  numero: 'Números', mayoria: 'Mayorías', modal: 'Podrá/deberá', organo: 'Órganos/competencias', plazo: 'Plazos', excepcion: 'Excepciones', articulo: 'Artículo ↔ contenido'
}
export interface Question {
  id: string; itemId: string; themeId: number; kind: 'mcq' | 'tf' | 'cloze'
  cat: Cat; prompt: string; options?: string[]; answer: string // answer: texto correcto (mcq/cloze) | 'V'|'F' (tf)
  explanation: string; source: string; generated: true
}
