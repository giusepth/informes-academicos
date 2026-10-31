# Flujo de carga guiada — especificación (a prueba de tontos)

Estado: **especificación aprobada, sin implementar**. No hay código de este documento en el repositorio todavía.
Relación: extiende `docs/remodelacion-ux-ui.md` (S8) y corrige el asistente actual (`ManualEntryWizard`), que mezcla estudiantes, materias y desempeños en una sola pantalla.
Entrega: cada tarea de este documento tiene su issue en GitHub (sección final).

---

## 1. Problema

El asistente actual concentra demasiadas decisiones en el paso 1 (estudiantes + materias + grado + docente) y ofrece el paso de desempeños como una pregunta binaria. Un docente nuevo puede:

- dejar materias sin nombre o repetidas sin darse cuenta;
- cargar nombres con errores y descubrirlo recién en el editor;
- no entender qué se cargó y qué no;
- perderse entre “matriz por bandas” y “textos por estudiante”.

La fragmentación en pasos pequeños, cada uno con una sola decisión, reduce errores de captura y hace visible el progreso.

## 2. Principios del flujo (a prueba de tontos)

1. **Una decisión por pantalla.** Nunca estudiantes y materias en el mismo paso.
2. **Validar al avanzar, con error inline** junto al campo que lo causa; nunca solo un toast.
3. **Nunca perder lo escrito.** Atrás conserva todo; el borrador sobrevive un refresh.
4. **El destino se elige al final y guarda una sola vez.**
5. **Conteos siempre visibles** (“12 estudiantes”, “4 materias”, “9 de 24 bandas definidas”).
6. **Copy explícito en tuteo neutro**; prohibido voseo y tecnicismos (“matriz” se explica como “textos por banda”).
7. **Nada se aplica solo:** los textos de desempeño solo completan casilleros vacíos y solo cuando existan notas.

## 3. Mapa del flujo

Entradas (ambas convergen al mismo asistente):

- Gestión → **Crear manualmente** → paso 1.
- Gestión → **Importar Excel (.xlsx)** → el archivo siembra estudiantes y materias (y desempeños si trae) → **paso 4** (resumen), sin repetir captura.

| Paso | Pantalla | Decisión única | Continuar habilita cuando |
|---|---|---|---|
| 1 | Estudiantes | ¿Quiénes son los estudiantes? | ≥ 1 nombre válido |
| 2 | Materias y docentes | ¿Qué materias y con qué docente? | ≥ 1 materia válida |
| 3 | Tipos de desempeño | ¿Qué textos por banda tiene cada materia? | siempre (paso opcional) |
| 4 | Resumen y destino | ¿Editar o exportar? | siempre |

Barra de pasos fija arriba: `1 Estudiantes · 2 Materias · 3 Desempeños · 4 Resumen`. Los pasos completados son clickeables (vuelven sin perder datos). Paso activo con `aria-current="step"`.

Salida: **Cancelar** pide confirmación si hay datos (“¿Descartar la carga y volver a Gestión?”); el borrador no se guarda si se descarta.

## 4. Paso 1 — Estudiantes

Solo nombres. Nada más.

- Lista editable: una fila por estudiante (`Nombre del estudiante N`), botón quitar por fila.
- **Agregar estudiante** (fila vacía) y **Pegar lista** (textarea en un bloque desplegable): un nombre por línea; se omiten vacíos y duplicados.
- Contador vivo: `N estudiantes` (aria-live).
- Validaciones al tocar **Continuar**:
  - fila con solo espacios → se ignora; si todas están vacías → `Agrega al menos un estudiante con nombre.`
  - duplicado (sin distinguir mayúsculas ni tildes) → `“Ana Gómez” ya está en la lista.` (inline en la fila)
  - nombre de 1 carácter → `Escribe el nombre completo del estudiante.`
  - más de 200 → `Puedes cargar hasta 200 estudiantes por período.`
- Al continuar: **“N estudiantes cargados”** visible arriba del paso 2 (confirmación persistente, no toast).

## 5. Paso 2 — Materias y docentes

Datos del período (opcionales, arriba): **Grado / Curso** y **Docente titular**.

Materias: una tarjeta por materia con dos campos:

