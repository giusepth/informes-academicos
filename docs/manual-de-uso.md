# Informes académicos — Manual de uso

Guía del docente/rector para generar, cargar y exportar informes académicos.
Nada se sube a un servidor: los datos del colegio se guardan en el navegador
(IndexedDB). Las escrituras ya confirmadas se conservan al cerrar la pestaña;
una edición hecha justo antes de cerrar puede no alcanzar a guardarse.
Documentación de módulos en `docs/`.

## 0. La página de entrada

La primera visita muestra una **página de presentación** (landing) con la
propuesta de la herramienta: qué hace, en tres pasos, y qué pasa con los
datos. El botón **Abrir la herramienta** entra directo al modal de
*Configuración inicial* (sección 1); la pestaña recuerda que ya entraste, así
que las visitas siguientes abren la herramienta de frente. Si tu colegio
quiere una versión a medida, el pie ofrece contacto.

## 1. Primer arranque (RF-01)

1. La app abre el modal **Configuración inicial**.
2. Elige la **escala de calificación**: ¿calificas de **1.0 a 5.0 (decimal)**
   o de **1 a 100 (centesimal)**? El switch recarga los rangos por defecto de
   cada banda según lo escojas:
   - Decimal: Bajo 0–2.9, Básico 3.0–3.9, Alto 4.0–4.5, Superior 4.6–5.0.
     El redondeo institucional sube a la próxima **décima** (2.92 → 3.0).
   - Centesimal: Bajo 1–59, Básico 60–79, Alto 80–89, Superior 90–100.
     El redondeo institucional sube a la próxima **unidad** (59.3 → 60).
3. Ajusta los rangos a mano si tu colegio usa otros cortes (quedan editables).
4. Completa institución y periodo; carga el **escudo institucional**
   (PNG recomendado): se usa como marca de agua del informe impreso y como
   encabezado del boletín.
5. **Guardar configuración**. Puedes reabrir esto con el botón
   *Configuración* del encabezado — cambias de escala cuando quieras: se
   recalculan bandas y redondeo en todo lo nuevo que escribes.

## 2. Cargar datos de un informe (RF-02, RF-03)

Dos caminos:

- **Importar Excel (.xlsx)**: arrastra el archivo o elígelo con el botón.
  Formato: una fila de encabezados, luego una fila por estudiante.

  ```text
  Estudiante | Grado | Docente | Matemáticas | Docente (Matemáticas) | Español | ...
  ```

  - Celda vacía = dato ausente (no cuenta como cero).
  - `Docente (Asignatura)` es opcional y define el docente de cada materia
    (se lee de la primera fila de datos).
  - La cantidad de asignaturas es libre (N dinámico).
- **Crear manualmente**: completa grado, docente, asignaturas (con docente
  opcional por asignatura) y estudiantes.

En ambos casos la app calcula: promedio por estudiante (crudo, 2 decimales),
valoración cualitativa con redondeo institucional (2.92 → 3.0) y puesto
(descendente por promedio crudo; empates comparten puesto y la numeración
no salta puestos).

### Descargar y cargar desempeños desde el menú

Antes de crear el primer informe, la pantalla inicial ofrece la sección
**Desempeños** con tres acciones:

- **Cargar desempeños (excel)**: importa la matriz descriptiva del colegio.
  Como todavía no hay informes, la matriz queda **pendiente** y se aplica
  automáticamente al **primer informe que abras**, sea manual o importado como
  archivo de un solo informe, cuando tenga estudiantes y al menos una nota.
  Si el informe todavía no tiene notas, la matriz sigue pendiente y no se
  consume. El aviso confirma la carga y, después, el informe donde se aplicó.
  La carga pendiente se conserva en esta pestaña aunque recargues la página.
- **Descargar plantilla de desempeños** (`plantilla-desempenos.xlsx`): matriz
  con los encabezados `Asignatura | Bajo | Básico | Alto | Superior`, una
  segunda hoja **Instrucciones** con la guía de uso y las celdas de banda
  **vacías** para que las completes. Si la cargas sin completar, la app
  muestra un aviso y no la deja pendiente.
- **Descargar ejemplo de desempeños** (`ejemplo-desempenos.xlsx`): matriz
  **lista para usar**, con cuatro asignaturas y textos redactados para cada
  banda. Sirve para ver el formato esperado o para partir de ella.

