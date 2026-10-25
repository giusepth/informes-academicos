import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { DEFAULT_SCALE } from './calculations'
import { fillPerformances, parsePerformanceMatrix } from './parser'

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
})