- **Materia** (obligatorio, `Nombre de materia N`)
- **Docente** (opcional, `Docente de la materia N`)

Acciones: **Agregar materia**, chips de materias comunes (`+ Matemáticas`, `+ Lengua`, …) y quitar por tarjeta.

- Validaciones: mínimo 1 materia; nombre vacío → `Completa o quita la materia sin nombre.`; duplicada → `No repitas el nombre de una materia.`; máximo 20 → `Puedes cargar hasta 20 materias.`
- Al continuar: **“N materias cargadas”** + lista resumida (`Matemáticas — Prof. Andrade · Lengua — sin docente`).

## 6. Paso 3 — Tipos de desempeño por materia

Objetivo: que el docente deje listos los **textos por banda** de cada materia, sin notas todavía. Este paso es **opcional**.

Por cada materia, cuatro campos de texto (uno por banda): **Bajo · Básico · Alto · Superior**.

- Placeholder de ejemplo por banda (mismo texto neutro del producto).
- Badge por materia: `3 de 4 bandas definidas`.
- Explicación fija arriba: “Estos textos se aplican solo a casilleros de desempeño vacíos y solo cuando existan notas. Lo que escribas a mano nunca se reemplaza.”
- Contador global: `Desempeños listos: X de Y bandas definidas`.
- Acciones por archivo:
  - **Descargar plantilla por bandas (.xlsx)** (matriz existente `plantilla-desempenos.xlsx`).
  - **Cargar plantilla por bandas** → rellena las cuatro bandas de cada materia coincidente; muestra `N materias y M textos cargados` y las materias sin coincidencia.
  - Secundario, separado visualmente: **Textos por estudiante (.xlsx)** (`Estudiante | Asignatura | Desempeño`) + **Descargar plantilla de textos por estudiante**.
- Validaciones de archivo: extensión `.xlsx/.xls`, ≤ 10 MB, error inline con el motivo; nunca reemplaza textos ya escritos sin confirmar.
- Se puede continuar con 0 textos: el paso queda “omitido” y el editor ofrece la matriz como hoy.

## 7. Paso 4 — Resumen y destino

Tarjeta resumen (solo lectura):

- Grado / docente titular (o “sin datos”).
- `N estudiantes · M materias` con docentes entre paréntesis cuando existan.
- `X de Y bandas definidas` y `Z textos por estudiante cargados` (si aplica).

Nota fija: **“El período se guarda una sola vez al elegir un destino.”**

Dos botones:

1. **Ir al editor del período** (primario) → guarda el período y abre el editor con todo diligenciado.
2. **Ir a la vista de informes** (secundario) → guarda el período y abre el boletín/exportación.

Reglas:

- Ambos caminos persisten con `persistNewReport` (identidad de estudiantes nueva, precarga de matriz del próximo período si es el primer informe).
- Si el archivo importado ya traía desempeños, el resumen lo indica; no se pregunta de nuevo.
- Nunca se navega a informes antes de este paso (el atajo del primer import queda eliminado).

## 8. Importación (.xlsx) dentro del flujo

- Cualquier import desde Gestión entra al asistente en el **paso 4** (resumen), con estudiantes, materias y desempeños ya sembrados.
- Si el archivo no trae materias válidas o estudiantes, el error se muestra en Gestión y no se abre el asistente.
- El import ya no escribe el informe hasta que el docente elige destino.

## 9. Reglas transversales

- **Borrador**: estado del asistente en `sessionStorage` (`informes.guidedDraft`), restaurado al volver a la pestaña; se limpia al guardar o descartar.
- **Atrás** conserva todo. **Cancelar** confirma si hay datos.
- Errores inline con `role="alert"` y foco automático en el primer campo inválido.
- Enter agrega estudiante/materia; Escape cierra el bloque desplegable, nunca descarta.
- Responsive 360 px: tarjetas apiladas, barra de pasos con scroll horizontal.
- Accesibilidad: labels explícitos, `aria-live="polite"` para conteos, foco visible, contraste AA.
- Identidad: tokens del triplicado (`sheet`, `kraft-line`, `ink-slate`, `form-blue`), campos R6 dentro del asistente.
- Límites: 200 estudiantes, 20 materias, archivos ≤ 10 MB.
- Prohibido: backend, cuentas, telemetría, modales para edición repetitiva.

