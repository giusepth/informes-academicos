/**
 * Tabular spreadsheet parser (SheetJS).
 *
 * Expected layout (row 1 = headers):
 *   Estudiante | Grado | Docente | <Asignatura 1> | <Asignatura 2> | ...
 *
 * Grado and Docente are optional; every other non-empty header is treated as a
 * subject, so the number of subjects N is discovered dynamically.
 *
 * SheetJS is heavy, so it is loaded on demand (dynamic import) only when the
 * user actually imports or exports a spreadsheet.
 */

let xlsxModule
function loadXlsx() {
  xlsxModule ??= import('xlsx')
  return xlsxModule
}

const STUDENT_ALIASES = ['estudiante', 'nombre', 'nombres', 'alumno', 'alumna']
const GRADE_ALIASES = ['grado', 'curso', 'aula']
const TEACHER_ALIASES = ['docente', 'profesor', 'profesora', 'docente titular']

/** Generates a stable id without external dependencies. */
export function makeId() {
  return `s_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase()
}

function findColumn(header, aliases) {
  return header.findIndex((h) => aliases.includes(normalizeHeader(h)))
}

/** Parses a cell into a number in [0, 5], or null when it is not numeric. */
function parseScore(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const normalized = String(raw).trim().replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

/**
 * Reads an .xlsx/.xls file and returns a normalized report structure.
 * Throws a descriptive Error when the sheet cannot be interpreted.
 */
export async function parseWorkbook(arrayBuffer) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('El archivo no contiene hojas.')

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  })
  if (rows.length < 2) {
    throw new Error('La hoja debe tener una fila de encabezados y al menos un estudiante.')
  }

  const header = rows[0]
  const studentCol = findColumn(header, STUDENT_ALIASES)
  const gradeCol = findColumn(header, GRADE_ALIASES)
  const teacherCol = findColumn(header, TEACHER_ALIASES)

  if (studentCol === -1) {
    throw new Error('No se encontró la columna "Estudiante".')
  }

  const reserved = new Set([studentCol, gradeCol, teacherCol].filter((i) => i !== -1))
  const subjectCols = header
    .map((label, index) => ({ label: String(label ?? '').trim(), index }))
    .filter(({ index, label }) => label && !reserved.has(index))

  if (subjectCols.length === 0) {
    throw new Error('No se detectó ninguna asignatura (columnas después de Estudiante/Grado/Docente).')
  }

  const subjects = subjectCols.map((c) => c.label)

  const dataRows = rows.slice(1)
  const students = dataRows
    .filter((row) => String(row[studentCol] ?? '').trim() !== '')
    .map((row) => {
      const scores = {}
      subjectCols.forEach(({ label, index }) => {
        scores[label] = parseScore(row[index])
      })
      return {
        id: makeId(),
        name: String(row[studentCol]).trim(),
        scores,
        performances: Object.fromEntries(subjects.map((s) => [s, ''])),
      }
    })

  if (students.length === 0) {
    throw new Error('No se encontraron filas de estudiantes con nombre.')
  }

  return {
    grade: gradeCol !== -1 ? String(dataRows[0]?.[gradeCol] ?? '').trim() : '',
    teacher: teacherCol !== -1 ? String(dataRows[0]?.[teacherCol] ?? '').trim() : '',
    subjects,
    students,
  }
}

/**
 * Builds a downloadable .xlsx template matching the expected format, so a
 * teacher can fill it and re-import it.
 */
export async function downloadTemplate() {
  const XLSX = await loadXlsx()
  const subjects = ['Matemáticas', 'Ciencias Naturales', 'Lengua', 'Sociales']
  const header = ['Estudiante', 'Grado', 'Docente', ...subjects]
  const sample = [
    ['Ana Gómez', '5° A', 'Prof. Rivera', 4.5, 3.8, 4.2, 3.0],
    ['Luis Pérez', '5° A', 'Prof. Rivera', 3.2, 2.9, 3.5, 4.0],
  ]
  const sheet = XLSX.utils.aoa_to_sheet([header, ...sample])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Informe')
  XLSX.writeFile(workbook, 'plantilla-informe.xlsx')
}
