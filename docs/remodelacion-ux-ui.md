# Remodelación UX/UI de Informes — dirección de producto

Documento de dirección para una próxima sesión de implementación. No es un plan de código: define **qué cambiar, por qué y en qué orden**, con criterios de aceptación. El diagnóstico viene del dueño del producto (docentes reales como usuarios) y de una revisión del estado actual (`DESIGN.md`, `PRODUCT.md`, `src/components/`).

**Decisión central**: el producto se reorganiza alrededor del **recorrido del docente**, no de la tabla de datos. La carga manual pasa a ser un flujo de primera clase (hoy se siente como el plan B del Excel), y la identidad visual del landing ("boletín triplicado") se extiende a toda la herramienta.

---

## Diagnóstico (síntoma → causa raíz)

| # | Síntoma percibido | Causa real en el código/producto |
|---|---|---|
| 1 | Con muchos estudiantes la interfaz se satura visualmente | `PeriodEditor` muestra la grilla completa (estudiantes × asignaturas × nota × desempeño) sin jerarquía de densidad ni modo de foco |
| 2 | El producto "no tiene vida" | No hay feedback de progreso ni estados de éxito: el docente no sabe cuánto le falta ni celebra terminar |
| 3 | La carga manual se siente agobiante para alguien nuevo | El flujo asume que el usuario ya conoce el modelo (asignaturas → notas → desempeños → matriz) porque lo diseñamos nosotros |
| 4 | "No hay opción de bajar el xlsx tras carga manual" | **Sí existe** (`buildBackupWorkbook`), pero solo en `ManagementMenu`, fuera del contexto de trabajo. Es un problema de descubribilidad, no de funcionalidad |
| 5 | La matriz de desempeños cuesta entenderla y aplicarla | Plantilla/ejemplo se descargan en un lugar (`NextPeriodMatrixActions`), se aplican en otro (`PerformanceMatrixImport` dentro de editores), sin explicación en lenguaje de docente ni vista previa |
| 6 | Dos identidades visuales | Landing = mundo "boletín triplicado" (tokens en `DESIGN.md`); herramienta = slate genérico con paneles redondeados (identidad "incumbent" en `PRODUCT.md`) |

---

## Decisiones de dirección (resueltas, no volver a debatir sin motivo nuevo)

### 1. Densidad: modo enfoque, NO modales para la grilla

El dueño evaluó "modales para diligenciar estudiantes y materias". **Descartado como patrón principal**: con 36 estudiantes, un modal por estudiante multiplica los clics y rompe la comparación entre filas (notas de unos contra otros), que es justamente el valor de la grilla.

En su lugar, en este orden de prioridad:

1. **Modo enfoque por estudiante**: vista alternativa de la misma data (un estudiante, sus asignaturas y desempeños en vertical) con anterior/siguiente. La grilla sigue siendo la fuente de verdad; el modo enfoque es una lente, no otro estado.
2. **Densidad compacta**: menos aire vertical por fila, encabezados y primera columna *sticky*, desempeños colapsados bajo la nota (se expanden por fila).
3. Modales solo para acciones puntuales e irreversibles: importar, confirmar borrados, aplicar matriz. Nunca para edición repetitiva.

### 2. Exportar xlsx desde el contexto de trabajo

- Acción visible **"Descargar respaldo (.xlsx)"** dentro de la barra de exportación del período/informe (`ExportToolbar` en `App.jsx`), reusando `buildBackupWorkbook` de `src/utils/parser.js`. Cero lógica nueva de exportación.
- Al terminar una carga manual, ofrecer el respaldo como paso de cierre ("tu trabajo ya está guardado en este navegador; llevate una copia").
- `ManagementMenu` conserva la exportación global multi-período; no se duplica funcionalidad, se **superficia** la existente.

### 3. Matriz de desempeños: explicar, previsualizar, confirmar

En lenguaje de docente, en el propio punto de aplicación:

1. **Qué es**: "un texto listo por asignatura y nivel (Bajo/Básico/Alto/Superior) que se escribe solo donde el desempeño está vacío".
2. **Qué NO hace**: "nunca pisa lo que ya escribiste" (principio 2 de `PRODUCT.md`: el juicio del docente manda).
3. **Vista previa antes de aplicar**: usar `matrixApplicationStats` (ya existe en `parser.js`) para mostrar "se van a completar N desempeños; M ya tenían tu texto y quedan igual" **antes** de confirmar.
4. Un solo lugar mental: descargar plantilla → completar → cargar → previsualizar → aplicar, con los pasos numerados en la UI del propio editor.

### 4. Una identidad: el triplicado entra a la herramienta

- Extender los tokens de `DESIGN.md` (paper/sheet/kraft/ink-slate/form-blue, Archivo + IBM Plex Mono) a dashboard, editores, menú de gestión y modales. El boletín impreso (`ReportSheet`/`FinalReportSheet`) conserva su look de papel: es el entregable, no se toca salvo contraste.
- Se conservan: tratamiento de campos R6 (`edit-bg #f4f8fc`, foco form-blue) y los colores de bandas Bajo/Básico/Alto/Superior.
- **Vida = movimiento con propósito**, no animación decorativa: ver la sección 6 (sistema de interacción, abajo) — hoy los botones se ven igual en reposo que al tocarlos.

### 5. Fresh eyes: que se entienda sin nosotros al lado

- *Empty states* que enseñan: cada pantalla vacía dice qué se puede hacer ahí y ofrece la acción.
- Primera visita: tres pasos en lenguaje llano (traé tu Excel **o** cargá manual → revisá notas y desempeños → exportá boletines). Sin tour modal invasivo.
- Vocabulario consistente con el manual: *respaldo* (no "backup"), *matriz de desempeños*, *informe final*. Español neutro con tuteo, como el resto del producto.

### 6. Interacción, movimiento y feedback (el "tiene vida", ejecutable)

Hoy los botones no reaccionan al tacto y las acciones no confirman nada: esa es la sensación de producto muerto. Sistema único y sobrio, reutilizando las curvas ya documentadas en `DESIGN.md` (Movimiento/estados) — nada de librería de animación nueva.

**Estados de todo control interactivo** (botones, filas, celdas, anclas):

| Estado | Comportamiento | Duración/curva |
|---|---|---|
| Hover | lift −2/−3px o fondo un paso más profundo; nunca cambia tamaño | 150ms ease-out |
| Active (press) | baja 1px; sin escala llamativa | 90ms |
| Focus-visible | anillo form-blue al 30 % (R6 ya definido) | inmediato |
| Disabled | opacidad reducida + cursor `not-allowed`; el porqué en `title` o texto auxiliar | — |
| Loading | spinner embebido en el botón, ancho estable (sin salto de layout) | — |

**Feedback de acciones** (una sola voz, sin toasts de spam):

- Guardado: indicador inline discreto («Guardado», Plex Mono 12px) que se apaga ~1.5s después. Nunca modal ni toast por cada tecla.
- Acción completada (importar, exportar, aplicar matriz): toast sobrio en esquina inferior, auto-dismiss 4s; «Deshacer» solo donde la acción sea reversible.
- Errores: inline junto al campo o fila que los causó, nunca solo toast.
- Progreso: «N de M desempeños listos» visible y actualizado en vivo mientras se edita.

**Desplazamientos sutiles**:

- Cambio de vista (dashboard → editor): fade + slide 140ms.
- Modo enfoque: transición entre estudiantes 120ms; estudiante activo resaltado.
- Encabezados sticky: sombra fina que aparece/desaparece con el scroll, 120ms.
- Expansión de desempeños bajo la nota: alto animado 160ms ease-out, sin rebote.
- Regla dura: ninguna interacción directa supera 200ms; nada de bounce ni animación en loop.
- `prefers-reduced-motion`: todo salta al estado final, sin animar.

