import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { DEFAULT_SCALE } from './calculations'
import {
  applyMatrixToReport,
  countMatrixFills,
  fillPerformances,
  matrixHasText,
  parsePerformanceMatrix,
} from './parser'

/**
 * The descriptive matrix (RF-Nuevo "carga de desempeños"): an Excel sheet
 * of Asignatura × Baja/Básico/Alto/Superior text. Applying it pre-loads
 * ONLY empty desempeño cells: a teacher who already wrote a judgment keeps
 * it (authoritative per-institution rule).
 */

function matrixBytes(aoa) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Desempeños')
  return XLSX.write(wb, { type: 'array' })
}

const MATRIX_AOA = [
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Matemáticas', 'Refuerza operaciones básicas.', 'Alcanza lo esencial.', null],
  [],
  ['Ciencias', 'Apoyos conceptuales.', 'Progreso correcto.', 'Excelente manejo.', 'DOMINIO destacado.'],
]

describe('parsePerformanceMatrix', () => {
  it('parses asignatura rows and band texts', async () => {
    const matrix = await parsePerformanceMatrix(matrixBytes(MATRIX_AOA))
    expect(matrix['Matemáticas'].Bajo).toBe('Refuerza operaciones básicas.')
    expect(matrix['Matemáticas'].Básico).toBe('Alcanza lo esencial.') // null cell skipped
    expect(matrix['Ciencias'].Superior).toBe('DOMINIO destacado.')
    expect(Object.keys(matrix)).toEqual(['Matemáticas', 'Ciencias'])
  })

  it('tolerates column order, casing and accents in the band header', async () => {
    const matrix = await parsePerformanceMatrix(
      matrixBytes([
        ['Materia', 'SUPERIOR', 'Alto', 'Basico', 'bajo'],
        ['Matemáticas', 'S', 'A', 'B', 'BJ'],
      ]),
    )
    expect(matrix['Matemáticas']).toEqual({ Bajo: 'BJ', 'Básico': 'B', Alto: 'A', Superior: 'S' })
  })

  it('throws when the sheet does not look like a matrix', async () => {
    await expect(
      parsePerformanceMatrix(matrixBytes([['Estudiante', 'Nota'], ['Ana', 4]])),
    ).rejects.toThrow(/matriz/i)
  })

  it('throws when a band column is missing', async () => {
    await expect(
      parsePerformanceMatrix(matrixBytes([
        ['Asignatura', 'Bajo', 'Alto'],
        ['Matemáticas', 'a', 'b'],
      ])),
    ).rejects.toThrow(/columna/i)
  })

  it('skips a sheet named Instrucciones and uses the first real matrix sheet', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
        ['NO USAR', 'x', 'x', 'x', 'x'],
      ]),
      'Instrucciones',
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
        ['Matemáticas', 'b', 'bs', 'a', 's'],
      ]),
      'Desempeños',
    )

    const matrix = await parsePerformanceMatrix(XLSX.write(workbook, { type: 'array' }))
    expect(matrix['NO USAR']).toBeUndefined()
    expect(matrix['Matemáticas'].Alto).toBe('a')
  })
})

describe('matrixHasText', () => {
  it('rejects a matrix whose band texts are all empty', () => {
    expect(
      matrixHasText({
        'Matemáticas': { Bajo: '', 'Básico': '  ', Alto: '', Superior: '' },
      }),
    ).toBe(false)
  })

  it('accepts a matrix with at least one band text', () => {
    expect(
      matrixHasText({
        'Matemáticas': { Bajo: '', 'Básico': '', Alto: 'Texto de Alto', Superior: '' },
      }),
    ).toBe(true)
  })

  it('reports an empty matrix object as textless', () => {
    expect(matrixHasText({})).toBe(false)
  })
})

