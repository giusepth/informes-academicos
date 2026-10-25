import { roundForScale } from './calculations'

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

/** Sheet name reserved for final-report desempeño annotations in a backup. */
export const FINAL_SHEET_NAME = 'Final (desempeños)'

const FINAL_SUBJECT_ALIASES = ['asignatura', 'materia', 'area']
const FINAL_TEXT_ALIASES = ['desempeno', 'texto', 'anotacion']

/**
 * Identity rule for final-report annotations: the app matches them by the
 * student's display name, trimmed and uppercased (RF-05). Backup export and
 * restore use this same key so the round trip never invents a second spelling.
 */
export function finalPerformanceKey(name) {
  return String(name ?? '').trim().toUpperCase()
}

function isFinalSheetName(name) {
  return normalizeHeader(name) === normalizeHeader(FINAL_SHEET_NAME)
}

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
 * Descriptive performance matrix (carga de desempeños).
 *
 * Expected first sheet layout (row 1 = headers):
 *   Asignatura | Bajo | Básico | Alto | Superior
 *
 * Each data row carries, per subject, the text to pre-load for students whose
 * rounded score falls in that band. Applying the matrix NEVER overwrites a
 * teacher-written judgment: only empty desempeño cells get filled.
 */

const MATRIX_SUBJECT_ALIASES = ['asignatura', 'materia', 'area', 'área']
const BAND_ALIASES = { 'bajo': 'Bajo', 'basico': 'Básico', 'alto': 'Alto', 'superior': 'Superior' }

/**
 * Reads a performance-matrix workbook and returns
 * { [subject]: { Bajo: text, 'Básico': text, Alto: text, Superior: text } }.
 * Columns may come in any order, casing or accent style; rows without a
 * subject name are skipped. Throws when no sheet qualifies or a band column
 * is missing.
 */
export async function parsePerformanceMatrix(arrayBuffer) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      blankrows: true,
      defval: '',
    })
    if (rows.length < 2) continue

    const header = rows[0]
    const subjectIndex = header.findIndex((h) => MATRIX_SUBJECT_ALIASES.includes(normalizeHeader(h)))
    if (subjectIndex === -1) continue

    const bandColumns = {}
    header.forEach((h, index) => {
      const alias = BAND_ALIASES[normalizeHeader(h)]
      if (alias && bandColumns[alias] === undefined) bandColumns[alias] = index
    })

    const missing = Object.values(BAND_ALIASES).filter((label) => bandColumns[label] === undefined)
    if (missing.length > 0) {
      throw new Error(`A la matriz le faltan columnas de banda: ${missing.join(', ')}.`)
    }

    const matrix = {}
    for (const row of rows.slice(1)) {
      const subject = String(row[subjectIndex] ?? '').trim()
      if (!subject) continue
      matrix[subject] = Object.fromEntries(
        Object.entries(bandColumns).map(([label, index]) => [label, String(row[index] ?? '').trim()]),
      )
    }
    return matrix
  }
  throw new Error('No se detectó una hoja de matriz (columna "Asignatura" + bandas Bajo/Básico/Alto/Superior).')
}

const PERFORMANCE_MATRIX_HEADER = ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior']

/** Placeholder rows shipped in the downloadable template: guidance, not data. */
const PERFORMANCE_TEMPLATE_ROWS = ['Matemáticas', 'Lengua'].map((subject) => [
  subject,
  ...PERFORMANCE_MATRIX_HEADER.slice(1).map(
    (band) => `Describe aquí el desempeño de un estudiante de ${subject} en ${band}.`,
  ),
])

/**
 * Ready-to-use matrix shipped as the sample download. Neutral teacher-register
 * Spanish, one sentence per band, no exclamations; `parsePerformanceMatrix`
 * reads it exactly as a teacher-authored file.
 */
