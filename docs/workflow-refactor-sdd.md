# Refactor del flujo de trabajo — SDD

**Estado:** borrador para aprobación. No implementado.
**Alcance de este documento:** plan de trabajo estricto; no autoriza ejecutar código ni levantar agentes.
**Base verificada:** aplicación React/Vite, IndexedDB, landing, menú de entrada, boletines y editor manual actuales.

---

## 1. Problema a resolver

1. Falta una acción clara y segura para limpiar el trabajo terminado y empezar otro grado sin perder la configuración institucional.
2. El menú «Gestión de informes» mezcla períodos, acciones de edición, importaciones, descargas y respaldo en una sola fila flexible. No hay jerarquía clara.
3. La precarga de desempeños y sus descargas existen en el menú de entrada y en `PeriodBar`, pero no son visibles desde la landing y el menú de entrada desaparece cuando ya existen informes. Desde la perspectiva del usuario, la opción parece inexistente.
4. No hay una ruta clara para volver a la pantalla de carga manual y editar. La edición actual de notas y desempeños ocurre sobre las pantallas que muestran boletines.
5. Los campos editables no se distinguen visualmente de los campos de solo lectura.

## 2. Objetivo

Definir un flujo único, navegable y comprensible:

**Landing → configuración inicial → menú de gestión → editor → boletín de solo lectura → exportar.**

El docente debe poder limpiar un grado terminado, iniciar otro, precargar desempeños desde la landing o el menú, editar fuera del boletín y reconocer de inmediato qué campos son editables.

## 3. Fuera de alcance

- Backend, cuentas, autenticación o sincronización con servidores.
- Nuevas dependencias de routing o formularios.
- Cambios al cálculo de promedios, bandas, escalas, impresión o exportación.
- Colaboración simultánea en tiempo real.
- Borrado de la configuración institucional como parte del botón «Limpiar informes».
- Reescritura completa del diseño visual de la aplicación.

## 4. Decisiones de diseño que requieren aprobación

| ID | Decisión propuesta |
|---|---|
| D1 | «Limpiar informes» siempre pedirá confirmación y conservará institución, escala y escudo. Borrará períodos, desempeños finales y matrices pendientes. |
| D2 | El flujo tendrá rutas hash mínimas: `#/gestion`, `#/editor`, `#/editor-final`, `#/boletin`, `#/final` y `#/contacto`, sin agregar una librería de routing. |
| D3 | Los boletines serán completamente de solo lectura. Toda edición ocurrirá en una pantalla de editor separada. |
| D4 | `ManualEntryForm` se generalizará como editor compartido para crear y editar períodos, incluyendo notas, estudiantes, asignaturas y desempeños. |
| D5 | Los desempeños finales también se editarán en el editor, no sobre el informe final. |
| D6 | La precarga de desempeños será visible en la landing y en el menú de gestión mediante un componente compartido. |
| D7 | Después de limpiar, el usuario volverá al menú de gestión con su configuración intacta. |
| D8 | El contraste editable será sutil: fondo apenas azulado, borde visible y foco reforzado; no se usarán fondos fuertes ni iconos repetitivos. |

Si alguna decisión no se aprueba, se ajusta el SDD antes de crear issues.

---

## 5. Requisitos funcionales

### R1 — Limpieza segura del trabajo

- El menú de gestión incluirá «Limpiar informes» en el grupo «Respaldo y datos».
- Al activarlo, un modal indicará con precisión:
  - qué se borrará: todos los períodos, notas y desempeños, incluidos los finales;
  - qué se conservará: institución, escala, escudo y configuración;
  - que la acción no se puede deshacer;
  - que el backup `.xlsx` es el mecanismo para conservar una copia.
- Acciones: «Cancelar» y «Limpiar informes». No se usará `window.confirm`.
- Al confirmar:
  - se borrarán de IndexedDB `informes.reports` e `informes.finalPerformances`;
  - se restablecerán la vista activa, `informes.pendingMatrix` y `informes.pendingHold`;
  - no se borrará `informes.config`;
  - se conservarán la pestaña y el estado `entered`;
  - se volverá a `#/gestion`;
  - las otras pestañas se sincronizarán mediante el mecanismo existente.
- En modo solo lectura, la acción estará deshabilitada.
- La operación debe ser atómica respecto de las claves afectadas y no debe eliminar la base ni su esquema.

### R2 — Navegación explícita del flujo

Rutas mínimas:

| Ruta | Pantalla | Contenido |
|---|---|---|
| `#/gestion` | Menú de gestión | Nuevo trabajo, períodos existentes, desempeños y respaldo |
| `#/editor` | Editor del período activo | Crear o editar estudiantes, notas, asignaturas y desempeños |
| `#/editor-final` | Editor final | Desempeños finales por estudiante y asignatura |
| `#/boletin` | Boletín del período activo | Vista de solo lectura |
| `#/final` | Informe final | Vista de solo lectura |
| `#/contacto` | Contacto | Formulario existente |

Reglas:

- Sin informes, al entrar a la herramienta se mostrará `#/gestion`.
- Con informes, la ruta inicial será `#/boletin`.
- Desde cualquier boletín habrá «Volver al menú» y «Editar período».
- Desde el editor habrá «Guardar» y «Volver sin guardar».
- Atrás/adelante del navegador debe funcionar.
- Los hash desconocidos usarán una ruta segura por defecto.
- La landing y el contacto no modificarán el comportamiento de bloqueo entre pestañas ya verificado.

### R3 — Menú de gestión organizado

El contenido se organizará en secciones, no en una única fila de botones:

1. **Nuevo trabajo**
   - Importar Excel de estudiantes.
   - Crear informe manualmente.
2. **Trabajo actual**
   - Lista de períodos y del informe final.
   - Estado del período activo.
   - «Abrir boletín» y «Editar período» cuando corresponda.
3. **Desempeños**
   - Cargar matriz.
   - Descargar plantilla.
   - Descargar ejemplo.
   - Estado visible de la matriz pendiente y opción para reemplazarla o quitarla.
4. **Respaldo y datos**
   - Exportar backup.
   - Limpiar informes.

Reglas visuales:

- Una acción primaria por sección como máximo.
- Los períodos no compartirán fila con acciones de archivo o destrucción.
- La acción destructiva tendrá estilo diferenciado y quedará separada.
- Los grupos conservarán títulos semánticos y orden de tabulación lógico.
- En móvil las secciones se apilarán; no habrá botones cortados.

### R4 — Editor fuera de los boletines

#### R4.1 Editor compartido

`ManualEntryForm` se extenderá con una API conceptual equivalente a:

- `mode: 'create' | 'edit' | 'final'`
- `initial`: informe inicial con estudiantes, notas y desempeños.
- `onSave`, `onCancel`.
- `readOnly`, `maxScore`.

Debe permitir:

- Crear un período desde cero.
- Editar un período existente conservando su identidad.
- Editar el período nuevo en blanco, prellenado desde el período activo.
- Agregar, quitar y renombrar asignaturas.
- Agregar, quitar y renombrar estudiantes.
- Editar notas con normalización de coma decimal y límites de escala.
- Editar desempeños de período por estudiante y asignatura.
- Editar desempeños finales en `#/editor-final`.

Al guardar:

- Solo se actualizará el período correspondiente; los demás no cambiarán.
- Las asignaturas eliminadas se quitarán también de notas y desempeños.
- La matriz pendiente se aplicará únicamente a celdas vacías y cuando existan notas válidas.
- El texto escrito por el docente nunca será reemplazado por la matriz.
- Se persistirá mediante la cola IndexedDB existente.

#### R4.2 Cambios sin guardar

- Si el formulario tiene cambios y el usuario intenta salir, se mostrará confirmación:
  - «Volver sin guardar».
  - «Seguir editando».
- No se mostrará confirmación si no hay cambios.

#### R4.3 Boletines de solo lectura

- Se eliminará la edición de notas de `ReportSheet` en el modo boletín.
- Se eliminarán los textareas editables de desempeño en las vistas de boletín.
- Se eliminará el toggle «Editar notas» de `PeriodBar`.
- Se conservarán navegación, selección, vista previa, impresión y exportación.
- Las capas de captura PDF seguirán siendo estáticas.
- Las pruebas actuales que dependan del flujo anterior se migrarán al nuevo editor, no se eliminarán sin reemplazo.

### R5 — Desempeños visibles desde la landing

Se agregará una sección discreta «Desempeños antes de empezar» en la landing, antes del cierre o del bloque de privacidad:

- «Cargar desempeños (.xlsx)».
- «Descargar plantilla de desempeños».
- «Descargar ejemplo de desempeños».
- Texto breve: explica que la matriz queda guardada y se aplica solo a celdas vacías cuando el informe tenga notas.
- Estado posterior a la carga:
  - cantidad de asignaturas detectadas;
  - «Se aplicará al primer informe con notas»;
  - acciones «Reemplazar archivo» y «Quitar matriz».
