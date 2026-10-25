// Generates 4 period workbooks (informe-1..4.xlsx) for manual testing of the
// final report flow. Edge cases baked into the data:
//   - Ana misses Matemáticas in Informe 3  -> null-ignoring subject mean
//   - Carla and Elena score identically    -> dense tie positions (1°, 1°, 2°...)
//   - Diego hits 2.92 in one subject       -> RF-04 rounding (3.0 -> Básico)
// Run from the project root: node samples/make-sample-workbooks.cjs ../../../Downloads
const path = require('path')
const XLSX = require(path.resolve(__dirname, '..', 'node_modules', 'xlsx'))

const STUDENTS = ['Ana Gómez', 'Luis Pérez', 'Carla Ruiz', 'Diego Suárez', 'Elena Torres']
const GRADE = '5° A'
const TEACHER = 'Prof. Rivera'
const SUBJECTS = ['Matemáticas', 'Ciencias Naturales', 'Lengua', 'Sociales']
const TEACHERS = {
  'Matemáticas': 'Prof. Torres',
  'Ciencias Naturales': 'Prof. Torres',
  'Lengua': 'Prof. Suárez',
  'Sociales': 'Prof. Suárez',
}

// scores[period][student][subject]; null = cell left empty in the Excel
const SCORES = {
  Ana: {
    1: { 'Matemáticas': 4.5, 'Ciencias Naturales': 4.2, 'Lengua': 4.6, 'Sociales': 4.7 },
    2: { 'Matemáticas': 4.8, 'Ciencias Naturales': 4.4, 'Lengua': 4.5, 'Sociales': 4.9 },
    3: { 'Matemáticas': null, 'Ciencias Naturales': 4.6, 'Lengua': 4.8, 'Sociales': 5.0 }, // absent
    4: { 'Matemáticas': 4.9, 'Ciencias Naturales': 4.5, 'Lengua': 4.4, 'Sociales': 4.8 },
  },
  Luis: {
    1: { 'Matemáticas': 3.2, 'Ciencias Naturales': 3.8, 'Lengua': 3.5, 'Sociales': 3.4 },
    2: { 'Matemáticas': 3.6, 'Ciencias Naturales': 3.9, 'Lengua': 3.7, 'Sociales': 3.8 },
    3: { 'Matemáticas': 3.4, 'Ciencias Naturales': 3.7, 'Lengua': 3.6, 'Sociales': 3.9 },
    4: { 'Matemáticas': 3.8, 'Ciencias Naturales': 4.0, 'Lengua': 3.9, 'Sociales': 4.1 },
  },
  Carla: {
    1: { 'Matemáticas': 4.1, 'Ciencias Naturales': 4.4, 'Lengua': 4.2, 'Sociales': 4.3 },
    2: { 'Matemáticas': 4.3, 'Ciencias Naturales': 4.2, 'Lengua': 4.4, 'Sociales': 4.5 },
    3: { 'Matemáticas': 4.2, 'Ciencias Naturales': 4.6, 'Lengua': 4.3, 'Sociales': 4.4 },
    4: { 'Matemáticas': 4.4, 'Ciencias Naturales': 4.4, 'Lengua': 4.5, 'Sociales': 4.2 },
  },
  Diego: {
    1: { 'Matemáticas': 2.92, 'Ciencias Naturales': 2.4, 'Lengua': 2.9, 'Sociales': 2.6 },
    2: { 'Matemáticas': 2.3, 'Ciencias Naturales': 2.8, 'Lengua': 2.5, 'Sociales': 2.9 },
    3: { 'Matemáticas': 2.1, 'Ciencias Naturales': 2.6, 'Lengua': 2.4, 'Sociales': 2.3 },
    4: { 'Matemáticas': 2.5, 'Ciencias Naturales': 2.2, 'Lengua': 2.7, 'Sociales': 2.4 },
  },
  // Elena mirrors Carla exactly -> same raw mean -> shares her position (dense).
  Elena: {
    1: { 'Matemáticas': 4.1, 'Ciencias Naturales': 4.4, 'Lengua': 4.2, 'Sociales': 4.3 },
    2: { 'Matemáticas': 4.3, 'Ciencias Naturales': 4.2, 'Lengua': 4.4, 'Sociales': 4.5 },
    3: { 'Matemáticas': 4.2, 'Ciencias Naturales': 4.6, 'Lengua': 4.3, 'Sociales': 4.4 },
    4: { 'Matemáticas': 4.4, 'Ciencias Naturales': 4.4, 'Lengua': 4.5, 'Sociales': 4.2 },
  },
}

const outDir = process.argv[2] || '.'

for (const period of [1, 2, 3, 4]) {
  const header = [
    'Estudiante',
    'Grado',
    'Docente',
    ...SUBJECTS.flatMap((subject) => [subject, `Docente (${subject})`]),
  ]

  const rows = STUDENTS.map((student, index) => {
    const key = student.split(' ')[0]
    const scores = SCORES[key][period]
    const cells = SUBJECTS.flatMap((subject) => [
      scores[subject] ?? '', // empty cell = absent data, never a zero
      index === 0 ? TEACHERS[subject] : '', // per-subject docent from the first data row
    ])
    return [student, GRADE, TEACHER, ...cells]
  })

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Informe')
  const fileName = `informe-${period}.xlsx`
  XLSX.writeFile(workbook, path.join(outDir, fileName))
  console.log(`OK ${fileName}`)
}
