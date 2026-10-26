import { useEffect, useState } from 'react'
import { DEFAULT_SCALE } from '../utils/calculations'
import {
  applyMatrixToReport,
  makeId,
  matrixApplicationStats,
} from '../utils/parser'
import { parseScoreInput } from '../utils/scoreInput'
import PeriodMatrixImport from './PeriodMatrixImport'
import { Button, Field, TextInput } from './ui'

const normalizeSubject = (value) => value.trim().toLocaleLowerCase('es')

/** Commits score drafts without touching React state, for live matrix counts. */
const materializeScores = (students, subjects, scoreDrafts, maxScore) =>
  students.map((student) => {
    const scores = { ...(student.scores ?? {}) }
    for (const subject of subjects) {
      const draft = scoreDrafts[`${student.id}:${subject.id}`]
      if (draft === undefined) continue
      scores[subject.id] =
        draft.trim() === '' ? null : parseScoreInput(draft, maxScore)
    }
    return { ...student, scores }
  })

/** Translates id-keyed subjects/performances into the name-keyed report shape. */
const buildMatrixReport = (subjects, students) => ({
  subjects: subjects.map((subject) => subject.name),
  students: students.map((student) => ({
    id: student.id,
    name: student.name,
    scores: Object.fromEntries(
      subjects.map((subject) => [subject.name, student.scores?.[subject.id] ?? null]),
    ),
    performances: Object.fromEntries(
      subjects.map((subject) => [
        subject.name,
        student.performances?.[subject.id] ?? '',
      ]),
    ),
  })),
})

const emptyStudent = () => ({
  id: makeId(),
  name: '',
  scores: {},
  performances: {},
})

/**
 * Builds the editor's local draft once. Subjects get stable local ids so
 * renaming never has to move scores or performances between keys, even while
 * two subject names are temporarily duplicated.
 */
const buildBase = (initial) => {
  const subjectNames = initial?.subjects?.length ? initial.subjects : ['Matemáticas']
  const subjects = subjectNames.map((name, index) => ({
    id: `subject-${index}`,
    name,
    teacher: initial?.teachers?.[name] ?? '',
  }))
  const sourceStudents =
    initial?.students?.length > 0
      ? initial.students
      : [emptyStudent(), emptyStudent()]

  return {
    grade: initial?.grade ?? '',
    teacher: initial?.teacher ?? '',
    subjects,
    students: sourceStudents.map((student) => ({
      id: student.id ?? makeId(),
      name: student.name ?? '',
      scores: Object.fromEntries(
        subjects.map((subject) => [subject.id, student.scores?.[subject.name] ?? null]),
      ),
      performances: Object.fromEntries(
        subjects.map((subject) => [subject.id, student.performances?.[subject.name] ?? '']),
      ),
    })),
  }
}

/**
 * Shared period editor (R4.1): create or edit a period with its subjects,
 * students, scores and perfomance notes. It owns a local draft; nothing is
 * persisted until the teacher saves, so cancelling never touches the canonical
 * reports.
 */