La matriz completa **solo los casilleros de desempeño vacíos**: si ya
escribiste un juicio valorativo, se conserva. Las acciones de plantilla y
ejemplo también están disponibles en **Gestión de informes**, junto a
«Cargar desempeños (excel)».

Si restauras un backup mientras hay una matriz pendiente, la restauración
**no consume** la matriz: se mantiene el resumen del backup y la matriz queda
pendiente hasta que califiques o edites el informe, aunque recargues la
página.

## 3. Vida diaria del informe

- **Lista de estudiantes** (izquierda): cursor para elegir el estudiante;
  muestra posición y promedio.
- **Boletín editable** (derecha): en cada asignatura edita la nota y el
  **desempeño** (juicio valorativo). Se guarda en este navegador al instante:
  las escrituras ya confirmadas se conservan al cerrar la pestaña; una edición
  hecha justo antes de cerrar puede no alcanzar a guardarse.
- **Carga manual de notas**: **Editar notas** abre la escritura directa de las
  notas del período activo y **Nuevo periodo en blanco** entra directo en ese
  modo. Mientras está activo también puedes agregar un estudiante a mano con su
  nombre y el botón **Agregar**. **Terminar edición** vuelve a la vista de solo
  lectura.
- **Gestión de informes**: con más de un periodo cargado aparece una pestaña
  por informe, además del botón del informe final.

### Varias pestañas abiertas

Una sola pestaña edita los informes a la vez. Si abres una segunda pestaña
del mismo navegador:

- La pestaña que ya estaba abierta conserva la edición.
- La segunda queda en **solo lectura**: puede navegar por los periodos y
  estudiantes, previsualizar, imprimir y exportar (PDF, ZIP o backup .xlsx),
  pero no puede modificar notas, desempeños ni la configuración.
- Al cerrar la pestaña que edita, la pestaña en solo lectura se activa
  automáticamente con los datos más recientes. El aviso de solo lectura
  también ofrece **Reintentar** para volver a pedir el turno.

El bloqueo lo administra el navegador y se libera cuando la pestaña editora
se cierra. Si el navegador no ofrece esta función, ambas pestañas pueden
editar y se aplica el criterio de "la última escritura gana": revisa los
cambios antes de seguir.

Sin IndexedDB (modo privado o navegador bloqueado), el trabajo vive por pestaña y no hay coordinación entre pestañas.

## 4. Varios periodos y el informe final

1. Importa `informe-1.xlsx` → aparece la barra de gestión con **Informe 1**.
2. Para el siguiente periodo: **"Importar Excel (periodo)"** con un archivo
   nuevo, o **"Nuevo periodo en blanco"** para dejar la estructura lista y
   escribir a mano (los ids de estudiantes se regeneran: las observaciones
   quedan separadas por periodo, como corresponde).
3. El botón **"Informe N (final)"** (se numera según la cantidad cargada)
   abre el boletín que promedia cada asignatura entre los periodos: una
   columna por informe + **Promedio** + **Valoración** + **Desempeño**.
   Los estudiantes se emparejan **por nombre**, las ausencias no penalizan
   y el docente por asignatura toma el del informe más reciente.
4. La columna **Desempeño** del boletín final es editable: escribe ahí el
   juicio valorativo final. Se guarda al instante y **no depende de los
   informes de periodo**: reimportar periodos no borra lo anotado.

Detalles completos del módulo: `docs/final-report.md`.

## 5. Exportar

- **Vista previa**: revisa el boletín limpio (sin casillas de edición) antes
  de imprimir. También puedes imprimir con `Ctrl+P` desde ahí.
- **Imprimir**: imprime sólo la hoja del informe activo (el resto de la
  interfaz queda fuera de la impresión).
- **Generar ZIP (todos)**: descarga un .zip con un PDF por estudiante.
- **Exportar backup (.xlsx)**: descarga un Excel con **una hoja por informe**
  (notas, docentes por asignatura y desempeños de período incluidos) y, si hay
  anotaciones, una hoja **Final (desempeños)** con los desempeños del informe
  final. El backup incluye periodos, notas, desempeños de período y desempeños
  finales; no incluye la configuración ni el escudo. Es tu resguardo para
  pasar el trabajo a otro equipo o antes de borrar los datos del sitio.
  Para recuperar: abre la app en otro navegador o computadora, completa la
  configuración y **empieza por importar ese mismo archivo** (si detecta hojas
  Informe N restaura la sesión completa de una vez: periodos, notas y
  desempeños, finales incluidos).
