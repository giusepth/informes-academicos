// Oversized workbook generator for pagination/e2e verification: many subjects
// and very long desempeños drive the report sheet past one A4 page.
// Usage: node samples/make-oversized-workbook.cjs <outDir>
const path = require('path')
const XLSX = require(path.resolve(__dirname, '..', 'node_modules', 'xlsx'))

const SUBJECT_COUNT = 16
const TEXT = 'El estudiante demuestra una comprensión sólida, participa con '
  + 'constancia en clase y sostiene el criterio a lo largo del periodo. '
  + 'Se recomienda continuar profundizando la lectura y los ejercicios de '
  + 'aplicación diaria para consolidar el avance. '.repeat(3)

const subjects = Array.from(
  { length: SUBJECT_COUNT },
  (_, i) => `Asignatura ${i + 1}`,
)
const header = [
  'Estudiante',
  'Grado',
  'Docente',
  ...subjects.flatMap((subject) => [subject, `Docente (${subject})`]),
]

// 3 students; row 1 carries the desempeños? Not supported yet by the parser:
// notas only. Length comes from the 16 subject rows in the editable view.
const rows = [
  ['Ana Gómez', '5° A', 'Prof. Rivera', ...subjects.flatMap(() => [4.5, 'Prof. Torres'])],
  ['Luis Pérez', '5° A', 'Prof. Rivera', ...subjects.flatMap(() => [3.5, 'Prof. Torres'])],
  ['Carla Ruiz', '5° A', 'Prof. Rivera', ...subjects.flatMap(() => [2.92, 'Prof. Torres'])],
]

const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, sheet, 'Informe')
XLSX.writeFile(workbook, path.join(process.argv[2] || '.', 'informe-oversized.xlsx'))
console.log('OK informe-oversized.xlsx')
