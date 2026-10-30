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

- T1 — Ruta `#/editor-final`, vista final de solo lectura y botón de edición. Specs: S1, S2. Route: inline. Status: done (commit 6b0be8d).
- T2 — `FinalEditor` con borrador, guardar/cancelar, confirmación y persistencia. Specs: S2. Route: inline. Status: done (commit 6b0be8d).
- T3 — Matriz final dentro del editor con componente compartido (`scope: final`). Specs: S3. Route: inline. Status: done (commit 6b0be8d).
- T4 — Retiro del staging global del menú; plantilla/ejemplo permanecen. Specs: S5. Route: inline. Status: done (commit 6b0be8d).
- T5 — E2E de backup y actualización de specs existentes. Specs: S4. Route: inline. Status: done (commits e427ab8, 6b0be8d).
- T6 — Documentación y estado del SDD. Specs: S6. Route: inline. Status: done (este commit).
- T7 — Verificación: unit, e2e completo, lint, build. Specs: S1–S6. Route: inline. Status: done: 166 unit, 125 e2e, lint sin errores nuevos, build OK.

## Log

L1 (2026-10-30, verbatim): «Hola compa, sigue por donde lo dejamos.»
Contexto: la sesión anterior cerró F4.1 (PR #48) y dejó como próximo paso F5: `#/editor-final`, edición de anotaciones finales fuera del boletín y matriz final dentro del editor (issue #41, `docs/workflow-refactor-sdd.md`).

L2 (2026-10-30): exploración del flujo vigente. Se confirmó que `FinalReportSheet` editaba con textareas, que la matriz final se encolaba en `informes.pendingMatrix` desde el menú y que el backup ya transportaba `finalPerformances`; F5 requiere retirar ambas vías y abrir `#/editor-final`.
L3 (2026-10-30): RED observado en `hashRoute.test.js` (ruta inexistente) y en las 6 pruebas nuevas de `e2e/final-editor.spec.js`; tests congelados en `e427ab8`.
L4 (2026-10-30): implementación en `6b0be8d`: ruta y guard de editor final, `FinalEditor` con borrador/confirmación, `PerformanceMatrixImport` compartido con `scope: period|final`, boletín final 100% de solo lectura, menú sin staging global y matriz final solo en el editor. Verificación: `npm test` 166/166; `npm run e2e` 125/125; `npm run build` OK; `npm run lint` sin errores nuevos.
L5 (2026-10-30): documentación actualizada (manual y copia pública idénticas, `docs/final-report.md`, `spec.md`, `PRODUCT.md`, estado del SDD). `docsConsistency` 16/16.
L6 (2026-10-30): corregido el remonte del editor final al promoverse una pestaña de solo lectura (`4c8dc0a`): `key` por época y prueba e2e de promoción con anotación nueva del escritor. Suite final: 166 unit, 125 e2e, build OK.
