import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildPerformanceMatrixWorkbook, parsePerformanceMatrix } from './parser'

/**
 * Downloadable desempeño artifacts (issue #23): a template the teacher fills
 * in and a ready-to-use sample. Both must be real matrix workbooks that the
 * existing parser accepts without changes.
 */

const HEADER = ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior']
const SAMPLE_SUBJECTS = ['Matemáticas', 'Ciencias Naturales', 'Lengua', 'Sociales']

const toArray = (workbook) => XLSX.write(workbook, { type: 'array' })

function firstSheetRows(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
}

describe('buildPerformanceMatrixWorkbook — template', () => {
  it('builds the downloadable template with the matrix header and guidance rows', async () => {
    const { workbook, fileName } = await buildPerformanceMatrixWorkbook()
    expect(fileName).toBe('plantilla-desempenos.xlsx')

    const rows = firstSheetRows(workbook)
    expect(rows[0]).toEqual(HEADER)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows[1][0]).toBe('Matemáticas')

    // Every band cell is a short guidance placeholder, never a real judgment.
    const bandTexts = rows.slice(1).flatMap((row) => row.slice(1, 5))
    expect(bandTexts.length).toBeGreaterThan(0)
    for (const text of bandTexts) {
      expect(String(text).trim().length).toBeGreaterThan(0)
      expect(String(text)).toMatch(/describe|escribe/i)
    }
  })

  it('round-trips through parsePerformanceMatrix unchanged', async () => {
    const { workbook } = await buildPerformanceMatrixWorkbook()
    const matrix = await parsePerformanceMatrix(toArray(workbook))

    expect(Object.keys(matrix)).toEqual(['Matemáticas', 'Lengua'])
    for (const bands of Object.values(matrix)) {
      expect(Object.keys(bands)).toEqual(['Bajo', 'Básico', 'Alto', 'Superior'])
      for (const text of Object.values(bands)) expect(text.length).toBeGreaterThan(0)
    }
  })
})

describe('buildPerformanceMatrixWorkbook — sample', () => {
  it('builds the ready-to-use sample with four real subjects', async () => {
    const { workbook, fileName } = await buildPerformanceMatrixWorkbook({ sample: true })
    expect(fileName).toBe('ejemplo-desempenos.xlsx')

    const rows = firstSheetRows(workbook)
    expect(rows[0]).toEqual(HEADER)
    expect(rows.slice(1).map((row) => row[0])).toEqual(SAMPLE_SUBJECTS)
  })

  it('parses to a complete 4 × 4 matrix with teacher-register texts', async () => {
    const { workbook } = await buildPerformanceMatrixWorkbook({ sample: true })
    const matrix = await parsePerformanceMatrix(toArray(workbook))

    expect(Object.keys(matrix)).toEqual(SAMPLE_SUBJECTS)
    for (const bands of Object.values(matrix)) {
      expect(Object.keys(bands)).toEqual(['Bajo', 'Básico', 'Alto', 'Superior'])
      for (const text of Object.values(bands)) {
        expect(text.length).toBeGreaterThan(20)
        expect(text).not.toMatch(/^describe|^escribe/i)
        expect(text).not.toMatch(/[!¡]/)
      }
    }
    expect(matrix['Matemáticas'].Alto).toContain('problemas')
    expect(matrix['Lengua'].Superior).toContain('textos')
  })

  it('keeps failing when a band column is absent', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Asignatura', 'Bajo', 'Básico', 'Superior'],
        ['Matemáticas', 'a', 'b', 'c'],
      ]),
      'Desempeños',
    )
    await expect(parsePerformanceMatrix(toArray(workbook))).rejects.toThrow(/columna/i)
  })
})
