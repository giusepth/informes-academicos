# F6 — Precarga visible de desempeños del próximo período

Objetivo: cargar una matriz de desempeños desde la landing o el menú, antes de que exista el primer período, y aplicarla una sola vez a ese primer período: solo celdas vacías y cuando existan notas.
Branch: `feat/landing-next-matrix`. Delivery: `ask-on-risk`. Runner: `npm test` (vitest), `npm run e2e` (Playwright).

## Specs

S1 — Sección «Desempeños antes de empezar» en la landing.
- Acciones: «Cargar desempeños del próximo período (.xlsx)», «Descargar plantilla de desempeños», «Descargar ejemplo de desempeños» (SDD R5).
- Texto breve: la matriz se aplicará una sola vez al primer período que se cree o importe, solo a celdas vacías y cuando existan notas.
- Estado tras la carga: cantidad de asignaturas detectadas, «Se aplicará al primer período que crees», «Reemplazar archivo» y «Quitar matriz».
- Una matriz vacía se rechaza con el mensaje existente y no queda cargada.

S2 — Acciones compartidas con el menú de gestión.
- El menú usa el mismo componente de carga/estado/descargas (D6, R5); no se duplica lógica.
- El menú muestra la matriz pendiente mientras no existan períodos.

S3 — Consumo único y aplicación.
- La matriz se consume al crear o importar el primer período y nunca se aplica a uno posterior (R5, Fase 6).
- Al crear el primer período desde el editor, se aplica al borrador guardado: solo celdas vacías, conserva el texto propio.
- Al importar el primer período o restaurar un backup sin períodos, se aplica al primer informe resultante.
- Sin notas no completa nada; la matriz se consume igual y no queda una cola reutilizable.

S4 — Persistencia acotada.
- La matriz pendiente vive en `sessionStorage` como estado de vista (`informes.nextPeriodMatrix`); no se guarda en IndexedDB ni en el backup.
- «Limpiar informes» y el clear remoto entre pestañas descartan la matriz pendiente.
- La clave legada `informes.pendingMatrix` no se lee ni se aplica.

S5 — Documentación.
- Manual `docs/` y copia `public/` byte-idénticos con el flujo de landing/menú.
- `spec.md`, `PRODUCT.md`, `docs/final-report.md` y estado del SDD actualizados.

## Tasks

- T1 — Landing: sección y acciones; componente compartido de matriz del próximo período. Specs: S1, S2. Route: inline. Status: done (commit 228d117).
- T2 — App: estado `nextPeriodMatrix`, aplicación al primer período creado/importado/restaurado y consumo único. Specs: S3. Route: inline. Status: done (commit 228d117).
- T3 — Limpieza local/remota y clave legada. Specs: S4. Route: inline. Status: done (commit 228d117).
- T4 — Tests e2e y actualización de specs existentes. Specs: S1–S4. Route: inline. Status: done (commits b49176a, 228d117).
- T5 — Documentación y estado del SDD. Specs: S5. Route: inline. Status: done (este commit).
- T6 — Verificación completa, PR, auditoría y CI. Specs: S1–S5. Route: inline. Status: done: 166 unit, 137 e2e, build OK, lint sin warnings nuevos; auditoría read-only sin bloqueadores; PR #50 abierto.

## Log

L1 (2026-10-30, verbatim): «Continua con todo.»
Contexto: tras fusionar F5 (PR #49), el siguiente paso del SDD es F6 (R5/Fase 6): precarga visible de desempeños del próximo período desde la landing y el menú, con consumo único al primer período.
L2 (2026-10-30): RED observado en las 3 pruebas nuevas de `e2e/landing-matrix.spec.js` (sección/acciones inexistentes) y en las pruebas de menú/limpieza actualizadas; tests congelados en `b49176a`.
L3 (2026-10-30): implementación `228d117`: sección «Desempeños antes de empezar» en landing, componente compartido `NextPeriodMatrixActions` (modo `nextPeriod`/`downloads`), estado `informes.nextPeriodMatrix` en sessionStorage, aplicación única al primer período creado/importado/restaurado y limpieza local/remota. Verificación: 166 unit, 130 e2e, build OK, lint sin errores nuevos.
L4 (2026-10-30): documentación actualizada (manual/copia pública, `final-report.md`, `spec.md`, `PRODUCT.md`, SDD).
L5 (2026-10-30): auditoría read-only independiente sin bloqueadores. Advisories corregidos: el rechazo de plantilla vacía ya no muestra un toast contradictorio de «quitada», el estado pendiente se persiste en los handlers (sin warning nuevo de efecto), comentarios de `parser.js` alineados con el consumo único y pruebas de regresión añadidas (`e2e/next-period-matrix-regressions.spec.js`: reemplazo inválido, primer período sin notas, backup, menú read-only, limpieza en modo sesión, recarga del landing y escala centesimal). Suite final: 166 unit, 137 e2e, build OK, lint 108 warnings (igual que el baseline).