const PERFORMANCE_SAMPLE_MATRIX = {
  'Matemáticas': {
    Bajo: 'Resuelve operaciones básicas con dificultad y necesita acompañamiento constante.',
    Básico: 'Comprende los procedimientos esenciales y resuelve ejercicios con apoyo ocasional.',
    Alto: 'Resuelve problemas con seguridad y aplica los procedimientos de forma autónoma.',
    Superior: 'Resuelve problemas complejos con estrategias propias y explica sus procedimientos.',
  },
  'Ciencias Naturales': {
    Bajo: 'Reconoce algunos conceptos del área y requiere orientación para organizar sus observaciones.',
    Básico: 'Identifica los conceptos principales y describe fenómenos sencillos con apoyo.',
    Alto: 'Relaciona conceptos y explica fenómenos naturales con argumentos claros.',
    Superior: 'Formula explicaciones propias, relaciona conceptos y aplica el método científico con autonomía.',
  },
  'Lengua': {
    Bajo: 'Lee textos cortos con dificultad y requiere apoyo para expresar sus ideas por escrito.',
    Básico: 'Comprende textos sencillos y escribe ideas claras con apoyo ocasional.',
    Alto: 'Comprende y produce textos coherentes, con vocabulario adecuado y buena organización.',
    Superior: 'Produce textos originales y bien estructurados, y argumenta sus ideas con precisión.',
  },
  'Sociales': {
    Bajo: 'Reconoce algunos hechos históricos y necesita ayuda para ubicarlos en el tiempo.',
    Básico: 'Identifica los procesos sociales principales y los describe con apoyo.',
    Alto: 'Relaciona hechos históricos y sociales y explica sus causas y consecuencias.',
    Superior: 'Analiza procesos sociales con criterio propio y establece relaciones complejas entre ellos.',
  },
}

const PERFORMANCE_SAMPLE_ROWS = Object.entries(PERFORMANCE_SAMPLE_MATRIX).map(
  ([subject, bands]) => [subject, ...PERFORMANCE_MATRIX_HEADER.slice(1).map((band) => bands[band])],
)

/**
 * Builds a performance-matrix workbook in memory (no download side effect) so
 * it can be unit-tested and reused by both download wrappers. `sample: false`
 * ships the fill-in template; `sample: true` ships the ready-to-use example.
 * Returns { workbook, fileName }.
 */
export async function buildPerformanceMatrixWorkbook({ sample = false } = {}) {
  const XLSX = await loadXlsx()
  const rows = sample ? PERFORMANCE_SAMPLE_ROWS : PERFORMANCE_TEMPLATE_ROWS
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([PERFORMANCE_MATRIX_HEADER, ...rows]),
    'Desempeños',
  )
  return {
    workbook,
    fileName: sample ? 'ejemplo-desempenos.xlsx' : 'plantilla-desempenos.xlsx',
  }
}

/** Downloads the fill-in matrix template (guidance placeholders). */
export async function downloadPerformanceTemplate() {
  const { workbook, fileName } = await buildPerformanceMatrixWorkbook()
  const XLSX = await loadXlsx()
  XLSX.writeFile(workbook, fileName)
}

/** Downloads a ready-to-use matrix with four subjects and plausible texts. */
export async function downloadPerformanceSample() {
  const { workbook, fileName } = await buildPerformanceMatrixWorkbook({ sample: true })
  const XLSX = await loadXlsx()
  XLSX.writeFile(workbook, fileName)
}

/**
 * Fills ONLY empty desempeño cells: for every student × subject, the rounded
 * institutional score selects the band and the matrix provides the text.
 * `scoresById` maps student.id → { [subject]: score }. Cells that already
 * have text, or where score/band/matrix text are missing, stay untouched.
 * `scaleType` selects the institutional rounding rule (decimal tenth-up or
 * centesimal integer-up) before the band lookup. Defaults to decimal.
 * Returns { [studentId]: performances } for callers to merge into state.
 */
export function fillPerformances(
  students,
  subjects,
  scoresById = {},
  scale = DEFAULT_SCALE,
  matrix = {},
  scaleType = 'decimal',
) {
  const next = {}
  for (const student of students) {
    const performances = { ...(student.performances ?? {}) }
    for (const subject of subjects ?? []) {
      const current = String(performances[subject] ?? '')
      if (current.trim().length > 0) continue

      const score = scoresById[student.id]?.[subject]
      if (score === null || score === undefined) continue

      const rounded = roundForScale(score, scaleType)
      const band = scale.find((b) => rounded >= b.min && rounded <= b.max)
      if (!band) continue

      const text = matrix[subject]?.[band.label]
      if (text) performances[subject] = text
    }
    next[student.id] = performances
  }
  return next
}

/**
 * Applies a matrix to one period report: returns a new student list with ONLY
 * the empty desempeño cells filled. Pure helper shared by the manual matrix
 * import and the pending menu apply flow; the source report is never mutated.
 */
export function applyMatrixToReport(report, matrix, scale = DEFAULT_SCALE, scaleType = 'decimal') {
  const students = report?.students ?? []
  const scoresById = Object.fromEntries(
    students.map((student) => [student.id, student.scores ?? {}]),
  )
  const filled = fillPerformances(
    students,
    report?.subjects ?? [],
    scoresById,
    scale,
    matrix,
    scaleType,
  )
  return students.map((student) => ({ ...student, performances: filled[student.id] }))
}

/**
 * Reads the backup's final sheet (long layout):
 *   Estudiante | Asignatura | Desempeño
 *
 * Returns `{ NOMBRE NORMALIZADO: { Asignatura: texto } }`. Empty rows are
 * ignored: an absent annotation is the same as an empty one.
 */
