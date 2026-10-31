# Remodelación UX/UI — ejecución por olas

Objetivo: implementar `docs/remodelacion-ux-ui.md` (ola 1 primero: carga manual y densidad).
Branch: `feat/remodelacion-ux-ui` · Runner: `npx vitest run` (unit) / `npm run e2e` cuando aplique.
Delivery: `ask-on-risk` (default) — **decidido por el dueño: cadena de PRs**. Boundaries: PR1 = T0+T1 (export) · PR2 = T2+T3 (editor densidad) · PR3 = T4+T5 (carga manual asistida) · PR4 = T6+T7 (matriz) · PR5 = T8+T9 (identidad + interacción).

## Specs (citas verbatim del usuario; detalle en docs/remodelacion-ux-ui.md)

- S1: "al tener tanto estudiantes la interfaz se pone como muy cargada visualmente"
- S2: "que se desplieguen modales para diligenciar la informacion de los estudiantes y las materias… realmente no se si sea una buena idea" → decisión tomada: modo enfoque, no modales de grilla (spec §1)
- S3: "aun no veo la opcion de bajar el xlxs que surja despues de una carga manual"
- S4: "que la matriz de desempeño sea mas facil de entender y de aplicar"
- S5: "si una persona entra desde 0 se sentiria agobiada"
- S6: "falta interactividad con los botones, desplazamientos sutiles, interaccion, feedback"
- S7: "siento que no tiene vida"

## Tasks

| ID | Spec | Alcance | Ruta | Estado | Commit |
|---|---|---|---|---|---|
| T0 | — | Commit spec docs/remodelacion-ux-ui.md | inline | ✅ | f49a5fe |
| T1 | S3, S6 | Botón "Descargar respaldo (.xlsx)" en ExportToolbar (reusa buildBackupWorkbook) + test | inline | ✅ | 85ef213 |
| T2 | S1, S2 | Modo enfoque por estudiante en PeriodEditor (lente, no otro estado) | inline | ✅ | f633e02 |
| T3 | S1 | Densidad compacta + sticky + desempeños colapsables | inline | ✅ | 72e2dfa |
| T4 | S5 | Entrada manual asistida: sugerencias de asignaturas + pegar lista de estudiantes | inline | ✅ | 90da975 |
| T5 | S5, S6 | Empty states con guía + guardado inline (5 estados en controles nuevos) | inline | ✅ | 5944641 |
| T6 | S4 | Matriz: explicación, pasos, vista previa con matrixApplicationStats | inline | ✅ | fd3ea9b |
| T7 | S4, S6 | Progreso "N de M desempeños listos" | inline | ✅ | fd3ea9b |
| T8 | S7 | Identidad triplicado → tool (dashboard/gestión/modales) | inline | ✅ | dc5f227 |
| T9 | S6 | Auditoría global de interacción (ningún botón sin reacción) | inline | ✅ | dc5f227 |

## Log

- L1 (verbatim): "bueno levanta el pipeline y ejecuta el nuevo plan" — tras validar este criterio del dueño: "Algo mas definido mejor trabajado… tenemos un buen producto hasta la fecha… no tiene vida… la carga manual también es importante pulirla… no veo la opcion de bajar el xlxs… la matriz de desempeño sea mas facil de entender… si una persona entra desde 0 se sentiria agobiada… falta interactividad con los botones, desplazamientos sutiles, interaccion, feedback."
- Dirección aprobada: docs/remodelacion-ux-ui.md (escrito previamente por el orquestador con decisiones cerradas: sin modales de grilla; xlsx export existente a superficie; matriz explicada con preview; triplicado a todo el producto).
- RDD: off (global) — checks ordinarios, sin ceremonia de review.
- L2 (cierre ola 1): unit 180/180, e2e completa 145/145. Authored lines de la rama: 740+ / 37−. Cambio de diseño bloqueante documentado: colapsar desempeños por defecto rompería ~8 specs e2e (getByLabel 'Desempeño de…') → vista compacta OPT-IN, default = grilla completa (T3). Pendiente decidir estrategia de entrega (ask-on-risk): rama ya supera 400 líneas → cadena de PRs vs PR único.
- L3 (decisión del dueño, verbatim): "recomendado" → estrategia = CADENA DE PRs con boundaries arriba.
- L4 (cierre ola 2): T6+T7 en un solo work unit (mismo panel/encabezado). unit 182/182, e2e de matriz 27/27. Los count strings del panel (`N casillero a completar`, `0 sin nota`) se conservaron intactos porque los e2e los asertan literalmente; la explicación/pasos se agregaron alrededor.
- L5: cadena publicada como PRs autoría giusepth, CI 3/3 verde en los 4: PR #52 (T0+T1) → #53 (T2+T3) → #54 (T4+T5) → #55 (T6+T7). Merges: a cargo del dueño, en ese orden. La rama `feat/remodelacion-ux-ui` sigue viva para la ola 3 (PR5 = T8+T9, base = feat/remodel-pr4-matrix).
- L5: cadena publicada como PRs autoría giusepth, CI 3/3 verde en los 4: PR #52 (T0+T1) → #53 (T2+T3) → #54 (T4+T5) → #55 (T6+T7). Merges: a cargo del dueño, en ese orden. La rama `feat/remodelacion-ux-ui` sigue viva para la ola 3 (PR5 = T8+T9, base = feat/remodel-pr4-matrix).
- L6 (cierre ola 3): tokens del triplicado declarados en `@theme` de index.css (paper/sheet/copy-sky/kraft/kraft-line/kraft-rule/ink-slate/typed-ochre/form-blue/form-blue-lift + font-display/font-typed) y aplicados a shell (header/banner/toast), tarjetas de gestión/dashboard/periodbar/toolbar, paneles del editor y Modal; R6 y boletines intactos. Botones con contrato único: hover form-blue-lift, press 1px (motion-reduce aware), 150ms. Pins e2e actualizados al token nuevo (tab activo `bg-form-blue`; aserción negativa endurecida) + `e2e/interaction-states.spec.js` nuevo. Verificación: unit 182/182, e2e completa 146/146, build vite verde. Nota de alcance: fuentes Archivo/Plex se usan en header/Modal; el resto mantiene la tipografía de sistema (profundizar tipografía es un pase posterior, no bloquea la ola).