## 10. Criterios de aceptación

- [ ] Un docente nuevo completa estudiantes → materias → desempeños → destino sin ayuda externa.
- [ ] Con datos inválidos, cada paso explica el error junto al campo y no deja avanzar.
- [ ] Atrás y refresh no pierden nada; cancelar pide confirmación.
- [ ] Importar un .xlsx cae en el resumen, nunca directo en informes.
- [ ] Ambos destinos guardan una sola vez y abren la pantalla correcta con todo diligenciado.
- [ ] Cargar plantillas por bandas o por estudiante muestra conteos y no pisa textos escritos.
- [ ] e2e: 4 specs por paso + flujo completo manual + flujo import + 2 flujos de archivo.
- [ ] unit: validaciones puras cubiertas.

## 11. Fragmentación técnica propuesta (refactor)

- `src/components/guided/GuidedEntryWizard.jsx` — contenedor con máquina de estados (`step: 'students' | 'subjects' | 'performances' | 'summary'`), barra de pasos, draft y validaciones.
- `src/components/guided/StudentsStep.jsx`, `SubjectsStep.jsx`, `PerformanceTypesStep.jsx`, `SummaryStep.jsx`.
- `src/utils/guidedEntry.js` — validaciones y normalizadores puros (nombres, materias, bandas, límites) con tests unitarios.
- `src/utils/guidedDraft.js` — sessionStorage (leer/guardar/limpiar).
- `ManualEntryWizard` actual se reemplaza; App pasa a montar `GuidedEntryWizard` con `imported` cuando viene de un .xlsx.
- Persistencia al destino reusa `persistNewReport`; navegación con `replace: true`.

## 12. Tareas → issues

Cada fila corresponde a una issue de GitHub creada con este documento como referencia.

| ID | Título | Depende de |
|---|---|---|
| G0 | [Epic] Flujo de carga guiada fragmentado | — |
| G1 | Validaciones puras del flujo guiado (guidedEntry.js + tests) | G0 |
| G2 | Contenedor GuidedEntryWizard con máquina de estados y barra de pasos | G1 |
| G3 | Borrador del asistente en sessionStorage (guardar/restaurar/limpiar) | G2 |
| G4 | Paso 1 Estudiantes: lista editable + pegar lista + contador | G2 |
| G5 | Paso 1: validaciones y límites (duplicados sin tildes, máx 200, nombre completo) | G4 |
| G6 | Paso 2 Materias: datos del período + tarjetas materia/docente opcional | G2 |
| G7 | Paso 2: sugerencias de materias, duplicados y límite de 20 | G6 |
| G8 | Paso 3 Tipos de desempeño: 4 bandas por materia + badge de cobertura | G2 |
| G9 | Paso 3: importar plantilla por bandas con preview por materia | G8 |
| G10 | Paso 3: descargar plantilla por bandas desde el paso | G8 |
| G11 | Paso 3: textos por estudiante (Excel largo) + plantilla + preview | G8 |
| G12 | Paso 4 Resumen y destino con guardado único | G2, G4, G6, G8 |
| G13 | Import .xlsx siembra el asistente en el resumen | G12 |
| G14 | Salida segura: Atrás, Cancelar con confirmación y foco en primer error | G2 |
| G15 | Barra de pasos accesible y responsive 360 px | G2 |
| G16 | Copy exacto por pantalla y mensajes de validación inline | G4–G12 |
| G17 | Identidad visual del asistente por pasos (tokens triplicado + R6) | G2 |
| G18 | e2e por paso (4 specs) | G4–G12 |
| G19 | e2e flujo completo: manual, import, plantilla por bandas, textos por estudiante | G18 |
| G20 | Reemplazar ManualEntryWizard monolítico y limpiar tests obsoletos | G18, G19 |
| G21 | Actualizar manual de uso y docs con el flujo nuevo | G19 |

## 13. Fuera de alcance

- Cambios al motor de cálculo, persistencia IndexedDB o parser de notas.
- Nuevos formatos de archivo (se reusan los tres existentes: informe, matriz por bandas, textos por estudiante).
- Backend, cuentas o telemetría.