function parseFinalSheetRaw(XLSX, sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  })
  if (rows.length < 2) {
    throw new Error('La hoja final debe tener encabezados y al menos una anotación.')
  }

  const header = rows[0]
  const studentCol = findColumn(header, STUDENT_ALIASES)
  const subjectCol = findColumn(header, FINAL_SUBJECT_ALIASES)
  const textCol = findColumn(header, FINAL_TEXT_ALIASES)
  if (studentCol === -1 || subjectCol === -1 || textCol === -1) {
    throw new Error('La hoja final necesita las columnas Estudiante, Asignatura y Desempeño.')
  }

  const finalPerformances = {}
  for (const row of rows.slice(1)) {
    const key = finalPerformanceKey(row[studentCol])
    const subject = String(row[subjectCol] ?? '').trim()
    const text = String(row[textCol] ?? '').trim()
    if (!key || !subject || !text) continue
    finalPerformances[key] = { ...finalPerformances[key], [subject]: text }
  }
  return finalPerformances
}

/**
 * Reads a backup workbook (.xlsx) that may contain one REPORT sheet per
 * period and restores the whole multi-period session as raw report objects.
 *
 * A sheet qualifies as a report sheet when its header contains the
 * Estudiante column (checked per sheet, so unrelated sheets are ignored).
 * The reserved 'Final (desempeños)' sheet (long layout: Estudiante |
 * Asignatura | Desempeño) restores the final-report annotations instead of
 * being parsed as a period. Sheets that fail to parse are NOT silently
 * dropped: their names come back in `skipped` so the restore flow can warn
 * the teacher.
 * Throws a descriptive Error when no sheet qualifies.
 */
export async function parseBackupWorkbook(arrayBuffer) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const reports = []
  const skipped = []
  let finalPerformances = {}
  for (const name of workbook.SheetNames) {
    if (isFinalSheetName(name)) {
      try {
        finalPerformances = parseFinalSheetRaw(XLSX, workbook.Sheets[name])
      } catch {
        skipped.push(name)
      }
      continue
    }
    try {
      const report = parseSheetRaw(XLSX, workbook.Sheets[name])
      reports.push({
        label: /^informe/i.test(name) ? name : `Informe ${reports.length + 1}`,
        ...report,
      })
    } catch {
      // Not a report sheet: skipped. A stray sheet inside the workbook does
      // not invalidate the backup — but its name must reach the teacher.
      skipped.push(name)
    }
  }
  if (reports.length === 0) {
    throw new Error('El archivo no contiene hojas de informe (con columna Estudiante y asignaturas).')
  }
  return { reports, skipped, finalPerformances }
}

/** Hard cap before any .xlsx is read: keeps a hostile/oversized file from
    decompressing the tab into an out-of-memory crash (10 MB ≈ 500k cells). */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

export function assertImportSize(file) {
  if (!file || !(file.size > MAX_IMPORT_BYTES)) return
  const mb = (file.size / (1024 * 1024)).toFixed(1)
  throw new Error(`El archivo supera el límite de 10 MB (${mb} MB). Divídelo por periodo o pídelo más liviano.`)
}

/**
 * Builds the sheet payloads ({ name, aoa }) for a backup workbook: one sheet
 * per report with the exact import layout, plus an optional final sheet with
 * the final-report desempeño annotations (long layout, written only when at
 * least one annotation has text). Pure so it can be unit-tested and reused by
 * both the download helper and in-memory round-trip tests.
 */
export function backupSheets(reports, finalPerformances = {}) {
  const sheets = (reports ?? []).map((report, index) => {
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

  const finalRows = []
  for (const [rawName, bySubject] of Object.entries(finalPerformances ?? {})) {
    const key = finalPerformanceKey(rawName)
    if (!key) continue
    for (const [subject, text] of Object.entries(bySubject ?? {})) {
      const value = String(text ?? '').trim()
      if (!subject || !value) continue
      finalRows.push([key, subject, value])
    }
  }
  if (finalRows.length > 0) {
    sheets.push({
      name: FINAL_SHEET_NAME,
      aoa: [['Estudiante', 'Asignatura', 'Desempeño'], ...finalRows],
    })
  }

  return sheets
}

/**
 * Builds a downloadable .xlsx backup: one sheet per period with its scores,
 * per-subject docents and desempeños, plus the final-report annotations.
 * Re-importable with the same restore flow used for a fresh import.
 */
export async function buildBackupWorkbook(reports, finalPerformances = {}) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()
  backupSheets(reports, finalPerformances).forEach(({ name, aoa }) => {
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
