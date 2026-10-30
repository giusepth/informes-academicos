# F5 — Editor del informe final

Objetivo: editar los desempeños finales fuera del boletín, cargar la matriz final dentro de `#/editor-final`, dejar la vista final de solo lectura y conservar el round-trip del backup.
Branch: `feat/final-editor`. Delivery: `ask-on-risk`. Runner: `npm test` (vitest), `npm run e2e` (Playwright).

## Specs

S1 — Ruta y vista final de solo lectura.
- `#/editor-final` es una ruta hash válida solo cuando existen informes (SDD D2, R2).
- Desde `#/final` no hay campos editables (Escenario E.1).
- La vista final ofrece «Editar desempeños finales» y abre `#/editor-final` (Escenario E.2).

S2 — Edición de anotaciones finales en el editor.
- «Edita en `#/editor-final` y guarda»; «El informe final refleja el texto» (Escenario E.3–E.4).
- No se editan promedios ni resultados calculados (Fase 5, aceptación).
- Cancelar con cambios pide confirmación («Volver sin guardar» / «Seguir editando») y descarta el borrador.
- Guardar persiste en la capa `finalPerformances` (clave por nombre normalizado) y sale a `#/final`.

S3 — Matriz del informe final dentro del editor.
- «Carga de la matriz del informe final dentro de `#/editor-final`, con el mismo componente de importación que F4.1 y alcance `final`» (Fase 5).
- «Aplicar al informe final» completa solo casilleros vacíos; el texto propio se conserva.
- «La matriz final no modifica desempeños de período» (Fase 5, aceptación).
- La matriz no se persiste en IndexedDB ni en el backup; al salir se descarta.

S4 — Backup.
- «Exporta backup, borra y reimporta: el texto se conserva» (Escenario E.5).
- El backup sigue incluyendo la hoja `Final (desempeños)`.

S5 — Menú de gestión.
- El menú deja de prometer una aplicación global al informe final: la carga vive en `#/editor-final`.
- Conserva «Descargar plantilla de desempeños» y «Descargar ejemplo de desempeños» (R4.4).
- No queda payload global `pendingMatrix` ni auto-aplicación.

S6 — Documentación.
- Manual en `docs/` y `public/` byte-idéntico, con el flujo nuevo y «Aplicar al informe final» dentro del editor.
- `docs/final-report.md`, `spec.md`, `PRODUCT.md` y estado del SDD actualizados (F4.1 fusionada, F5 implementada).

## Tasks

- T1 — Ruta `#/editor-final`, vista final de solo lectura y botón de edición. Specs: S1, S2. Route: inline. Status: pending.
- T2 — `FinalEditor` con borrador, guardar/cancelar, confirmación y persistencia. Specs: S2. Route: inline. Status: pending.
- T3 — Matriz final dentro del editor con componente compartido (`scope: final`). Specs: S3. Route: inline. Status: pending.
- T4 — Retiro del staging global del menú; plantilla/ejemplo permanecen. Specs: S5. Route: inline. Status: pending.
- T5 — E2E de backup y actualización de specs existentes. Specs: S4. Route: inline. Status: pending.
- T6 — Documentación y estado del SDD. Specs: S6. Route: inline. Status: pending.
- T7 — Verificación: unit, e2e completo, lint, build. Specs: S1–S6. Route: inline. Status: pending.

## Log

L1 (2026-10-30, verbatim): «Hola compa, sigue por donde lo dejamos.»
Contexto: la sesión anterior cerró F4.1 (PR #48) y dejó como próximo paso F5: `#/editor-final`, edición de anotaciones finales fuera del boletín y matriz final dentro del editor (issue #41, `docs/workflow-refactor-sdd.md`).
