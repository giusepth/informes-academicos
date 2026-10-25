import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { DEFAULT_SCALE } from './calculations'
import {
  buildPerformanceMatrixWorkbook,
  countMatrixFills,
  matrixHasText,
  parsePerformanceMatrix,
} from './parser'

/**
 * Downloadable desempeño artifacts (issue #23): a template the teacher fills
 * in and a ready-to-use sample. Both must be real matrix workbooks that the
 * existing parser accepts without changes.
 */

const HEADER = ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior']
const SAMPLE_SUBJECTS = ['Matemáticas', 'Ciencias Naturales', 'Lengua', 'Sociales']

const toArray = (workbook) => XLSX.write(workbook, { type: 'array' })

function sheetRows(workbook, name) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' })
}

describe('buildPerformanceMatrixWorkbook — template', () => {
  it('builds the template with the matrix header, subject rows and empty band cells', async () => {
    const { workbook, fileName } = await buildPerformanceMatrixWorkbook()
    expect(fileName).toBe('plantilla-desempenos.xlsx')

    const rows = sheetRows(workbook, 'Desempeños')
    expect(rows[0]).toEqual(HEADER)
    expect(rows.slice(1).map((row) => row[0])).toEqual(['Matemáticas', 'Lengua'])

    // Data cells stay EMPTY: guidance text never lives in a band cell.
    const bandTexts = rows.slice(1).flatMap((row) => row.slice(1, 5))
    expect(bandTexts.length).toBeGreaterThan(0)
    for (const text of bandTexts) expect(String(text).trim()).toBe('')
  })

  it('ships the usage guide on a second Instrucciones sheet that is never parsed', async () => {
    const { workbook } = await buildPerformanceMatrixWorkbook()
    expect(workbook.SheetNames).toEqual(['Desempeños', 'Instrucciones'])

    const guide = sheetRows(workbook, 'Instrucciones')
      .flat()
      .join(' ')
    expect(guide).toMatch(/columnas/i)
    expect(guide).toMatch(/casilleros de desempeño vacíos/i)
    expect(guide).toMatch(/ejemplo/i)
    expect(guide).toMatch(/archivo de ejemplo/i)
  })

  it('parses as a matrix with empty texts and applies nothing', async () => {
    const { workbook } = await buildPerformanceMatrixWorkbook()
    const matrix = await parsePerformanceMatrix(toArray(workbook))

    expect(Object.keys(matrix)).toEqual(['Matemáticas', 'Lengua'])
    for (const bands of Object.values(matrix)) {
      expect(Object.keys(bands)).toEqual(['Bajo', 'Básico', 'Alto', 'Superior'])
      for (const text of Object.values(bands)) expect(text).toBe('')
    }

    const report = {
      subjects: ['Matemáticas', 'Lengua'],
      students: [
        {
          id: 's1',
          name: 'Ana',
          scores: { 'Matemáticas': 4.5, 'Lengua': 3.0 },
          performances: { 'Matemáticas': '', 'Lengua': '' },
        },
      ],
    }
    expect(countMatrixFills(report, matrix, DEFAULT_SCALE, 'decimal')).toBe(0)
  })

  it('parses as textless, so the unedited template never arms a pending matrix', async () => {
    const { workbook } = await buildPerformanceMatrixWorkbook()
    const matrix = await parsePerformanceMatrix(toArray(workbook))
    expect(matrixHasText(matrix)).toBe(false)
  })
})

describe('buildPerformanceMatrixWorkbook — sample', () => {
  it('builds the ready-to-use sample with four real subjects', async () => {
    const { workbook, fileName } = await buildPerformanceMatrixWorkbook({ sample: true })
    expect(fileName).toBe('ejemplo-desempenos.xlsx')

    const rows = sheetRows(workbook, 'Desempeños')
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
