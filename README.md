# Estudio PL · Policía Local Illes Balears

PWA local-first (React + TypeScript + Tailwind + Vite). Todo el progreso vive en el dispositivo (localStorage) con exportar/importar JSON.

## Arrancar
```
npm install
npm run dev        # desarrollo
npm test           # 42 tests (SRS, plan, sábado, errores, persistencia, parser BOE)
npm run build      # tsc + build PWA → dist/
```

## Texto legal
`content/laws/*.json` = texto consolidado oficial importado del BOE (API de datos abiertos) con URL, fecha de consulta y versión.
`npm run content` lo recorta a los artículos que exige cada tema (`content/syllabus.json`) → `src/generated/laws` (lo que carga la PWA).
Para actualizar: `npm run import:boe` (y `npm run import:boe -- ley4-2013=BOE-A-...` para asignar identificadores).
Si el texto cambia, el artículo queda marcado ⚠️ POSIBLE CAMBIO LEGISLATIVO y se anota en `content/changes-log.json`.
BOIB: `npm run import:boib` importa el Decreto 40/2019 (T20) desde su HTML oficial ELI. El BOIB solo publica el texto
ORIGINAL (no consolidado): la app lo avisa en cada artículo porque el decreto se ha modificado después.
T17 usa la Orden INT/2223/2014 (BOE) y el Título VI de la Ley de Tráfico; la parte doctrinal (tipos, causas, actuación
policial) no es norma y va como material personal.
Los rangos de artículos salen de la estructura real de cada norma; los marcados `por-confirmar` en el syllabus son interpretación del programa.

## Material personal
Más → Material: importa PDF/TXT/MD (solo se extrae texto, con pdf.js bajo demanda) o pega apuntes. Se guarda aparte del
texto oficial, aparece en el tema y en el buscador, y viaja en la copia de seguridad.

## Motor
- Repetición espaciada (`src/lib/srs.ts`): escalera D+1/3/7/14/30, luego crecimiento por estabilidad/dificultad; fallo → 1 día; retención estimada con curva FSRS. (FSRS-lite propio, no la librería oficial.)
- Planificador (`plan.ts`): tema nuevo L–V, sábado = repaso integral, domingo descanso, carga limitada por minutos (lo que no cabe se prioriza, no se borra).
- Preguntas/cloze/detecta-error/flashcards se **generan del texto oficial** (marcadas PREGUNTA GENERADA). Post-its y esquemas automáticos son borradores marcados GENERADO; los tuyos prevalecen.