- Se usará la misma lógica `pendingMatrix`, validación y aplicación ya implementada.
- El componente de acciones será compartido con el menú de gestión para evitar divergencias.
- No habrá textos que prometan aplicación inmediata sin notas.

### R6 — Campos editables reconocibles

Solo dentro de los editores:

- Fondo sutil azulado `#f4f8fc`.
- Borde `#8da4c2` en reposo.
- Borde y anillo de foco `#3e6fa8`.
- Fondo `#edf4fb` al pasar el cursor, sin cambiar el layout.
- Placeholder claro cuando el campo esté vacío.
- Los campos de solo lectura conservarán el fondo del boletín, sin borde editable.
- El contraste del texto será AA y el borde distinguible del fondo.
- La regla se aplicará a inputs, selects y textareas, incluidos los desempeños.
- No se agregarán iconos ni marcas redundantes.

### R7 — Accesibilidad y persistencia

- Todos los campos conservarán `label` o `aria-label` asociado.
- El modal de limpieza y el de cambios sin guardar gestionarán foco, Escape y retorno del foco.
- El orden de tabulación seguirá el orden visual.
- El modo solo lectura impedirá guardar, importar, limpiar y aplicar matrices.
- Guardar y recargar conservará los cambios en IndexedDB.
- Exportar/importar backup seguirá incluyendo desempeños de período y finales.

---

## 6. Criterios de aceptación por escenario

### Escenario A — Terminar un grado y empezar otro

1. El docente tiene informes guardados.
2. Abre el menú y selecciona «Limpiar informes».
3. Cancela una vez: no cambia ningún dato.
4. Vuelve a abrir y confirma.
5. Los períodos y desempeños se eliminan; institución, escala y escudo permanecen.
6. Regresa a `#/gestion`.
7. Crea manualmente el nuevo grado y sus notas.
8. Recarga: el nuevo grado persiste y el anterior no reaparece.

### Escenario B — Precargar desempeños desde la landing

1. Antes de entrar a la herramienta, el usuario ve las tres acciones.
2. Descarga plantilla y ejemplo.
3. Carga el ejemplo.
4. La landing informa cuántas asignaturas contiene y que se aplicará al primer informe con notas.
5. Entra, crea un informe y escribe una nota.
6. Solo la celda vacía correspondiente se completa.
7. Un texto escrito previamente no se reemplaza.
8. Una matriz vacía se rechaza con mensaje claro.

### Escenario C — Volver a editar

1. Desde un boletín selecciona «Editar período».
2. Llega a `#/editor`.
3. Modifica una nota, agrega un estudiante y escribe un desempeño.
4. Guarda y vuelve al boletín.
5. El boletín refleja los cambios y no muestra ningún campo editable.
6. Puede volver al editor desde el boletín o desde el menú.
7. Atrás/adelante del navegador respeta la navegación.

### Escenario D — Descartar cambios

1. Edita un campo y elige volver sin guardar.
2. Aparece confirmación.
3. Decide seguir editando: el borrador permanece.
4. Repite y descarta: el informe persistido queda sin cambios.

### Escenario E — Informe final

1. Desde `#/final` no hay campos editables.
2. Selecciona «Editar desempeños finales».
3. Edita en `#/editor-final` y guarda.
4. El informe final refleja el texto.
5. Exporta backup, borra y reimporta: el texto se conserva.

### Escenario F — Solo lectura

1. Una segunda pestaña queda en solo lectura.
2. Menú y editor muestran el estado sin permitir modificaciones.
3. Puede ver boletines y exportar.
4. Al promoverse, vuelve a leer IndexedDB y habilita el editor.

---

## 7. Estrategia técnica

### 7.1 Navegación

- Pequeño adaptador hash en `App.jsx` o `src/utils/hashRoute.js`.
- Estado de ruta derivado de `location.hash`, con listener `hashchange`.
- No modificar el orden de hooks ni las reglas ya resueltas para landing/contacto.
- Activar el writer lock solo cuando la herramienta esté activa, como hoy.
- Preservar la hidratación y el comportamiento de pestañas nuevas.

### 7.2 Estado y persistencia

