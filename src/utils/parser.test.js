import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  assertImportSize,
  backupSheets,
  FINAL_SHEET_NAME,
  parseBackupWorkbook,
} from './parser'

/**
 * Round-trip coverage for the Excel backup feature (RNF-01 companion):
 * whatever a teacher entered by hand must survive into a downloaded
 * .xlsx and be restored later, period by period.
 */

const MK_ID = (n) => `s_${n}`

function buildReport(n) {
  return {
    id: MK_ID(n),
    label: `Informe ${n}`,
    grade: '5° A',
    teacher: 'Prof. Rivera',
    subjects: ['Matemáticas', 'Ciencias'],
    teachers: { 'Matemáticas': 'Prof. Torres', 'Ciencias': 'Prof. Suárez' },
    students: [
      {
        id: MK_ID(`a${n}`),
        name: 'Ana Gómez',
        scores: { 'Matemáticas': 4.5, 'Ciencias': 4.2 },
        performances: { 'Matemáticas': `Excelente P${n}`, 'Ciencias': 'Muy bue análisis' },
      },
      {
        id: MK_ID(`b${n}`),
        name: 'Luis Pérez',
        scores: { 'Matemáticas': 3.2, 'Ciencias': null },
        performances: { 'Matemáticas': '', 'Ciencias': `Aún en proceso P${n}` },
      },
    ],
  }
}

function workbookBytes(sheets) {
  const workbook = XLSX.utils.book_new()
  sheets.forEach(({ name, aoa }) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), name)
  })
  return XLSX.write(workbook, { type: 'array' })
}

describe('backupSheets', () => {
  it('creates one sheet per report with score, docent and desempeño columns', () => {
    const sheets = backupSheets([buildReport(1)])
    expect(sheets).toHaveLength(1)
    expect(sheets[0].name).toBe('Informe 1')

    const header = sheets[0].aoa[0]
    expect(header).toEqual([
      'Estudiante',
      'Grado',
      'Docente',
      'Matemáticas',
      'Docente (Matemáticas)',
      'Desempeño (Matemáticas)',
      'Ciencias',
      'Docente (Ciencias)',
      'Desempeño (Ciencias)',
    ])

    // Row 0 carries the report-level metadata under the template convention.
    const firstRow = sheets[0].aoa[1]
    expect(firstRow[0]).toBe('Ana Gómez')
    expect(firstRow[1]).toBe('5° A')
    expect(firstRow[2]).toBe('Prof. Rivera')
    expect(firstRow[3]).toBe(4.5)
    expect(firstRow[4]).toBe('Prof. Torres')
    expect(firstRow[5]).toBe('Excelente P1')
    expect(firstRow[6]).toBe(4.2)
    expect(firstRow[7]).toBe('Prof. Suárez')
    expect(firstRow[8]).toBe('Muy bue análisis')

    // Luis row (second data row): same columns, metadata blank.
    expect(sheets[0].aoa[2][0]).toBe('Luis Pérez')
    expect(sheets[0].aoa[2][1]).toBe('') // Grado blank, but column present
    expect(sheets[0].aoa[2][2]).toBe('')
    expect(sheets[0].aoa[2][3]).toBe(3.2) // Matemáticas
    expect(sheets[0].aoa[2][4]).toBe('')
    expect(sheets[0].aoa[2][5]).toBe('')
    expect(sheets[0].aoa[2][6]).toBe('') // Ciencias ausente
    expect(sheets[0].aoa[2][8]).toBe('Aún en proceso P1')
  })

  it('adds a final desempeños sheet with normalized names when annotations exist', () => {
    const sheets = backupSheets([buildReport(1)], {
      'ana gómez': { 'Matemáticas': 'Cierre de año', 'Ciencias': '' },
      'LUIS PÉREZ': { 'Matemáticas': '   ' },
    })

    expect(sheets).toHaveLength(2)
    expect(sheets[1].name).toBe(FINAL_SHEET_NAME)
    expect(sheets[1].aoa).toEqual([
      ['Estudiante', 'Asignatura', 'Desempeño'],
      ['ANA GÓMEZ', 'Matemáticas', 'Cierre de año'],
    ])
  })

  it('omits the final sheet when every annotation is empty', () => {
    expect(backupSheets([buildReport(1)], { ANA: { 'Matemáticas': '' } })).toHaveLength(1)
    expect(backupSheets([buildReport(1)])).toHaveLength(1)
  })
})

