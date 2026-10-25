/**
 * Tabular spreadsheet parser (SheetJS).
 *
 * Expected layout (row 1 = headers):
 *   Estudiante | Grado | Docente | <Asignatura 1> | <Asignatura 2> | ...
 *
 * Grado and Docente are optional; every other non-empty header is treated as a
 * subject, so the number of subjects N is discovered dynamically.
 *
 * Per-subject docents use the optional convention `Docente (Asignatura)`,
 * e.g. `Docente (Matemáticas)`. Their value is read from the first data row and
 * reported as `teachers[subject]`, parallel to the course-wide `Docente`.
 * Per-subject desempeños use the same convention: `Desempeño (Asignatura)`
 * (unaccented `Desempeno (Asignatura)` accepted); they are read row by row.
 *
 * Backup workflow (`informes-backup-*.xlsx`): one sheet per period, each sheet
 * with the exact import layout above. `parseBackupWorkbook` restores the whole
 * multi-period session; `backupSheets` builds the sheets from report objects,
 * so manual-entry sessions can round-trip Windows to Linux and across days.
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
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
 * Parses one worksheet into a raw report object (no ids, no label — the
 * caller decides persistence identity). Performance texts are restored row
 * by row when `Desempeño (Asignatura)` columns exist.
 */
function parseSheetRaw(XLSX, sheet) {
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

  // Per-subject docent and desempeño columns are metadata, not subjects.
  // They must be reserved BEFORE discovering the subject columns or they
  // would leak in as empty-score subjects. Detection runs over the ACCENT-
  // STRIPPED header so `Desempeño (X)`, `Desempeno (X)` and any casing work.
  const subjectMetadataCols = header
    .map((label, index) => ({ label: String(label ?? '').trim(), index, normalized: normalizeHeader(label) }))
    .filter(({ normalized }) => /^(docente|profesor|profesora)\s*\(/.test(normalized) || /^desempeno\s*\(/.test(normalized))
    .map(({ label, index, normalized }) => ({
      index,
      kind: /^desempeno/.test(normalized) ? 'performance' : 'teacher',
      subject: label.match(/\((.+)\)\s*$/)?.[1]?.trim() ?? '',
    }))

  const reserved = new Set(
    [studentCol, gradeCol, teacherCol, ...subjectMetadataCols.map((c) => c.index)].filter(
      (i) => i !== -1,
    ),
  )
  const subjectCols = header
    .map((label, index) => ({ label: String(label ?? '').trim(), index }))
    .filter(({ index, label }) => label && !reserved.has(index))

  if (subjectCols.length === 0) {
    throw new Error('No se detectó ninguna asignatura (columnas después de Estudiante/Grado/Docente).')
  }

  const subjects = subjectCols.map((c) => c.label)
  const dataRows = rows.slice(1)

  // Docent metadata follows the template convention: on the FIRST data row.
  const teachers = {}
  subjectMetadataCols
    .filter((c) => c.kind === 'teacher')
    .forEach(({ index, subject }) => {
      const value = String(dataRows[0]?.[index] ?? '').trim()
      if (value) teachers[subject] = value
    })

  const performanceCols = subjectMetadataCols.filter((c) => c.kind === 'performance')

  const students = dataRows
    .filter((row) => String(row[studentCol] ?? '').trim() !== '')
    .map((row) => {
      const scores = {}
      subjectCols.forEach(({ label, index }) => {
        scores[label] = parseScore(row[index])
      })
      const performances = Object.fromEntries(subjects.map((s) => [s, '']))
      performanceCols.forEach(({ index, subject }) => {
        performances[subject] = String(row[index] ?? '').trim()
      })
      return {
        name: String(row[studentCol]).trim(),
        scores,
        performances,
      }
    })

  if (students.length === 0) {
    throw new Error('No se encontraron filas de estudiantes con nombre.')
  }

  return {
    grade: gradeCol !== -1 ? String(dataRows[0]?.[gradeCol] ?? '').trim() : '',
    teacher: teacherCol !== -1 ? String(dataRows[0]?.[teacherCol] ?? '').trim() : '',
    subjects,
    teachers,
    students,
  }
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

  const report = parseSheetRaw(XLSX, workbook.Sheets[firstSheetName])
  return {
    id: makeId(),
    ...report,
    // Student ids are app-level identity: regenerated per import so shared
    // ids can never leak edits across periods (see PeriodBar duplication).
    students: report.students.map((student) => ({ ...student, id: makeId() })),
  }
}

/**
 * Reads a backup workbook (.xlsx) that may contain one REPORT sheet per
 * period and restores the whole multi-period session as raw report objects.
 *
 * A sheet qualifies as a report sheet when its header contains the
 * Estudiante column (checked per sheet, so unrelated sheets are ignored).
 * Throws a descriptive Error when no sheet qualifies.
 */
export async function parseBackupWorkbook(arrayBuffer) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const reports = []
  for (const name of workbook.SheetNames) {
    try {
      const report = parseSheetRaw(XLSX, workbook.Sheets[name])
      reports.push({
        label: /^informe/i.test(name) ? name : `Informe ${reports.length + 1}`,
        ...report,
      })
    } catch {
      // Not a report sheet: skipped. A stray sheet inside the workbook does
      // not invalidate the backup.
    }
  }
  if (reports.length === 0) {
    throw new Error('El archivo no contiene hojas de informe (con columna Estudiante y asignaturas).')
  }
  return reports
}

/**
 * Builds the sheet payloads ({ name, aoa }) for a backup workbook: one sheet
 * per report with the exact import layout. Pure so it can be unit-tested and
 * reused by both the download helper and in-memory round-trip tests.
 */
export function backupSheets(reports) {
  return (reports ?? []).map((report, index) => {
    const subjects = report.subjects ?? []
    const header = [
      'Estudiante',
      'Grado',
      'Docente',
      ...subjects.flatMap((subject) => [
        subject,
        `Docente (${subject})`,
        `Desempeño (${subject})`,
      ]),
    ]

    const rows = (report.students ?? []).map((student, rowIndex) => {
      const row = [String(student.name ?? '').trim()]
      subjects.forEach((subject) => {
        row.push(student.scores?.[subject] ?? '')
        // Template convention: metadata lives on the first data row only.
        row.push(rowIndex === 0 ? (report.teachers?.[subject] ?? '') : '')
        const text = String(student.performances?.[subject] ?? '')
        row.push(text)
      })
      return row
    })

    if (rows.length > 0) {
      rows[0] = [
        rows[0][0],
        report.grade ?? '',
        report.teacher ?? '',
        ...rows[0].slice(1),
      ]
    }

    const fallback = `Informe ${index + 1}`
    const label = report.label ?? fallback
    const name = /^informe/i.test(label)
      ? label
      : fallback

    return { name, aoa: [header, ...rows] }
  })
}

/**
 * Builds a downloadable .xlsx backup: one sheet per period with its scores,
 * per-subject docents and desempeños. Re-importable with the same restore
 * flow used for a fresh import.
 */
export async function buildBackupWorkbook(reports) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()
  backupSheets(reports).forEach(({ name, aoa }) => {
    // Excel sheet-name cap is 31 chars; Informe N labels are far below it.
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), name.slice(0, 31))
  })
  const day = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `informes-backup-${day}.xlsx`)
}

/**
 * Builds a downloadable .xlsx template matching the expected format, so a
 * teacher can fill it and re-import it.
 */
export async function downloadTemplate() {
  const XLSX = await loadXlsx()
  const subjects = ['Matemáticas', 'Ciencias Naturales', 'Lengua', 'Sociales']
  const header = [
    'Estudiante',
    'Grado',
    'Docente',
    ...subjects.flatMap((subject) => [subject, `Docente (${subject})`]),
  ]
  const sample = [
    ['Ana Gómez', '5° A', 'Prof. Rivera', 4.5, 'Prof. Torres', 3.8, 'Prof. Torres', 4.2, 'Prof. Suárez', 3.0, 'Prof. Suárez'],
    ['Luis Pérez', '5° A', 'Prof. Rivera', 3.2, 'Prof. Torres', 2.9, 'Prof. Torres', 3.5, 'Prof. Suárez', 4.0, 'Prof. Suárez'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet([header, ...sample])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Informe')
  XLSX.writeFile(workbook, 'plantilla-informe.xlsx')
}