describe('fillPerformances', () => {
  const matrix = {
    'Matemáticas': {
      Bajo: 'max-BAJO', 'Básico': 'max-BASICO', Alto: 'max-ALTO', Superior: 'max-SUP',
    },
  }

  it('pre-loads every empty desempeño following the rounded-score band', () => {
    const students = [
      { id: 's1', name: 'Ana', performances: { 'Matemáticas': '', 'Ciencias': '' } },
      { id: 's2', name: 'Luis', performances: { 'Matemáticas': '', 'Ciencias': '' } },
    ]
    const next = fillPerformances(
      students,
      ['Matemáticas'],
      { s1: { 'Matemáticas': 4.6 }, s2: { 'Matemáticas': 2.92 } },
      DEFAULT_SCALE,
      matrix,
    )
    expect(next.s1['Matemáticas']).toBe('max-SUP')
    expect(next.s2['Matemáticas']).toBe('max-BASICO') // 2.92 rounds up to 3.0 → Básico
  })

  it('never overwrites a teacher-written judgment', () => {
    const students = [{ id: 's1', name: 'Ana', performances: { 'Matemáticas': 'Mi texto' } }]
    const next = fillPerformances(
      students,
      ['Matemáticas'],
      { s1: { 'Matemáticas': 5 } },
      DEFAULT_SCALE,
      matrix,
    )
    expect(next.s1['Matemáticas']).toBe('Mi texto')
  })

  it('leaves cells alone when score, subject or band text are absent', () => {
    const students = [
      { id: 's1', name: 'Ana', performances: { 'Matemáticas': '', 'Física': '' } },
      { id: 's2', name: 'Luis', performances: { 'Matemáticas': '' } },
    ]
    const next = fillPerformances(
      students,
      ['Matemáticas', 'Física'],
      { s1: { 'Matemáticas': null, 'Física': 4.0 }, s2: { 'Matemáticas': 4.6 } },
      DEFAULT_SCALE,
      matrix,
    )
    expect(next.s1['Matemáticas']).toBe('') // no score → no band
    expect(next.s2['Matemáticas']).toBe('max-SUP')
    expect(next.s1['Física']).toBe('') // no matrix entry for Física
  })

  it('bands centesimal scores with the integer rounding rule (59.3 → 60)', () => {
    // Centesimal bands leave a gap between 1–59 and 60–79: a tenth-based
    // rounding (59.3 → 59.4) would fall OUTSIDE every band and leave the
    // cell empty. The scale's integer rule (59.3 → 60) must apply instead.
    const centesimal = [
      { label: 'Bajo', min: 1, max: 59 },
      { label: 'Básico', min: 60, max: 79 },
      { label: 'Alto', min: 80, max: 89 },
      { label: 'Superior', min: 90, max: 100 },
    ]
    const students = [
      { id: 's1', name: 'Ana', performances: { 'Matemáticas': '' } },
      { id: 's2', name: 'Luis', performances: { 'Matemáticas': '' } },
    ]
    const next = fillPerformances(
      students,
      ['Matemáticas'],
      { s1: { 'Matemáticas': 59.3 }, s2: { 'Matemáticas': 89.3 } },
      centesimal,
      matrix,
      'centesimal',
    )
    expect(next.s1['Matemáticas']).toBe('max-BASICO') // 59.3 → 60
    expect(next.s2['Matemáticas']).toBe('max-SUP') // 89.3 → 90
  })
})

describe('applyMatrixToReport', () => {
  const report = {
    id: 'r1',
    subjects: ['Matemáticas', 'Ciencias'],
    students: [
      {
        id: 's1',
        name: 'Ana',
        scores: { 'Matemáticas': 4.5, 'Ciencias': 2.0 },
        performances: { 'Matemáticas': 'Texto propio', 'Ciencias': '' },
      },
      { id: 's2', name: 'Luis', scores: { 'Matemáticas': 3.2, 'Ciencias': null }, performances: {} },
    ],
  }
  const fullMatrix = {
    'Matemáticas': { Bajo: 'm-bajo', 'Básico': 'm-basico', Alto: 'm-alto', Superior: 'm-sup' },
    'Ciencias': { Bajo: 'c-bajo', 'Básico': 'c-basico', Alto: 'c-alto', Superior: 'c-sup' },
  }

  it('fills only empty cells and returns new student objects', () => {
    const students = applyMatrixToReport(report, fullMatrix, DEFAULT_SCALE, 'decimal')

    expect(students[0].performances).toEqual({
      'Matemáticas': 'Texto propio',
      'Ciencias': 'c-bajo',
    })
    expect(students[1].performances).toEqual({
      'Matemáticas': 'm-basico',
    })
    // The source report is never mutated.
    expect(report.students[0].performances['Ciencias']).toBe('')
    expect(report.students[1].performances).toEqual({})
  })

  it('leaves every cell untouched when the report has no scored students', () => {
    const students = applyMatrixToReport(
      { subjects: ['Matemáticas'], students: [{ id: 's3', name: 'Sin nota', performances: {} }] },
      fullMatrix,
      DEFAULT_SCALE,
      'decimal',
    )
    expect(students).toEqual([{ id: 's3', name: 'Sin nota', performances: {} }])
  })
})

