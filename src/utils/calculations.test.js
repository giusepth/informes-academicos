import { describe, expect, it } from 'vitest'
import {
  buildFinalReport,
  qualitativeFor,
  rankStudents,
  roundUpTenth,
} from './calculations'

describe('rankStudents (RF-05)', () => {
  it('ranks by raw mean descending with dense positions and ties shared', () => {
    const ranked = rankStudents(
      [
        { name: 'A', scores: { M: 4.0 } },
        { name: 'B', scores: { M: 4.0 } },
        { name: 'C', scores: { M: 3.9 } },
        { name: 'D', scores: { M: 3.9 } },
        { name: 'E', scores: { M: 3.0 } },
      ],
    )
    expect(ranked.map((s) => s.position)).toEqual([1, 1, 2, 2, 3])
  })

  it('ignores non-numeric scores for the mean', () => {
    const ranked = rankStudents([{ name: 'A', scores: { M: 4.0, C: null } }])
    expect(ranked[0].average).toBe(4.0)
  })
})

describe('roundUpTenth + qualitativeFor (RF-04)', () => {
  it('rounds the critical hundredth up to the next tenth', () => {
    expect(roundUpTenth(2.92)).toBe(3)
    expect(roundUpTenth(4.44)).toBe(4.5)
    expect(roundUpTenth(3.0)).toBe(3.0)
  })

  it('assigns the band from the ROUNDED value, not the raw one', () => {
    const scale = [
      { key: 'bajo', label: 'Bajo', min: 0, max: 2.9, tone: 'red' },
      { key: 'basico', label: 'Básico', min: 3.0, max: 3.9, tone: 'amber' },
    ]
    // 2.92 is in the gap between bands; the institutional rule rounds it to
    // 3.0 and ONLY THEN looks up the band.
    expect(qualitativeFor(roundUpTenth(2.92), scale)).toBe('Básico')
  })
})

describe('buildFinalReport (quinto informe)', () => {
  const SUBJ = ['M', 'C']
  const period = (label, students, extra = {}) => ({
    grade: '5° A',
    teacher: 'Titular',
    label,
    subjects: SUBJ,
    students,
    ...extra,
  })

  it('unions subjects in first-appearance order', () => {
    const final = buildFinalReport([
      period('Informe 1', [{ name: 'Ana', scores: { M: 4 } }], { subjects: ['M'] }),
      period('Informe 2', [{ name: 'Ana', scores: { M: 5, C: 4 } }], {
        subjects: ['M', 'C'],
      }),
    ])
    expect(final.subjects).toEqual(['M', 'C'])
  })

  it('averages per subject ignoring null periods (absences never penalize)', () => {
    const final = buildFinalReport([
      period('Informe 1', [{ name: 'Ana', scores: { M: 3.92, C: 4 } }]),
      period('Informe 2', [{ name: 'Ana', scores: { M: null, C: 4 } }]),
      period('Informe 3', [{ name: 'Ana', scores: { M: 5.0, C: 4 } }]),
    ])
    expect(final.students[0].scores.M).toBeCloseTo(4.46, 9)
    expect(final.students[0].scores.C).toBeCloseTo(4.0, 9)
  })

  it('matches students by normalized name and keeps the first spelling', () => {
    const final = buildFinalReport([
      period('Informe 1', [{ name: 'ana gómez', scores: { M: 4 } }]),
      period('Informe 2', [{ name: 'Ana Gómez  ', scores: { M: 5 } }]),
    ])
    expect(final.students).toHaveLength(1)
    expect(final.students[0].name).toBe('ana gómez')
    expect(final.students[0].scores.M).toBeCloseTo(4.5, 9)
  })

  it('uses the latest period for per-subject docents', () => {
    const final = buildFinalReport([
      period('Informe 1', [{ name: 'Ana', scores: { M: 4 } }], {
        teachers: { M: 'Prof. Viejo' },
      }),
      period('Informe 2', [{ name: 'Ana', scores: { M: 5 } }], {
        teachers: { M: 'Prof. Nuevo' },
      }),
    ])
    expect(final.teachers.M).toBe('Prof. Nuevo')
  })

  it('exposes period labels for the per-period columns', () => {
    const final = buildFinalReport([
      period('Informe 1', [{ name: 'Ana', scores: { M: 4 } }]),
      period('Informe 2', [{ name: 'Ana', scores: { M: 5 } }]),
    ])
    expect(final.periodLabels).toEqual(['Informe 1', 'Informe 2'])
    expect(final.students[0].periodScores.M).toEqual([4, 5])
  })

  it('merges saved final performances by student name (DER-08 rule)', () => {
    const final = buildFinalReport(
      [
        period('Informe 1', [{ name: 'Ana', scores: { M: 4 } }]),
        period('Informe 2', [{ name: 'Ana', scores: { M: 5 } }]),
      ],
      undefined,
      { ANA: { M: 'Excelente en Matemáticas' } },
    )
    expect(final.students[0].performances.M).toBe('Excelente en Matemáticas')
  })

  it('keeps final performances empty when nothing was annotated', () => {
    const final = buildFinalReport([
      period('Informe 1', [{ name: 'Ana', scores: { M: 4 } }]),
    ])
    expect(final.students[0].performances.M).toBe('')
  })

  it('keeps rankStudents invariants on the final ranking', () => {
    const final = buildFinalReport([
      period('Informe 1', [
        { name: 'Baja', scores: { M: 2.9 } },
        { name: 'Alta', scores: { M: 4.9 } },
      ]),
      period('Informe 2', [
        { name: 'Baja', scores: { M: 2.9 } },
        { name: 'Alta', scores: { M: 4.9 } },
      ]),
    ])
    // mean of subject means: Baja 2.9 -> Bajo; Alta 4.9 -> Superior
    expect(final.students.map((s) => s.name)).toEqual(['Alta', 'Baja'])
    expect(final.students.map((s) => s.position)).toEqual([1, 2])
  })
})
