# Informes académicos — Manual de uso

Guía del docente/rector para generar, cargar y exportar informes académicos.
Nada se sube a un servidor: todo vive en la pestaña del navegador
(sessionStorage) y muere al cerrarla. Documentación de módulos en `docs/`.

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

## 3. Vida diaria del informe

- **Lista de estudiantes** (izquierda): cursor para elegir el estudiante;
  muestra posición y promedio.
- **Boletín editable** (derecha): en cada asignatura edita la nota y el
  **desempeño** (juicio valorativo). Se guarda en la pestaña al instante.
- **Gestión de informes**: con más de un periodo cargado aparece una pestaña
  por informe, además del botón del informe final.

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
  (notas, docentes por asignatura y desempeños incluidos). Es tu resguardo:
  la sesión vive en `sessionStorage` y muere al cerrar la pestaña.
  Para recuperar: abre la app en una sesión nueva, completa la configuración
  y **empieza por importar ese mismo archivo** (si detecta hojas Informe N
  restaura todo el año de una vez).
- **Cargar desempeños (excel)**: importa la **matriz descriptiva** —una hoja
  `Asignatura | Bajo | Básico | Alto | Superior` con el texto que usas por
  banda— y precarga los casilleros de desempeño que están **vacíos** según la
  banda del redondeo institucional de cada nota. Lo que ya escribió el docente
  **no se sobrescribe**. Se aplica al informe activo (periodo) o al final si estás en
  la pestaña del informe final; los textos quedan guardados.

## 6. Consejos y límites actuales

- Los datos **no salen del navegador** excepto por los archivos que
  descargas: exporta tu backup antes de cerrar la pestaña.
- Si escribes desempeños largos, el boletín puede superar una página A4:
  la exportación a PDF corta el contenido en páginas automáticamente y la
  impresión del navegador respetará el paginado nativo.
- Renombra el backup si guardas varios días (`informes-backup-AAAA-MM-DD`
  ya trae fecha).

## 7. Documentación de módulos

- `docs/final-report.md` — informe final (quinto informe) y flujo multi-periodo.
- `samples/make-sample-workbooks.cjs` — genera los `informe-1..4.xlsx` de
  prueba, con casos borde incluidos (estudiante ausente, empate denso,
  redondeo 2.92 → 3.0):

  ```bash
  node samples/make-sample-workbooks.cjs ~/Downloads
  ```
