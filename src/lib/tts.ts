/** Abstracción de proveedor TTS. Hoy: voz del dispositivo (Web Speech). Un proveedor remoto (2 voces) se añadiría
 *  detrás de un endpoint de servidor — nunca con API keys en el frontend. */
export interface TTSProvider { name: string; available(): boolean; speak(text: string, opts?: { rate?: number; voice?: string }): Promise<void>; stop(): void }
export const browserTTS: TTSProvider = {
  name: 'Voz del dispositivo',
  available: () => typeof speechSynthesis !== 'undefined',
  speak: (text, o) => new Promise((res) => {
    const chunks = text.match(/[^.;:]+[.;:]?/g) ?? [text]
    let i = 0
    const next = () => { if (i >= chunks.length) return res(); const u = new SpeechSynthesisUtterance(chunks[i++].trim()); u.lang = 'es-ES'; u.rate = o?.rate ?? 1; u.onend = next; u.onerror = () => res(); speechSynthesis.speak(u) }
    speechSynthesis.cancel(); next()
  }),
  stop: () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }
}

/** Formato didáctico a dos voces con la síntesis del dispositivo: voz A pregunta/anuncia, voz B responde. */
export function speakDialog(lines: { who: 'A' | 'B'; text: string }[], rate = 1): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve()
  const es = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('es'))
  const va = es[0], vb = es[1] ?? es[0]
  speechSynthesis.cancel()
  return new Promise((res) => {
    let i = 0
    const next = () => {
      if (i >= lines.length) return res()
      const l = lines[i++]; const u = new SpeechSynthesisUtterance(l.text); u.lang = 'es-ES'; u.rate = rate
      const v = l.who === 'A' ? va : vb; if (v) u.voice = v
      if (l.who === 'B' && va === vb) u.pitch = 0.8 // misma voz disponible: se diferencia por tono
      u.onend = next; u.onerror = () => res(); speechSynthesis.speak(u)
    }
    next()
  })
}
