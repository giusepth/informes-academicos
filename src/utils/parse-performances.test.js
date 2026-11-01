import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildStudentPerformancesWorkbook, parsePerformancesWorkbook } from './parser'

const workbookBytes = (aoa) => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Desempeños')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

describe('parsePerformancesWorkbook', () => {
  it('reads Estudiante | Asignatura | Desempeño and keys by normalized name', async () => {
    const bytes = workbookBytes([
      ['Estudiante', 'Asignatura', 'Desempeño'],
      ['Ana Gómez', 'Matemáticas', '  Resuelve con autonomía.  '],
      ['Ana Gómez', 'Lengua', 'Produce textos claros.'],
      ['Luis Pérez', 'Matemáticas', 'Requiere acompañamiento.'],
    ])
    await expect(parsePerformancesWorkbook(bytes)).resolves.toEqual({
      'ANA GÓMEZ': {
        'Matemáticas': 'Resuelve con autonomía.',
        'Lengua': 'Produce textos claros.',
      },
      'LUIS PÉREZ': { 'Matemáticas': 'Requiere acompañamiento.' },
    })
  })

  it('accepts unaccented headers and skips empty rows', async () => {
    const bytes = workbookBytes([
      ['estudiante', 'materia', 'desempeno'],
      ['Ana Gómez', 'Matemáticas', 'Texto.'],
      ['', '', ''],
      ['Ana Gómez', 'Lengua', ''],
    ])
    await expect(parsePerformancesWorkbook(bytes)).resolves.toEqual({
      'ANA GÓMEZ': { 'Matemáticas': 'Texto.' },
    })
  })

  it('throws a descriptive error when the sheet lacks the expected columns', async () => {
    const bytes = workbookBytes([['Nombre', 'Curso'], ['Ana', '5A']])
    await expect(parsePerformancesWorkbook(bytes)).rejects.toThrow(/Estudiante, Asignatura y Desempeño/)
  })
})

describe('buildStudentPerformancesWorkbook', () => {
  it('builds the per-student template with empty texts and a guide sheet', async () => {
    const { workbook, fileName } = await buildStudentPerformancesWorkbook()
    expect(fileName).toBe('plantilla-desempenos-estudiantes.xlsx')
    expect(workbook.SheetNames).toEqual(['Desempeños', 'Instrucciones'])
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Desempeños'], { header: 1, defval: '' })
    expect(rows[0]).toEqual(['Estudiante', 'Asignatura', 'Desempeño'])
    // Loading the template unedited must be a no-op: no texts to apply.
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    await expect(parsePerformancesWorkbook(bytes)).resolves.toEqual({})
  })
})