describe('countMatrixFills', () => {
  const matrix = {
    'Matemáticas': { Bajo: 'm-bajo', 'Básico': 'm-basico', Alto: 'm-alto', Superior: 'm-sup' },
  }
  const centesimal = [
    { label: 'Bajo', min: 1, max: 59 },
    { label: 'Básico', min: 60, max: 79 },
    { label: 'Alto', min: 80, max: 89 },
    { label: 'Superior', min: 90, max: 100 },
  ]

  it('returns 0 for a roster with no numeric scores (pending must wait)', () => {
    const report = {
      subjects: ['Matemáticas'],
      students: [
        { id: 's1', name: 'Ana', scores: { 'Matemáticas': null }, performances: { 'Matemáticas': '' } },
        { id: 's2', name: 'Luis', scores: {}, performances: {} },
      ],
    }
    expect(countMatrixFills(report, matrix, DEFAULT_SCALE, 'decimal')).toBe(0)
  })

  it('counts the cells that appear once grades exist', () => {
    const report = {
      subjects: ['Matemáticas'],
      students: [
        { id: 's1', name: 'Ana', scores: { 'Matemáticas': null }, performances: { 'Matemáticas': '' } },
      ],
    }
    expect(countMatrixFills(report, matrix, DEFAULT_SCALE, 'decimal')).toBe(0)

    const scored = {
      ...report,
      students: [{ ...report.students[0], scores: { 'Matemáticas': 4.5 } }],
    }
    expect(countMatrixFills(scored, matrix, DEFAULT_SCALE, 'decimal')).toBe(1)
    const students = applyMatrixToReport(scored, matrix, DEFAULT_SCALE, 'decimal')
    expect(students[0].performances['Matemáticas']).toBe('m-alto')
  })

  it('counts centesimal bands with the integer rounding rule', () => {
    const report = {
      subjects: ['Matemáticas'],
      students: [
        { id: 's1', name: 'Ana', scores: { 'Matemáticas': 85 }, performances: { 'Matemáticas': '' } },
        { id: 's2', name: 'Luis', scores: { 'Matemáticas': 89.3 }, performances: { 'Matemáticas': '' } },
        { id: 's3', name: 'Eva', scores: { 'Matemáticas': 59.3 }, performances: { 'Matemáticas': '' } },
      ],
    }
    expect(countMatrixFills(report, matrix, centesimal, 'centesimal')).toBe(3)

    const students = applyMatrixToReport(report, matrix, centesimal, 'centesimal')
    expect(students[0].performances['Matemáticas']).toBe('m-alto') // 85 → Alto
    expect(students[1].performances['Matemáticas']).toBe('m-sup') // 89.3 → 90
    expect(students[2].performances['Matemáticas']).toBe('m-basico') // 59.3 → 60
  })

  it('never counts a cell that already has teacher-written text', () => {
    const report = {
      subjects: ['Matemáticas'],
      students: [
        {
          id: 's1',
          name: 'Ana',
          scores: { 'Matemáticas': 4.5 },
          performances: { 'Matemáticas': 'Mi texto' },
        },
      ],
    }
    expect(countMatrixFills(report, matrix, DEFAULT_SCALE, 'decimal')).toBe(0)
  })
})
