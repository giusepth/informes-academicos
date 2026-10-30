# Remodelación UX/UI — ejecución por olas

Objetivo: implementar `docs/remodelacion-ux-ui.md` (ola 1 primero: carga manual y densidad).
Branch: `feat/remodelacion-ux-ui` · Runner: `npx vitest run` (unit) / `npm run e2e` cuando aplique.
Delivery: `ask-on-risk` (default) — se decide cadena en cierre de ola 1 según líneas acumuladas.

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
| T6 | S4 | Matriz: explicación, pasos, vista previa con matrixApplicationStats | inline | pendiente (ola 2) | — |
| T7 | S4, S6 | Progreso "N de M desempeños listos" | inline | pendiente (ola 2) | — |
| T8 | S7 | Identidad triplicado → tool (dashboard/gestión/modales) | inline | pendiente (ola 3) | — |
| T9 | S6 | Auditoría global de interacción (ningún botón sin reacción) | inline | pendiente (ola 3) | — |

## Log

- L1 (verbatim): "bueno levanta el pipeline y ejecuta el nuevo plan" — tras validar este criterio del dueño: "Algo mas definido mejor trabajado… tenemos un buen producto hasta la fecha… no tiene vida… la carga manual también es importante pulirla… no veo la opcion de bajar el xlxs… la matriz de desempeño sea mas facil de entender… si una persona entra desde 0 se sentiria agobiada… falta interactividad con los botones, desplazamientos sutiles, interaccion, feedback."
- Dirección aprobada: docs/remodelacion-ux-ui.md (escrito previamente por el orquestador con decisiones cerradas: sin modales de grilla; xlsx export existente a superficie; matriz explicada con preview; triplicado a todo el producto).
- RDD: off (global) — checks ordinarios, sin ceremonia de review.
- L2 (cierre ola 1): unit 180/180, e2e completa 145/145. Authored lines de la rama: 740+ / 37−. Cambio de diseño bloqueante documentado: colapsar desempeños por defecto rompería ~8 specs e2e (getByLabel 'Desempeño de…') → vista compacta OPT-IN, default = grilla completa (T3). Pendiente decidir estrategia de entrega (ask-on-risk): rama ya supera 400 líneas → cadena de PRs vs PR único.
