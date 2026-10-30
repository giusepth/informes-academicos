# SPEC.md - MVP 0.0.1: Generador SPA de Informes Académicos con persistencia local

---

## 1. Visión General del Producto y Objetivos

El **MVP 0.0.1** es una Aplicación de Página Única (SPA) desarrollada en **React + Vite + Tailwind CSS**, diseñada para la generación y exportación de informes académicos institucionales de manera **100% del lado del cliente**: los datos del colegio se guardan en IndexedDB del navegador (sin backend ni telemetría) y el estado de vista de cada pestaña en `sessionStorage`.

### Principales Características del MVP:
1. **Modo Dual de Entrada:** 
   * Importación masiva mediante archivo tabular (`.xlsx`).
   * **Modo Manual (Vanilla):** Creación e ingreso de datos 100% a mano desde una interfaz interactiva.
2. **Estructura Dinámica de Asignaturas ($N$ Asignaturas):** Capacidad de adaptarse a cursos que manejan diferente número y nombre de asignaturas sin restricciones fijas.
3. **Cálculos Automáticos y Edge Cases:** Redondeo institucional hacia arriba (ej. $2.92 \to 3.0$) aplicado a la valoración cualitativa, ranking por promedio crudo descendente y visualización del promedio con dos decimales.
4. **Desempeños Cualitativos y Carga Opcional:** Espacio editable por asignatura para el docente dentro del editor de período; el informe final es de solo lectura y sus anotaciones se editan en `#/editor-final`. Cada editor carga su propia matriz auxiliar local (período o informe final) y la aplica explícitamente solo a casilleros vacíos.
5. **Identidad Institucional:** Inserción de escudo institucional PNG con opacidad controlada en el fondo del informe impreso/exportado.
6. **Exportación Versátil:** Descarga individual en PDF, paquete compilado en formato `.ZIP` y opción de impresión directa optimizada (`@media print`).
7. **Despliegue Gratuito:** Configurado para compilación estática lista para producción en Vercel.

---

## 2. Requerimientos Funcionales (RF)

*   **RF-01: Configuración Inicial de Escala y Escudo:**
    *   Al abrir la SPA, se presenta un modal de configuración inicial con valores predeterminados (Bajo: 0.0-2.9, Básico: 3.0-3.9, Alto: 4.0-4.5, Superior: 4.6-5.0) editables por el usuario.
    *   Permite cargar una imagen PNG transparente (`logo.png`) que se guarda en el navegador junto con la configuración para aplicarla como marca de agua en los informes.
*   **RF-02: Ingreso de Datos por Importación o Manual (Vanilla):**
    *   *Opción A:* Subir archivo `.xlsx` (formato tabular horizontal con columnas de Estudiante, Grado, Docente y asignaturas dinámicas).
    *   *Opción B:* Interfaz interactiva "Crear Manualmente" donde el usuario define el grado, docente, lista de estudiantes y un número variable de asignaturas ($N$).
*   **RF-03: Adaptabilidad de Asignaturas ($N$ Columnas):**
    *   El sistema no asume una cantidad fija de materias; lee dinámicamente las llaves del Excel o permite agregar/quitar asignaturas de forma interactiva en el modo manual.
*   **RF-04: Procesamiento de Notas y Redondeo:**
    *   Cálculo automático del promedio aritmético por estudiante.
    *   Aplicación de regla de redondeo hacia arriba en la centésima crítica: `Math.ceil(score * 10) / 10`.
    *   El promedio redondeado se utiliza **únicamente** para asignar la valoración cualitativa. El promedio se muestra con **dos decimales** (valor crudo), para que el documento justifique por sí mismo el puesto asignado.
*   **RF-05: Asignación de Puestos y Escala Cualitativa:**
    *   Ordenamiento descendente automático de estudiantes según su **promedio crudo sin redondear** para asignar el puesto institucional.
    *   *Empates:* los estudiantes con el mismo promedio crudo comparten el puesto.
    *   *Puestos densos:* el siguiente promedio distinto toma el número de puesto consecutivo, sin saltar casilleros. Dos estudiantes empatados en el 1° puesto son seguidos por el 2° puesto, no por el 3°.
    *   Asignación automática de la valoración cualitativa (Bajo, Básico, Alto, Superior) con base en la nota redondeada y la escala configurada.
