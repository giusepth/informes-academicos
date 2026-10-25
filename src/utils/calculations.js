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

/**
 * Scale types (RF-01 extended). Every school grades on ONE of these:
 * - decimal: 1.0 – 5.0 with tenth precision.
 * - centesimal: 1 – 100.
 * The setup modal asks which one and seeds the editable bands from here.
 */
export const SCALE_TYPES = [
  { key: 'decimal', label: 'Decimal (1.0 a 5.0)' },
  { key: 'centesimal', label: 'Centesimal (1 a 100)' },
]

/** Default lookups — keys match SCALE_TYPES keys. */
export const DEFAULT_SCALES = {
  decimal: DEFAULT_SCALE,
  centesimal: [
    { key: 'bajo', label: 'Bajo', min: 1, max: 59, tone: 'red' },
    { key: 'basico', label: 'Básico', min: 60, max: 79, tone: 'amber' },
    { key: 'alto', label: 'Alto', min: 80, max: 89, tone: 'blue' },
    { key: 'superior', label: 'Superior', min: 90, max: 100, tone: 'emerald' },
  ],
}

/** Coerces a persisted scale type; unknown/legacy values fall back to decimal. */
export function normalizeScaleType(scaleType) {
  return scaleType === 'centesimal' ? 'centesimal' : 'decimal'
}

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
 * Institutional rounding by scale type:
 * - decimal: up to the next tenth (same rule as always).
 * - centesimal: up to the next integer — driving a borderline 59.3 into the
 *   Básico band mirrors the tenth rule at the scale's natural precision.
 */
export function roundForScale(score, scaleType = 'decimal') {
  return normalizeScaleType(scaleType) === 'centesimal' ? Math.ceil(score) : roundUpTenth(score)
}

/**
 * Score cell formatting by scale type: decimal keeps the classic one-decimal
 * display; centesimal shows the score verbatim (80, not 80.0) trimming the
 * 2-decimal tail; empty scores map to `—` by the caller (returns undefined
 * values are passed through as null).
 */
export function formatScore(score, scaleType = 'decimal') {
  if (score === null || score === undefined) return null
  return normalizeScaleType(scaleType) === 'centesimal'
    ? String(Number(score.toFixed(2)))
    : score.toFixed(1)
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
export function rankStudents(students, scale = DEFAULT_SCALE, scaleType = 'decimal') {
  const enriched = students.map((student) => {
    const scores = Object.values(student.scores || {})
    const average = averageScore(scores)
    const rounded = average === null ? null : roundForScale(average, scaleType)
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

function tempId() {
  return `f_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Builds the institutional final report ("quinto informe"): for each subject,
 * the mean of that subject's scores across every period report.
 *
 * Semantics:
 * - Subjects are the UNION of every period's subjects, in first-appearance
 *   order, so dynamic N from RF-03 keeps working even if a period added
 *   or dropped a subject. Missing period scores just count as absent data.
 * - Per-subject average ignores null scores (averageScore), so a student who
 *   was absent in one period is not penalized by a zero.
 * - Qualitative band per subject uses the institutional rounding rule (RF-04).
 * - The overall average is the mean of per-subject averages (raw), and the
 *   institutional position comes from rankStudents: raw mean, ties share the
 *   position, positions are dense (RF-05).
 * - Students are matched across periods by normalized name, since ids are
 *   regenerated per imported period. First spelling seen wins as display name.
 * - Per-subject teachers: the most recent period wins, so late docent changes
 *   propagate to the final document.
 * - `finalPerformances` (optional) carries the desempeños annotated directly on
 *   the final sheet, keyed by normalized student name — the same matching rule
 *   as RF-05, since the annotations must survive period re-imports. They
 *   OVERRIDE nothing from periods: periods keep their own per-period text,
 *   the final annotations live only here (authoritative command: DER-08).
 *
 * Returns a Report-shaped object (final: true) plus `periodScores` on each
 * student so the sheet can render one column per period.
 */
export function buildFinalReport(reports, scale = DEFAULT_SCALE, finalPerformances = null, scaleType = 'decimal') {
  const periodReports = (reports ?? []).filter(Boolean)
  if (periodReports.length === 0) return null

  const subjects = []
  const seenSubjects = new Set()
  for (const report of periodReports) {
    for (const subject of report.subjects ?? []) {
      if (subject && !seenSubjects.has(subject)) {
        seenSubjects.add(subject)
        subjects.push(subject)
      }
    }
  }

  const teachers = {}
  for (const report of periodReports) {
    Object.assign(teachers, report.teachers ?? {})
  }

  const groups = []
  const groupByName = new Map()
  for (const report of periodReports) {
    for (const student of report.students ?? []) {
      const key = String(student.name ?? '').trim().toUpperCase()
      let group = groupByName.get(key)
      if (!group) {
        group = { name: String(student.name ?? '').trim(), entries: [] }
        groupByName.set(key, group)
        groups.push(group)
      }
      group.entries.push(student)
    }
  }

  const baseStudents = groups.map((group) => {
    const scores = {}
    const periodScores = {}
    for (const subject of subjects) {
      const series = group.entries.map((student) => student.scores?.[subject] ?? null)
      periodScores[subject] = series
      scores[subject] = averageScore(series)
    }
    const studentKey = group.name.trim().toUpperCase()
    const overrides = finalPerformances?.[studentKey] ?? {}
    const performances = {}
    for (const subject of subjects) {
      performances[subject] = overrides[subject] ?? ''
    }
    return {
      id: tempId(),
      name: group.name,
      scores,
      periodScores,
      performances,
    }
  })

  const last = periodReports[periodReports.length - 1]
  return {
    grade: last.grade ?? '',
    teacher: last.teacher ?? '',
    subjects,
    teachers,
    students: rankStudents(baseStudents, scale, scaleType),
    final: true,
    periodLabels: periodReports.map((report, index) => report.label ?? `Informe ${index + 1}`),
  }
}
