# F7 — Contraste editable, accesibilidad y cierre documental

Objetivo: hacer reconocibles los campos editables (R6), revisar foco/teclado/lector/responsive, cerrar la documentación y pasar el detector Impeccable con una auditoría final de regresiones.
Branch: `feat/editable-contrast-a11y`. Delivery: `ask-on-risk`. Runner: `npm test` (vitest), `npm run e2e` (Playwright).

## Specs

S1 — Campos editables reconocibles (SDD R6).
- Fondo `#f4f8fc`, borde `#8da4c2` en reposo, borde y anillo de foco `#3e6fa8`, hover `#edf4fb` sin cambiar el layout.
- Placeholder claro y texto AA; el borde se distingue del fondo.
- Aplica a inputs, selects y textareas de los editores, desempeños incluidos.
- Los campos de solo lectura/deshabilitados conservan el fondo del boletín y no muestran borde editable.

S2 — Accesibilidad.
- Todo campo conserva `label` o `aria-label` asociado; el nombre del estudiante en el editor de período deja de depender solo del placeholder.
- Foco visible por teclado; orden de tabulación igual al orden visual.
- Los modales de limpieza y cambios sin guardar mantienen foco, Escape y retorno del foco (ya cubierto; se revalida).

S3 — Responsive.
- El editor de período y el editor final no generan overflow horizontal de página a 360px.

S4 — Documentación.
- `DESIGN.md` documenta el tratamiento de campos editables y sus tokens.
- Manual `docs/` y copia `public/` byte-idénticos; `spec.md`, `PRODUCT.md` y SDD actualizados con F6 fusionada y F7.

S5 — Cierre de calidad.
- Detector Impeccable sobre landing, menú, editor y boletín sin anti-patrones ni avisos nuevos.
- Auditoría final read-only de regresiones; suite unit/e2e/build/lint verde.

## Tasks

- T1 — Clase compartida de input/textarea y estilos R6. Specs: S1. Route: inline. Status: done.
- T2 — Aplicar R6 a editores y estados disabled/read-only. Specs: S1. Route: inline. Status: done.
- T3 — Accesibilidad y responsive. Specs: S2, S3. Route: inline. Status: done: `Nombre del estudiante N`, `min-w-0` en los fieldsets, sin overflow a 360 px.
- T4 — Tests e2e de estilos, foco, hover, disabled y overflow. Specs: S1–S3. Route: inline. Status: done (`e2e/editor-contrast.spec.js`).
- T5 — Documentación y estado del SDD. Specs: S4. Route: inline. Status: done.
- T6 — Detector Impeccable, auditoría final, PR, CI y merge. Specs: S5. Route: inline. Status: pending.

## Log

L1 (2026-10-30, verbatim): «Continua con todo.»
Contexto: F6 fusionada (PR #50). Última fase del SDD: contraste editable (R6), accesibilidad, documentación y cierre con detector Impeccable y auditoría final.
L2 (2026-10-30): RED en `e2e/editor-contrast.spec.js` (5/5) por colores, falta de `aria-label` del estudiante y overflow de 405 px a 360 px; tests congelados en `e7ea61e`.
L3 (2026-10-30): implementación: `TextInput`/`TextArea` compartidos con R6, estados disabled/read-only, placeholders AA, `min-w-0` en fieldsets, `aria-label` de estudiante y ajustes de contraste en boletines/dashboard. Suite: 166 unit, 142 e2e, build OK, lint 108 warnings (baseline).
L4 (2026-10-30): detector Impeccable: `src` limpio; landing 0 anti-patrones (2 avisos intencionales de sombra); menú idéntico al baseline F6 (3 nested-cards + 2 avisos preexistentes); boletín/final 0 hallazgos; editores 0 anti-patrones (avisos de jerarquía preexistentes).