describe('parseBackupWorkbook', () => {
  it('restores every report sheet with scores, teachers and desempeños', async () => {
    const bytes = workbookBytes(backupSheets([buildReport(1), buildReport(2)]))
    const { reports, finalPerformances } = await parseBackupWorkbook(bytes)

    expect(reports).toHaveLength(2)
    expect(reports[0].label).toBe('Informe 1')
    expect(reports[1].label).toBe('Informe 2')
    expect(finalPerformances).toEqual({})

    const restored = reports[1]
    expect(restored.grade).toBe('5° A')
    expect(restored.teacher).toBe('Prof. Rivera')
    expect(restored.subjects).toEqual(['Matemáticas', 'Ciencias'])
    expect(restored.teachers).toEqual({ 'Matemáticas': 'Prof. Torres', 'Ciencias': 'Prof. Suárez' })
    expect(restored.students[0].name).toBe('Ana Gómez')
    expect(restored.students[0].scores).toEqual({ 'Matemáticas': 4.5, 'Ciencias': 4.2 })
    expect(restored.students[0].performances).toEqual({
      'Matemáticas': 'Excelente P2',
      'Ciencias': 'Muy bue análisis',
    })
    expect(restored.students[1].scores).toEqual({ 'Matemáticas': 3.2, 'Ciencias': null })
    expect(restored.students[1].performances).toEqual({
      'Matemáticas': '',
      'Ciencias': 'Aún en proceso P2',
    })
  })

  it('round-trips final desempeño annotations without turning them into a period', async () => {
    const bytes = workbookBytes(
      backupSheets([buildReport(1), buildReport(2)], {
        'ana gómez': { 'Matemáticas': 'Cierre del año', 'Ciencias': '' },
        'LUIS PÉREZ': { 'Ciencias': 'Recuperó en el cierre' },
      }),
    )
    const { reports, skipped, finalPerformances } = await parseBackupWorkbook(bytes)

    expect(reports).toHaveLength(2)
    expect(skipped).toEqual([])
    expect(reports[1].students[0].performances).toEqual({
      'Matemáticas': 'Excelente P2',
      'Ciencias': 'Muy bue análisis',
    })
    expect(finalPerformances).toEqual({
      'ANA GÓMEZ': { 'Matemáticas': 'Cierre del año' },
      'LUIS PÉREZ': { 'Ciencias': 'Recuperó en el cierre' },
    })
  })

  it('returns empty finalPerformances when the backup has no final sheet', async () => {
    const bytes = workbookBytes(backupSheets([buildReport(1)]))
    const { finalPerformances } = await parseBackupWorkbook(bytes)
    expect(finalPerformances).toEqual({})
  })

  it('accepts unaccented sheet names and Desempeno aliases', async () => {
    const bytes = workbookBytes([
      {
        name: 'Informe',
        aoa: [
          ['Estudiante', 'Matemáticas', 'Docente (Matemáticas)', 'Desempeno (Matemáticas)'],
          ['Ana Gómez', 4.5, 'Prof. Torres', 'OK'],
        ],
      },
    ])
    const { reports } = await parseBackupWorkbook(bytes)
    expect(reports).toHaveLength(1)
    expect(reports[0].students[0].scores['Matemáticas']).toBe(4.5)
    expect(reports[0].students[0].performances['Matemáticas']).toBe('OK')
    const { skipped } = await parseBackupWorkbook(bytes)
    expect(skipped).toEqual([]) // clean backup reports no omissions
  })

  it('reports the sheet names it had to skip', async () => {
    const bytes = workbookBytes([
      { name: 'Informe 1', aoa: [['Estudiante', 'Mate'], ['Ana', 4]] },
      { name: 'Draft borrador', aoa: [['X'], [1]] },
    ])
    const { reports, skipped } = await parseBackupWorkbook(bytes)
    expect(reports).toHaveLength(1)
    expect(skipped).toEqual(['Draft borrador'])
  })

  it('throws a descriptive error when no sheet is a report sheet', async () => {
    const bytes = workbookBytes([{ name: 'Notas sueltas', aoa: [['X'], [1]] }])
    await expect(parseBackupWorkbook(bytes)).rejects.toThrow(/no contiene hojas de informe/i)
  })
})

describe('assertImportSize', () => {
  it('accepts files up to the 10 MB cap', () => {
    expect(() => assertImportSize({ name: 'x.xlsx', size: 10 * 1024 * 1024 })).not.toThrow()
  })

  it('rejects oversized files with a descriptive message', () => {
    expect(() => assertImportSize({ name: 'pesado.xlsx', size: 11 * 1024 * 1024 + 1 })).toThrow(
      /supera el límite de 10 MB/,
    )
    expect(() => assertImportSize({ name: 'pesado.xlsx', size: 11 * 1024 * 1024 + 1 })).toThrow(
      /Divídelo por periodo o pídelo más liviano/,
    )
    expect(() => assertImportSize(null)).not.toThrow()
  })
})