export default function PeriodEditor({
  mode = 'create',
  initial = null,
  maxScore = 5,
  scale = DEFAULT_SCALE,
  scaleType = 'decimal',
  readOnly = false,
  onSave,
  onCancel,
  onDirtyChange,
}) {
  // Freeze the opening snapshot: a remote resync may replace `reports`, but it
  // must never replace this draft or mark it clean behind the teacher's back.
  const [base] = useState(() => buildBase(initial))

  const [grade, setGrade] = useState(base.grade)
  const [teacher, setTeacher] = useState(base.teacher)
  const [subjects, setSubjects] = useState(base.subjects)
  const [students, setStudents] = useState(base.students)
  const [scoreDrafts, setScoreDrafts] = useState({})
  const [matrix, setMatrix] = useState(null)
  const [matrixNotice, setMatrixNotice] = useState('')
  const [error, setError] = useState('')

  const snapshot = JSON.stringify({ grade, teacher, subjects, students })
  const baseSnapshot = JSON.stringify(base)
  const dirty = snapshot !== baseSnapshot || Object.keys(scoreDrafts).length > 0

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const addSubject = () => {
    setSubjects((current) => [
      ...current,
      { id: makeId(), name: `Asignatura ${current.length + 1}`, teacher: '' },
    ])
  }

  const renameSubject = (id, value) =>
    setSubjects((current) =>
      current.map((subject) => (subject.id === id ? { ...subject, name: value } : subject)),
    )

  const removeSubject = (id) => {
    setSubjects((current) => current.filter((subject) => subject.id !== id))
    setStudents((current) =>
      current.map((student) => {
        const { [id]: _score, ...scores } = student.scores ?? {}
        const { [id]: _performance, ...performances } = student.performances ?? {}
        return { ...student, scores, performances }
      }),
    )
    setScoreDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key.split(':')[1] !== id),
      ),
    )
  }

  const setSubjectTeacher = (id, value) =>
    setSubjects((current) =>
      current.map((subject) => (subject.id === id ? { ...subject, teacher: value } : subject)),
    )

  const addStudent = () => setStudents((current) => [...current, emptyStudent()])

  const removeStudent = (id) =>
    setStudents((current) => current.filter((student) => student.id !== id))

  const setStudentName = (id, name) =>
    setStudents((current) =>
      current.map((student) => (student.id === id ? { ...student, name } : student)),
    )

  const setPerformance = (id, subjectId, text) =>
    setStudents((current) =>
      current.map((student) =>
        student.id === id
          ? {
              ...student,
              performances: { ...(student.performances ?? {}), [subjectId]: text },
            }
          : student,
      ),
    )

  const commitScore = (id, subjectId, raw) => {
    const key = `${id}:${subjectId}`
    const clearDraft = () =>
      setScoreDrafts((current) => {
        if (!(key in current)) return current
        const next = { ...current }
        delete next[key]
        return next
      })

    if (raw.trim() === '') {
      setStudents((current) =>
        current.map((student) =>
          student.id === id
            ? { ...student, scores: { ...student.scores, [subjectId]: null } }
            : student,
        ),
      )
      clearDraft()
      return
    }

    const value = parseScoreInput(raw, maxScore)
    if (value === null) {
      clearDraft()
      return
    }
    setStudents((current) =>
      current.map((student) =>
        student.id === id
          ? { ...student, scores: { ...student.scores, [subjectId]: value } }
          : student,
      ),
    )
    clearDraft()
  }

  const namedSubjects = subjects
    .map((subject) => ({ ...subject, name: subject.name.trim() }))
    .filter((subject) => subject.name !== '')
  const matrixDraftStudents = matrix
    ? materializeScores(students, subjects, scoreDrafts, maxScore)
    : null
  const matrixNamedStudents = matrixDraftStudents?.filter(
    (student) => student.name.trim() !== '',
  )
  const matrixStats = matrix
    ? matrixApplicationStats(
        buildMatrixReport(namedSubjects, matrixNamedStudents),
        matrix,
        scale,
        scaleType,
      )
    : null

  const flushDrafts = () => {
    const next = materializeScores(students, subjects, scoreDrafts, maxScore)
    setStudents(next)
    setScoreDrafts({})
    return next
  }

  const handleLoadMatrix = (nextMatrix) => {
    setMatrix(nextMatrix)
    setMatrixNotice('')
  }

  const handleClearMatrix = () => {
    setMatrix(null)
    setMatrixNotice('')
  }

  const handleApplyMatrix = () => {
    if (!matrix || readOnly) return
    if (namedSubjects.length !== subjects.length) {
      setMatrixNotice('Completa o quita las asignaturas sin nombre antes de aplicar la matriz.')
      return
    }
    const normalized = namedSubjects.map((subject) => normalizeSubject(subject.name))
    if (new Set(normalized).size !== normalized.length) {
      setMatrixNotice('Corrige los nombres repetidos antes de aplicar la matriz.')
      return
    }
    const draftStudents = materializeScores(students, subjects, scoreDrafts, maxScore)
    const namedStudents = draftStudents.filter((student) => student.name.trim() !== '')
    const report = buildMatrixReport(namedSubjects, namedStudents)
    const stats = matrixApplicationStats(report, matrix, scale, scaleType)
    if (stats.fillable === 0) {
      setMatrixNotice(
        stats.missingScore > 0
          ? 'Todavía no hay notas para aplicar la matriz. Carga las notas y vuelve a intentar.'
          : 'No hay casilleros vacíos para completar en este período.',
      )
      return
    }

    const filled = applyMatrixToReport(report, matrix, scale, scaleType)
    const filledById = new Map(filled.map((student) => [student.id, student]))
    setStudents(
      draftStudents.map((student) => {
        const next = filledById.get(student.id)
        if (!next) return student
        const performances = { ...(student.performances ?? {}) }
        for (const subject of namedSubjects) {
          performances[subject.id] =
            next.performances?.[subject.name] ?? performances[subject.id] ?? ''
        }
        return { ...student, performances }
      }),
    )
    setScoreDrafts({})
    setMatrixNotice(
      stats.fillable === 1
        ? 'Matriz aplicada: 1 casillero completado.'
        : `Matriz aplicada: ${stats.fillable} casilleros completados.`,
    )
  }

  const handleSave = () => {
    if (readOnly) return
    const currentStudents = flushDrafts()
    const namedSubjects = subjects
      .map((subject) => ({ ...subject, name: subject.name.trim() }))
      .filter((subject) => subject.name !== '')
    if (namedSubjects.length === 0) {
      setError('Agrega al menos una asignatura.')
      return
    }
    if (namedSubjects.length !== subjects.length) {
      setError('Completa o quita las asignaturas sin nombre.')
      return
    }
    const normalized = namedSubjects.map((subject) => normalizeSubject(subject.name))
    if (new Set(normalized).size !== normalized.length) {
      setError('No repitas el nombre de una asignatura.')
      return
    }

    const namedStudents = currentStudents.filter((student) => student.name.trim() !== '')
    if (namedStudents.length === 0) {
      setError('Agrega al menos un estudiante con nombre.')
      return
    }
    const hasData = (student) =>
      Object.values(student.scores ?? {}).some((score) => score !== null && score !== undefined) ||
      Object.values(student.performances ?? {}).some(
        (performance) => String(performance).trim() !== '',
      )
    if (currentStudents.some((student) => student.name.trim() === '' && hasData(student))) {
      setError('Completa el nombre de los estudiantes con notas o desempeños, o quítalos.')
      return
    }

    const validStudents = namedStudents.map((student) => ({
      id: student.id,
      name: student.name.trim(),
      scores: Object.fromEntries(
        namedSubjects.map((subject) => [
          subject.name,
          student.scores?.[subject.id] ?? null,
        ]),
      ),
      performances: Object.fromEntries(
        namedSubjects.map((subject) => [
          subject.name,
          student.performances?.[subject.id] ?? '',
        ]),
      ),
    }))
    onSave?.({
      grade: grade.trim(),
      teacher: teacher.trim(),
      subjects: namedSubjects.map((subject) => subject.name),
      teachers: Object.fromEntries(
        namedSubjects
          .map((subject) => [subject.name, subject.teacher.trim()])
          .filter(([, value]) => value !== ''),
      ),
      students: validStudents,
    })
  }

  const editing = mode === 'edit'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {editing ? 'Editar período' : 'Nuevo período'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {editing
            ? 'Ajusta estudiantes, asignaturas, notas y desempeños. Los demás períodos no cambian.'
            : 'Completa la estructura del período; se agrega cuando guardas.'}
        </p>
      </div>

      <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grado / Curso">
            <TextInput
              className="w-full"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              placeholder="5° A"
            />
          </Field>
          <Field
            label="Docente"
            hint="Docente titular del curso. Cada asignatura puede llevar el suyo en su tarjeta."
          >
            <TextInput
              className="w-full"
              value={teacher}
              onChange={(event) => setTeacher(event.target.value)}
              placeholder="Prof. Rivera"
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Asignaturas ({subjects.length})</p>
            <Button variant="secondary" size="sm" onClick={addSubject}>
              Agregar asignatura
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject, index) => (
              <div
                key={subject.id}
                className="flex items-center gap-1 rounded-lg bg-slate-100 p-1.5"
              >
                <div className="flex flex-col gap-1">
                  <TextInput
                    className="w-44 border-transparent bg-transparent shadow-none"
                    value={subject.name}
                    onChange={(event) => renameSubject(subject.id, event.target.value)}
                    placeholder="Asignatura"
                    aria-label={`Nombre de asignatura ${index + 1}`}
                  />
                  <TextInput
                    className="w-44 border-transparent bg-transparent shadow-none"
                    value={subject.teacher}
                    onChange={(event) => setSubjectTeacher(subject.id, event.target.value)}
                    placeholder="Docente (opcional)"
                    aria-label={`Docente de ${subject.name || 'asignatura'}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSubject(subject.id)}
                  aria-label={`Quitar ${subject.name}`}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Estudiante</th>
                {subjects.map((subject) => (
                  <th key={subject.id} className="min-w-56 px-3 py-2">
                    {subject.name || '—'}
                  </th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-slate-100 align-top">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <TextInput
                      className="w-56"
                      value={student.name}
                      onChange={(event) => setStudentName(student.id, event.target.value)}
                      placeholder="Nombre del estudiante"
                    />
                  </td>
                  {subjects.map((subject) => {
                    const draftKey = `${student.id}:${subject.id}`
                    const draft = scoreDrafts[draftKey]
                    const score = student.scores?.[subject.id]
                    return (
                      <td key={subject.id} className="px-3 py-2">
                        <div className="space-y-1.5">
                          <TextInput
                            className="w-24"
                            inputMode="decimal"
                            value={draft ?? (score === null || score === undefined ? '' : String(score))}
                            onChange={(event) =>
                              setScoreDrafts((current) => ({
                                ...current,
                                [draftKey]: event.target.value,
                              }))
                            }
                            onBlur={(event) =>
                              commitScore(student.id, subject.id, event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                event.currentTarget.blur()
                              }
                            }}
                            aria-label={`Nota de ${student.name || 'estudiante'} en ${subject.name || 'asignatura'}`}
                          />
                          <textarea
                            className="min-h-[56px] w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            placeholder="Desempeño…"
                            value={student.performances?.[subject.id] ?? ''}
                            onChange={(event) =>
                              setPerformance(student.id, subject.id, event.target.value)
                            }
                            aria-label={`Desempeño de ${student.name || 'estudiante'} en ${subject.name || 'asignatura'}`}
                          />
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStudent(student.id)}
                      aria-label={`Quitar ${student.name || 'estudiante'}`}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button variant="secondary" size="sm" onClick={addStudent}>
          Agregar estudiante
        </Button>

        <PeriodMatrixImport
          matrix={matrix}
          stats={matrixStats}
          readOnly={readOnly}
          notice={matrixNotice}
          onLoadMatrix={handleLoadMatrix}
          onClearMatrix={handleClearMatrix}
          onApply={handleApplyMatrix}
        />

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Volver
        </Button>
        <Button onClick={handleSave} disabled={readOnly}>
          {editing ? 'Guardar cambios' : 'Crear período'}
        </Button>
      </div>
    </div>
  )
}