- **Cargar desempeños (excel)**: importa la **matriz descriptiva** —una hoja
  `Asignatura | Bajo | Básico | Alto | Superior` con el texto que usas por
  banda— y precarga los casilleros de desempeño que están **vacíos** según la
  banda del redondeo institucional de cada nota. Lo que ya escribió el docente
  **no se sobrescribe**. Se aplica al informe activo (periodo) o al final si estás en
  la pestaña del informe final; los textos quedan guardados. Junto a este botón,
  **Plantilla de desempeños** y **Ejemplo de desempeños** descargan los mismos
  archivos que ofrece el menú inicial (`plantilla-desempenos.xlsx` y
  `ejemplo-desempenos.xlsx`): la plantilla incluye la hoja Instrucciones y las
  celdas de banda vacías (si la cargas sin completar, la app avisa y no aplica
  nada); el ejemplo, una matriz lista para usar.

## 6. Dónde viven los datos y cuándo se pierden

Los **datos del colegio** (configuración, informes de periodo, desempeños y
desempeños del informe final) se guardan en la base de datos local del
navegador (**IndexedDB**) para este sitio. El **estado de vista** (pestaña
activa, periodo y estudiante seleccionados) se guarda en `sessionStorage`, por
pestaña; es una comodidad de navegación, no el respaldo del trabajo.

El trabajo sobrevive a recargas y a reinicios del equipo. Las escrituras ya
confirmadas se conservan al cerrar la pestaña; una edición hecha justo antes de
cerrar puede no alcanzar a guardarse. Se pierde si:

1. cambias de navegador o de computadora: otro navegador no ve estos datos;
2. borras los datos del sitio (cookies y almacenamiento del sitio; vaciar solo
   la caché no siempre alcanza);
3. usas el modo privado;
4. el navegador puede liberar espacio automáticamente bajo presión de cuota
   (por ejemplo, si el equipo tiene poco espacio disponible);
5. usas **Nuevo informe**: borra los informes y los desempeños finales
   guardados en este navegador (hoy no hay confirmación), así que exporta el
   backup antes.

El **backup .xlsx** es el puente entre equipos y navegadores, y el resguardo
recomendado antes de borrar los datos del sitio o de usar **Nuevo informe**.

En un **equipo compartido**, cualquier persona que abra este navegador puede
ver los informes guardados. **Una sola pestaña edita a la vez**: las demás
quedan en solo lectura y se activan al cerrarse la editora (sección 3). Sin
IndexedDB (modo privado o navegador bloqueado), el trabajo vive por pestaña y
no hay coordinación entre pestañas.

Si vienes de una versión anterior, el trabajo que estaba guardado en la
pestaña se importa una sola vez a IndexedDB (migración automática).

## 7. Consejos y límites actuales

- Exporta el backup .xlsx si vas a trabajar en otro equipo, si vas a usar
  **Nuevo informe** o antes de borrar los datos del sitio: es la copia segura
  del trabajo (periodos, notas, desempeños de período y desempeños finales; no
  incluye la configuración ni el escudo).
- Exportar e imprimir sigue disponible en la pestaña de solo lectura, igual
  que en la editora.
- Si escribes desempeños largos, el boletín puede superar una página A4:
  la exportación a PDF corta el contenido en páginas automáticamente y la
  impresión del navegador respetará el paginado nativo.
- Renombra el backup si guardas varios días (`informes-backup-AAAA-MM-DD`
  ya trae fecha).

## 8. Documentación de módulos

- `docs/final-report.md` — informe final (quinto informe) y flujo multi-periodo.
- `samples/make-sample-workbooks.cjs` — genera los `informe-1..4.xlsx` de
  prueba, con casos borde incluidos (estudiante ausente, empate denso,
  redondeo 2.92 → 3.0):

  ```bash
  node samples/make-sample-workbooks.cjs ~/Downloads
  ```