- Reutilizar `dataQueue`, `readOnlyRef`, `tabSync` y `writerLock`.
- Limpieza mediante operaciones sobre las claves afectadas, no `deleteDatabase`.
- No crear una segunda fuente de verdad para los informes.
- Los borradores del editor serán locales; al guardar se actualizará el estado canónico.
- El nombre normalizado del estudiante seguirá siendo la clave de desempeños finales; se documentará el efecto de renombrar.

### 7.3 Componentes previstos

- `ManagementMenu`: secciones del menú.
- `PerformanceMatrixActions`: acciones y estado compartido de matrices.
- `ClearReportsDialog`: confirmación destructiva.
- `UnsavedChangesDialog`: confirmación de borrador.
- `ReportEditor`: extensión de `ManualEntryForm`.
- `FinalPerformanceEditor`: variante final del editor.
- `PeriodBar`: simplificación o retiro gradual de responsabilidades trasladadas al menú.

### 7.4 Migración compatible

- No se cambiará el formato de IndexedDB ni el backup.
- No se requerirá nueva migración de datos.
- Las claves de almacenamiento existentes se conservan.
- Los tests de parsing, cálculo, backup y persistencia deben seguir verdes salvo actualizaciones de flujo justificadas.

---

## 8. Plan de implementación en PRs atómicos

> Ninguna fase comienza sin aprobación de este SDD. Cada fase será una issue y tendrá su propia rama, TDD, PR, auditoría y merge únicamente con CI verde.

### Fase 1 — Navegación y puntos de retorno

**Archivos:** `src/App.jsx`, utilidad de ruta nueva, pruebas de navegación.

- Introducir las rutas hash.
- Mapear las pantallas existentes sin cambiar todavía la edición.
- Agregar «Volver al menú» en boletines.
- Añadir acceso al menú aunque ya existan informes.

**Aceptación:** navegación directa y atrás/adelante funcionan; landing y contacto no cambian; suite vigente verde.

### Fase 2 — Limpieza segura

**Archivos:** `src/App.jsx`, nuevo diálogo, menú provisional o existente, pruebas de persistencia.

- Reemplazar el reset silencioso por el modal.
- Borrado selectivo con conservación de configuración.
- Sincronización entre pestañas.

**Aceptación:** escenario A completo; cancelación sin efectos; datos no relacionados intactos.

**Dependencia:** fase 1.

### Fase 3 — Menú de gestión reorganizado

**Archivos:** nuevo `ManagementMenu`, `DataInputMode`, `PeriodBar`, App.

- Secciones definidas en R3.
- El menú es accesible siempre, incluso con informes.
- Se retiran acciones del PeriodBar que pasan al menú sin perder funcionalidad.

**Aceptación:** todas las acciones existentes siguen accesibles; móvil sin desbordes; agrupación y orden de foco verificados.

**Dependencia:** fases 1 y 2.

### Fase 4 — Editor de períodos y boletines de solo lectura

**Archivos:** `ManualEntryForm`/nuevo editor, `ReportSheet`, `ReportDashboard`, `PeriodBar`, App.

- Editor compartido en modo crear/editar.
- Creación en blanco abre directamente el editor.
- Notas, estudiantes, asignaturas y desempeños editables solo allí.
- Confirmación de cambios sin guardar.
- Boletín sin controles de edición.
- Migración de las pruebas del antiguo modo `scoreEntry`.

**Aceptación:** escenarios C y D; otros períodos intactos; exportación sin inputs; captura/impresión estáticas.

**Dependencia:** fase 3.

### Fase 5 — Editor del informe final

**Archivos:** editor final, `FinalReportSheet`, App, pruebas de backup.

- Edición de anotaciones finales fuera del boletín final.
- Vista final de solo lectura.
- Round-trip del backup con anotaciones.

**Aceptación:** escenario E; no se editan promedios ni resultados calculados.

**Dependencia:** fase 4.

### Fase 6 — Precarga visible de desempeños

**Archivos:** `Landing.jsx`, `DataInputMode`, nuevo componente compartido, App, manual.

- Sección en landing.
- Componente compartido con el menú.
- Estado cargado/reemplazar/quitar.
- Pruebas de plantilla, ejemplo y aplicación pendiente.

**Aceptación:** escenario B; no hay promesas falsas; no se duplica lógica.

**Dependencia:** fase 4 para el recorrido completo de aplicación.

### Fase 7 — Contraste editable, accesibilidad y cierre

**Archivos:** estilos de editor/UI, `DESIGN.md`, `docs/manual-de-uso.md`, `public/manual-de-uso.md`, `spec.md`, `PRODUCT.md`.