**Criterio de aceptación de "vida"**: cada acción del docente tiene respuesta visual en ≤100ms; ninguna acción queda sin confirmación ni estado sin progreso visible.

---

## Recorrido objetivo

| Paso | Docente con Excel | Docente de carga manual |
|---|---|---|
| 1. Entrar | Landing → cargar .xlsx | Landing → "empezar desde cero", con la misma visibilidad que cargar Excel |
| 2. Configurar | Grado/docente/asignaturas ya vienen del archivo | Asistente corto: grado, docente, asignaturas (con sugerencias de asignaturas comunes) |
| 3. Estudiantes | Ya vienen | Agregar por lista (pegar nombres en bloque) o uno a uno |
| 4. Notas y desempeños | Revisar en grilla o **modo enfoque**; matriz opcional con vista previa | Igual: la grilla y el modo enfoque son compartidos |
| 5. Cerrar | Exportar boletines PDF + respaldo xlsx visible | Igual, con oferta de respaldo al terminar |
| 6. Siguiente período | Duplicar período, precargar matriz | Igual |

El manual de carga manual **no es un flujo aparte**: converge con el de Excel en el paso 4. Todo lo que se construya para uno sirve al otro.

---

## Olas de implementación (una ola = un PR)

### Ola 1 — Carga manual y densidad (la prioridad del dueño)

- Modo enfoque por estudiante + densidad compacta en `PeriodEditor`.
- Acción "Descargar respaldo (.xlsx)" en `ExportToolbar`.
- Entrada manual asistida: asignaturas con sugerencias, estudiantes por lista.
- Empty states con guía en el flujo manual.

**Aceptación**: un docente nuevo completa una carga manual de 10 estudiantes sin ayuda externa; con 36 estudiantes la pantalla no requiere scroll horizontal para editar una nota; el xlsx de respaldo se descarga desde el período en ≤2 clics; todo control nuevo cumple los 5 estados de la sección 6 y el guardado se confirma inline.

### Ola 2 — Matriz de desempeños entendible

- Explicación + pasos numerados + vista previa con `matrixApplicationStats` en `PerformanceMatrixImport`.
- Progreso de desempeños ("N de M listos") en el editor.

**Aceptación**: la vista previa muestra exactamente cuántas celdas se completarán y cuántas se respetan; un texto escrito por el docente jamás se pisa (cubierto por tests existentes de `applyMatrixToReport`).

### Ola 3 — Identidad completa y vida

- Tokens del triplicado en dashboard, menú de gestión, modales y diálogos.
- Sistema de interacción de la sección 6 aplicado a toda la herramienta (estados de controles, feedback, transiciones); auditoría de que ningún botón quedó sin reacción.

**Aceptación**: cero referencias al sistema slate "incumbent" fuera del boletín impreso; AA de contraste en todos los textos; `prefers-reduced-motion` respetado; toda acción deja rastro visual en ≤100ms.

---

## Guardarraíles (no negociables)

- Sin backend, sin cuentas, sin telemetría. Datos en IndexedDB del navegador.
- No tocar `parser.js`, `calculations.js` ni el modelo de persistencia salvo necesidad demostrada: la red de ~30 specs e2e y los tests unitarios deben seguir verdes.
- Cambios visuales y de flujo en PRs separados dentro de cada ola cuando toquen pantallas cubiertas por e2e (facilita ubicar regresiones).
- Nada de testimonios, logos ni métricas inventadas en copy (`PRODUCT.md`).
- Verificación por ola: suite e2e, AA, `impeccable detect`, capturas antes/después en desktop y móvil.

## Por dónde empezar (para el agente implementador)

1. Leer `PRODUCT.md` (principios), `DESIGN.md` (tokens, mundos y movimiento) y este documento.
2. Leer `src/components/PeriodEditor.jsx`, `ExportToolbar.jsx`, `PerformanceMatrixImport.jsx` y `src/components/ui.jsx`.
3. Ola 1 primero, con capturas del estado actual antes de tocar nada.
