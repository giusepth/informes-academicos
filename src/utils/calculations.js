/**
 * Domain calculations for academic reports.
 *
 * This module is pure: no React, no DOM, no storage. It receives data and
 * returns derived metrics so it can be unit-tested and reused anywhere.
 */

/** Default qualitative scale editable from the setup modal. */
export const DEFAULT_SCALE = [
  { key: 'bajo', label: 'Bajo', min: 0.0, max: 2.9, tone: 'red' },
  { key: 'basico', label: 'Básico', min: 3.0, max: 3.9, tone: 'amber' },
  { key: 'alto', label: 'Alto', min: 4.0, max: 4.5, tone: 'blue' },
  { key: 'superior', label: 'Superior', min: 4.6, max: 5.0, tone: 'emerald' },
]

/** Maps a scale band tone to a Tailwind-friendly class set. */
export const TONE_CLASSES = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-slate-100 text-slate-700',
}

/**
 * Institutional rounding: rounds up to the next tenth.
 * 2.92 -> 3.0, 3.0 -> 3.0, 4.44 -> 4.5.
 */
export function roundUpTenth(score) {
  return Math.ceil(score * 10) / 10
}

/**
 * Arithmetic mean of the provided scores, ignoring empty/null values.
 * Returns null when there is nothing to average.
 */
export function averageScore(scores) {
  const values = (scores || []).filter(
    (v) => typeof v === 'number' && Number.isFinite(v),
  )
  if (values.length === 0) return null
  return values.reduce((acc, v) => acc + v, 0) / values.length
}

/**
 * Finds the qualitative band that contains `score`.
 * Bands are inclusive on both ends so adjacent ranges do not leave gaps.
 */
export function qualitativeFor(score, scale = DEFAULT_SCALE) {
  if (score === null || score === undefined) return null
  const band = scale.find((b) => score >= b.min && score <= b.max)
  return band ? band.label : null
}

/** Finds the tone (color key) of the band containing `score`. */
export function toneFor(score, scale = DEFAULT_SCALE) {
  if (score === null || score === undefined) return 'slate'
  const band = scale.find((b) => score >= b.min && score <= b.max)
  return band ? band.tone : 'slate'
}

/** Two means within this distance are treated as the same value (float noise). */
const TIE_EPSILON = 1e-9

/**
 * Enriches each student with average, rounded average, qualitative label and
 * institutional position, then returns the list sorted by position ascending.
 *
 * The position is decided by the RAW arithmetic mean, never by the rounded one.
 * Rounding to a tenth is coarse enough that many distinct means collapse onto
 * the same displayed value, which would make the ranking arbitrary: with the
 * rounded key, 40 students collapsed into 13 positions.
 *
 * Ties (equal raw means) share a position, and positions are DENSE: the next
 * distinct mean takes the next consecutive number, so no slot is ever skipped.
 * Two students tied at #1 are followed by #2, not #3.
 *
 * The rounded mean is still computed, because the qualitative band (RF-05) is
 * assigned from it according to the institutional rounding rule (RF-04).
 */
export function rankStudents(students, scale = DEFAULT_SCALE) {
  const enriched = students.map((student) => {
    const scores = Object.values(student.scores || {})
    const average = averageScore(scores)
    const rounded = average === null ? null : roundUpTenth(average)
    return {
      ...student,
      average,
      roundedAverage: rounded,
      qualitative: qualitativeFor(rounded, scale),
      tone: toneFor(rounded, scale),
    }
  })

  const sorted = [...enriched].sort((a, b) => (b.average ?? -1) - (a.average ?? -1))

  let position = 0
  let previous = null
  return sorted.map((student) => {
    const sameGroup =
      student.average === previous ||
      (student.average !== null &&
        previous !== null &&
        Math.abs(student.average - previous) <= TIE_EPSILON)
    if (position === 0 || !sameGroup) {
      position += 1
      previous = student.average
    }
    return { ...student, position }
  })
}

/** Returns a summary of subject-level statistics for the dashboard. */
export function subjectAverages(students, subjects) {
  return subjects.map((subject) => {
    const values = students
      .map((s) => s.scores?.[subject])
      .filter((v) => typeof v === 'number' && Number.isFinite(v))
    const average = averageScore(values)
    return {
      subject,
      average,
      roundedAverage: average === null ? null : roundUpTenth(average),
      count: values.length,
    }
  })
}