- Aplicar R6.
- Revisar foco, teclado, lector de pantalla y responsive.
- Actualizar manual y SPEC con el flujo nuevo.
- Detector Impeccable en landing, menú, editor y boletín.
- Auditoría final de regresiones.

**Aceptación:** detector sin hallazgos introducidos; contraste AA; manual y public idénticos; suite completa verde.

**Dependencia:** fases 4–6.

---

## 9. Estrategia de pruebas

### Unitarias

- Parser de rutas y rutas desconocidas.
- Selección de datos a borrar en limpieza: configuración conservada, datos eliminados.
- Transformación del editor: agregar/quitar/renombrar asignaturas y estudiantes.
- Normalización y clamp de notas.
- Guardado de un período sin alterar otros.
- Matriz pendiente: no aplicar sin notas ni sobre texto escrito.
- Componentes de diálogo: estados abrir/cancelar/confirmar.

### End-to-end

- Los seis escenarios A–F.
- Navegación hash directa y atrás/adelante.
- Menú con y sin informes.
- Presencia de descargas en landing y menú.
- Boletín y captura sin inputs editables.
- Editor final y round-trip del backup.
- Recarga tras guardar.
- Solo lectura y promoción de pestaña.
- Responsive a 360, 390, 768 y 1440 px.

### Estáticas y de craft

- `oxlint` sin errores nuevos.
- Build de producción.
- Detector Impeccable sin anti-patrones ni avisos nuevos.
- Manual y copia pública idénticos.
- Copy en español neutro.

### Regresiones obligatorias

- Importación normal y backup.
- Escalas decimal y centesimal.
- Matrices con bandas y rounding.
- Promedios e informe final.
- Exportación PDF/ZIP/backup.
- Migración legacy y persistencia IndexedDB.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Las rutas nuevas rompen landing, contacto o navegación previa | Fase 1 aislada, pruebas directas de rutas y de atrás/adelante |
| La limpieza borra datos por una condición incompleta | Confirmación modal, prueba de conservación de config y de las claves afectadas |
| La edición queda parcialmente en boletines | Inventario de affordances y aserción e2e de cero inputs en boletín/captura |
| El editor introduce una segunda fuente de datos | Borradores locales y escritura única al guardar en el estado canónico |
| Cambios sin guardar se pierden al navegar | Dirty tracking y diálogo de descarte |
| La matriz se aplica dos veces o en un informe incorrecto | Reutilizar guardas actuales y añadir pruebas de exactly-once |
| Un reset en una pestaña deja otra con datos obsoletos | `tabSync` y relectura posterior; prueba multi-pestaña |
| La reorganización crea desbordes móviles | Secciones apiladas y pruebas a 360/390/768 |
| El contraste nuevo resulta excesivo | Ajuste sutil limitado al editor; capturas y detector |
| Las pruebas antiguas se debilitan al migrar el flujo | Reemplazo uno a uno de escenarios, sin borrar aserciones sin equivalente |

---

## 11. Definition of Done global

- [ ] Los escenarios A–F funcionan.
- [ ] Limpiar exige confirmación y conserva configuración.
- [ ] El menú está agrupado y es accesible con informes existentes.
- [ ] Desempeños se puede cargar desde landing y menú; plantilla y ejemplo se descargan en ambos lugares.
- [ ] Ninguna edición ocurre sobre boletines.
- [ ] Se puede volver al editor desde boletín y menú.
- [ ] Campos editables reconocibles y con contraste AA.
- [ ] Backup y exportaciones siguen funcionando.
- [ ] Datos persistidos tras recarga y sin duplicar matrices.
- [ ] Unitarias, e2e, oxlint, build y detector pasan.
- [ ] Manual, SPEC, PRODUCT y DESIGN actualizados.
- [ ] Cada PR pasó auditoría y CI verde antes del merge.

---

## 12. Pipeline propuesto después de la aprobación

1. Convertir cada fase en una issue con requisitos y pruebas de este documento.
2. Implementar secuencialmente para evitar conflictos de worktree.
3. Escribir primero las pruebas que fallen por la razón correcta.
4. Completar la implementación mínima que las vuelva verdes.
5. Ejecutar auditoría read-only por PR; corregir blockers antes de merge.
6. Verificar explícitamente `gh pr checks` antes de cada merge.
7. Cerrar con la fase 7, documentación y memoria técnica actualizada.

**Aprobación requerida antes de iniciar:** D1–D8 y el orden de fases 1–7.