*   **RF-06: Observaciones / Desempeños por Asignatura:**
    *   Apartado de texto libre por cada asignatura para que el docente redacte el juicio valorativo o desempeño específico del estudiante. Los desempeños de período se editan en el editor de período; los finales, en `#/editor-final`. Los boletines son de solo lectura.
*   **RF-07: Exportación y Compilación:**
    *   Generación de vista previa interactiva paginada por estudiante.
    *   Acción individual que abre una vista previa en HTML del informe con opción de impresión (botón "Imprimir" o `Ctrl + P`), en lugar de una descarga automática de PDF.
    *   Botón de compilación masiva que genera un archivo `.zip` con todos los PDFs individuales utilizando `JSZip`.
*   **RF-08: Área de Firmas en el Informe:**
    *   El informe incluye al pie un área en blanco para las firmas del docente y del rector, con sendas líneas y leyendas ("Firma del Docente", "Firma del Rector").
    *   En el MVP 0.0.1 estos campos permanecen en blanco: se imprimen para firma física, sin captura de firma digital ni estado asociado.

---

## 3. Requerimientos No Funcionales (RNF)

*   **RNF-01: Privacidad y persistencia local (sin backend):** Ninguna información se envía a servidores externos ni se recolecta telemetría. Los datos del colegio —configuración, informes de periodo, desempeños y desempeños del informe final— se guardan en IndexedDB del navegador para este sitio. El trabajo sobrevive a recargas y a reinicios del equipo; las escrituras ya confirmadas se conservan al cerrar la pestaña, aunque una edición hecha justo antes de cerrar puede no alcanzar a guardarse. Se pierde si se cambia de navegador o de computadora (otro navegador no ve estos datos), si se borran los datos del sitio (cookies y almacenamiento del sitio; vaciar solo la caché no siempre alcanza), si se usa el modo privado, si el navegador puede liberar espacio bajo presión de cuota o si se usa **Limpiar informes**, que pide confirmación, borra los informes y los desempeños finales guardados y conserva la configuración. El respaldo `.xlsx` —periodos, notas, desempeños de período y desempeños finales— es el puente entre equipos y navegadores. Una sola pestaña edita a la vez cuando el navegador ofrece Web Locks: las demás quedan en solo lectura y se activan al cerrarse la editora; sin esa API ambas pueden editar y vale la última escritura. Sin IndexedDB, el trabajo vive por pestaña y no hay coordinación entre pestañas.
*   **RNF-02: Rendimiento y Despliegue:** Aplicación ligera construida con Vite, optimizada para despliegue instantáneo en el tier gratuito de Vercel.
*   **RNF-03: Estilos de Impresión y Marca de Agua:** Uso de Tailwind CSS con utilidades específicas de impresión (`@media print`) y posicionamiento absoluto para el escudo con opacidad reducida (`opacity-10`) que garantiza legibilidad sin obstruir el contenido textual.

---

## 4. Arquitectura de Componentes (React)

```text
src/
├── components/
│   ├── SetupModal.jsx          # Configuración inicial de escala y escudo PNG
│   ├── ManagementMenu.jsx       # Menú de gestión: nuevo trabajo, período actual, desempeños y respaldo
│   ├── PeriodEditor.jsx         # Editor compartido para crear o editar un período completo
│   ├── PerformanceMatrixImport.jsx # Matriz local al borrador del período o del informe final
│   ├── FinalEditor.jsx          # Edición de anotaciones finales y matriz del informe final
│   ├── ReportDashboard.jsx      # Vista de solo lectura del período o del informe final
│   └── ExportToolbar.jsx       # Panel de acciones (Imprimir, Descargar PDF individual, Generar ZIP)
├── utils/
│   ├── parser.js               # Lectura SheetJS y generador de estructura de datos manual
│   └── exporter.js             # Lógica de impresión, html2canvas/jsPDF y empaquetado JSZip
└── App.jsx                     # Orquestador principal: hidratación desde IndexedDB y estado de vista por pestaña