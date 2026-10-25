# Informe final (quinto informe) — Documentación de módulo

> Estado: implementado en `main` (commit `570ee11`). Verificado con build de Vite,
> `oxlint` y smoke test de dominio. CI: `.github/workflows/ci.yml`.

## 1. Qué resuelve

El informe institucional nº 5 es la **sumatoria y promedio de cada periodo
en su respectiva asignatura**: para cada estudiante y asignatura, la app
promedia la nota de esa asignatura a lo largo de los informes de periodos y
produce el boletín final con:

- una columna por informe de periodo (Informe 1..N),
- **Promedio** por asignatura (valor crudo, dos decimales),
- **Valoración cualitativa** por asignatura (aplica redondeo institucional),
- promedio general final, valoración general y puesto (ranking denso).

El informe final es **derivado, no persistido**: no se guarda aparte ni se
edita; siempre se recalcula desde los informes de periodos cargados.

## 2. Flujo del docente

1. **Informe 1**: al abrir la app por primera vez, importá `informe-1.xlsx`
   (o creá todo a mano con "Crear manualmente"). Queda como el único informe.
2. **Informe 2..4**: en la barra **Gestión de informes** usá
   **"Importar Excel (periodo)"** para cada archivo nuevo, o
   **"Nuevo periodo en blanco"** que clona el informe activo (mismos
   estudiantes/asignaturas/docentes, notas vacías) para llenarlo a mano.
   Cada informe aparece como pestaña y se numera automáticamente.
3. **Informe final**: el botón **"Informe 5 (final)"** (el número crece según
   la cantidad de informes) abre el boletín computado. Desde ahí funcionan la
   vista previa, la impresión (`Ctrl+P`) y el ZIP masivo igual que en los
   informes de periodo.

Cada importación acepta **un archivo con una hoja activa**; un periodo = un
archivo (o un periodo manual a mano).

## 3. Formato del Excel

Fila 1 = encabezados; la app descubre dinámicamente las asignaturas:

```text
Estudiante | Grado | Docente | Matemáticas | Docente (Matemáticas) | Ciencias | Docente (Ciencias) | ...
```

- Columnas reservadas: `Estudiante` (+ alias `Nombre/Alumno`), `Grado`
  (+ `Curso/Aula`), `Docente` (+ `Profesor`).
- **`Docente (Asignatura)`**: convención opcional para el docente por
  asignatura. Solo se lee la **primera fila de datos**. Sin esas columnas,
  el boletín usa el `Docente` global.
- **Celda vacía = dato ausente**, nunca cero. Ideal para inasistencias.
- La plantilla descargable desde la app ("Descargar plantilla") ya trae el
  formato con ejemplos.

## 4. Reglas de cálculo (`buildFinalReport` en `src/utils/calculations.js`)

| Regla | Detalle |
|---|---|
| Asignaturas | **Unión** de todos los informes, en orden de primera aparición. Si una asignatura no existía en un periodo, ese casillero queda `—`. |
| Emparejamiento de estudiantes | Por **nombre normalizado** (mayúsculas, sin espacios de borde). La grafía de la primera vez que aparece es el nombre mostrado. |
| Promedio por asignatura | Promedio entre periodos **ignorando celdas vacías**: ausencias no penalizan. |
| Valoración por asignatura | Redondeo institucional según la **escala configurada**: decimal 1.0–5.0 sube a la décima (2.92 → 3.0), centesimal 1–100 sube al entero (59.3 → 60) — luego se busca la banda de la escala configurada. |
| Promedio general | Promedio **crudo** de los promedios por asignatura (dos decimales visibles). |
| Puesto | `rankStudents`: orden por promedio crudo, empates comparten puesto y la numeración es **densa** (sin saltos) — RF-05. |
| Docente por asignatura | **Gana el informe más reciente**: si el docente cambió a mitad de año, el final refleja el último cargado. |
| Desempeños finales | Columna **Desempeño** editable en la hoja final. Se guardan **por nombre normalizado del estudiante** (misma regla que el emparejamiento) en una capa de persistencia aparte, de forma que re-importar periodos nunca los pisa. En cada asignatura solo pueden verlos los informes de periodo. |
| Matriz descriptiva | `Cargar desempeños (excel)` importa una hoja `Asignatura × Bajo/Básico/Alto/Superior` con textos, y **precarga solo casilleros vacíos** usando la banda del redondeo institucional (`roundUpTenth` antes de `qualitativeFor`). Aplica en el informe activo o en el final (claves por nombre); los juicios ya escritos por el docente no se pisan. |

## 5. Modelo y persistencia (RNF-01)

Todo en `sessionStorage` (volátil: sobrevive a recargas, muere al cerrar la
pestaña), clave por clave:

| Clave | Contenido |
|---|---|
| `informes.reports` | Array de informes de periodo: `{ id, label, grade, teacher, subjects[], teachers{}, students[] }`. `label` es `Informe N`. |
| `informes.activeReport` | `id` del informe activo. |
| `informes.tab` | `period` o `final`. |
| `informes.selected` | Estudiante seleccionado. |
| `informes.finalPerformances` | Desempeños del informe final: `{ NOMBRE: { Asignatura: texto } }`. |
| `informes.config` | Escala, institución, periodo, escudo en base64. |
| `informes.report` | ⚠ clave legacy (primitivo). Se migra una sola vez a `informes.reports` como `Informe 1`. |

Notas del modelo:

- `subjects` sigue siendo `string[]` porque es la **clave** de `scores` y
  `teachers` por estudiante; el docente por asignatura vive en el mapa
  paralelo `report.teachers = { "Matemáticas": "Prof. X", ... }`.
- Al duplicar un periodo (`Nuevo periodo en blanco`) los estudiantes se
  regeneran con ids nuevos: las observaciones/desempeños son por periodo y
  compartir id filtraría ediciones a todos los informes a la vez.

## 6. Verificación

- **Build**: `npm run build` (Vite) + `npx oxlint src` — pasan en CI por push/PR.
- **Unit tests**: `npx vitest run` (`src/utils/calculations.test.js`) cubre ties densos,
  redondeo 2.92→3.0 antes de la banda, unión de asignaturas, matching por nombre,
  promedios que ignoran nulls y el merge de desempeños finales por nombre.
- **E2E**: `npx playwright test` — pestaña final promedia por asignatura a través de
  periodos y los desempeños finales sobreviven recargas sin ensuciar los de periodo.
- **Datos de prueba**: `samples/make-sample-workbooks.cjs` genera `informe-1..4.xlsx`
  con casos borde incluidos:
  - Ana falta en Matemáticas del Informe 3 → su promedio no se penaliza.
  - Carla y Elena tienen notas **idénticas** → comparten puesto (numeración densa).
  - Diego saca 2.92 en Matemáticas → se ve el redondeo a 3.0 → **Básico**.

```bash
node samples/make-sample-workbooks.cjs ~/Downloads
```

## 7. Limitaciones conocidas

- El import **de periodo individual** (`Importar Excel (periodo)`) ejecuta una
  sola hoja. El **backup** (`Exportar backup (.xlsx)` / re-import desde la
  pantalla inicial) en cambio trabaja con una hoja por informe y restaura la
  sesión multi-periodo completa, desempeños incluidos.
- Cambiar nombres de estudiantes entre periodos los desempareja (se combinan
  por nombre; es la identidad institucional esperada). Los desempeños finales
  siguen la misma identidad: si se renombra a un estudiante, el texto guardado
  bajo el nombre viejo deja de mostrarse.
