import { useEffect, useState } from 'react'
import { DEFAULT_SCALE } from '../utils/calculations'
import {
  applyMatrixToReport,
  makeId,
  matrixApplicationStats,
} from '../utils/parser'
import { parseRosterNames, remainingSubjectSuggestions } from '../utils/roster'
import { parseScoreInput } from '../utils/scoreInput'
import PerformanceMatrixImport from './PerformanceMatrixImport'
import StudentFocusPanel from './StudentFocusPanel'
import { Button, Field, TextArea, TextInput } from './ui'

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
  const [focusStudentId, setFocusStudentId] = useState(null)
  // Compact view collapses desempeños per row; the full grid (default) never
  // hides them, so imports/reviews always see the whole picture at first.
  const [compact, setCompact] = useState(false)
  const [expandedRows, setExpandedRows] = useState({})
  const [rosterText, setRosterText] = useState('')
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
  const normalizedSubjectNames = namedSubjects.map((subject) =>
    normalizeSubject(subject.name),
  )
  const matrixNamesValid =
    namedSubjects.length === subjects.length &&
    new Set(normalizedSubjectNames).size === normalizedSubjectNames.length
  const matrixStats =
    matrix && matrixNamesValid
      ? matrixApplicationStats(
          buildMatrixReport(namedSubjects, matrixNamedStudents),
          matrix,
          scale,
          scaleType,
        )
      : null
  const matrixPanelNotice = matrix && !matrixNamesValid
    ? 'Corrige los nombres de las asignaturas para ver el resumen de la matriz.'
    : matrixNotice

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
        stats.missingScore > 0 && stats.unmatched > 0
          ? 'Faltan notas en algunas celdas y la matriz no coincide con otras. Revisa ambas cosas.'
          : stats.missingScore > 0
            ? 'Todavía no hay notas para aplicar la matriz. Carga las notas y vuelve a intentar.'
            : stats.unmatched > 0 || stats.coverage === 0
              ? 'La matriz no coincide con las asignaturas o bandas de este período.'
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
  const focusIndex = focusStudentId ? students.findIndex((s) => s.id === focusStudentId) : -1
  const focusActive = focusIndex !== -1
  const rowExpanded = (studentId) => !compact || Boolean(expandedRows[studentId])
  const toggleRowExpand = (studentId) =>
    setExpandedRows((current) => ({ ...current, [studentId]: !current[studentId] }))
  const filledPerformances = (student) =>
    subjects.filter((subject) => String(student.performances?.[subject.id] ?? '').trim() !== '')
      .length

  const subjectSuggestions = remainingSubjectSuggestions(subjects.map((subject) => subject.name))

  const addSuggestedSubject = (name) =>
    setSubjects((current) => [...current, { id: makeId(), name, teacher: '' }])

  const addRosterStudents = () => {
    const names = parseRosterNames(rosterText, students.map((student) => student.name))
    if (names.length === 0) return
    setStudents((current) => [...current, ...names.map((name) => ({ ...emptyStudent(), name }))])
    setRosterText('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {editing ? 'Editar período' : 'Nuevo período'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {editing
            ? 'Ajusta estudiantes, asignaturas, notas y desempeños. Los demás períodos no cambian.'
            : 'Completa la estructura del período; se agrega cuando guardas.'}
        </p>
      </div>

      <fieldset disabled={readOnly} className="min-w-0 space-y-6 disabled:opacity-60">
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
                    className="w-44"
                    value={subject.name}
                    onChange={(event) => renameSubject(subject.id, event.target.value)}
                    placeholder="Asignatura"
                    aria-label={`Nombre de asignatura ${index + 1}`}
                  />
                  <TextInput
                    className="w-44"
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
          {subjectSuggestions.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500">Asignaturas comunes:</span>
              {subjectSuggestions.map((name) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="sm"
                  onClick={() => addSuggestedSubject(name)}
                  aria-label={`Asignatura sugerida: ${name}`}
                >
                  + {name}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Estudiantes ({students.length})</p>
          {students.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={compact}
              onClick={() => {
                setCompact((current) => !current)
                setExpandedRows({})
              }}
            >
              {compact ? 'Vista completa' : 'Vista compacta'}
            </Button>
          ) : null}
        </div>

        {focusActive ? (
          <StudentFocusPanel
            student={students[focusIndex]}
            position={focusIndex}
            count={students.length}
            subjects={subjects}
            scoreDrafts={scoreDrafts}
            maxScore={maxScore}
            scale={scale}
            scaleType={scaleType}
            onNameChange={setStudentName}
            onScoreDraftChange={(id, subjectId, value) =>
              setScoreDrafts((current) => ({
                ...current,
                [`${id}:${subjectId}`]: value,
              }))
            }
            onScoreCommit={commitScore}
            onPerformanceChange={setPerformance}
            onNavigate={(delta) => setFocusStudentId(students[focusIndex + delta]?.id ?? null)}
            onClose={() => setFocusStudentId(null)}
          />
        ) : (
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-slate-50 px-3 py-2">Estudiante</th>
                {subjects.map((subject) => (
                  <th key={subject.id} className={`sticky top-0 z-10 bg-slate-50 px-3 py-2 ${compact ? 'min-w-32' : 'min-w-56'}`}>
                    {subject.name || '—'}
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((student, studentIndex) => (
                <tr key={student.id} className="border-t border-slate-100 align-top">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                    <TextInput
                      className="w-56"
                      value={student.name}
                      onChange={(event) => setStudentName(student.id, event.target.value)}
                      placeholder="Nombre del estudiante"
                      aria-label={`Nombre del estudiante ${studentIndex + 1}`}
                    />
                  </td>
                  {subjects.map((subject) => {
                    const draftKey = `${student.id}:${subject.id}`
                    const draft = scoreDrafts[draftKey]
                    const score = student.scores?.[subject.id]
                    return (
                      <td key={subject.id} className="px-3 py-1.5">
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
                          {rowExpanded(student.id) ? (
                            <TextArea
                              placeholder="Desempeño…"
                              value={student.performances?.[subject.id] ?? ''}
                              onChange={(event) =>
                                setPerformance(student.id, subject.id, event.target.value)
                              }
                              aria-label={`Desempeño de ${student.name || 'estudiante'} en ${subject.name || 'asignatura'}`}
                            />
                          ) : null}
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      {compact ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={rowExpanded(student.id)}
                          aria-label={`Desempeños de ${student.name || 'estudiante'}`}
                          onClick={() => toggleRowExpand(student.id)}
                        >
                          {filledPerformances(student)}/{subjects.length}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStudent(student.id)}
                        aria-label={`Quitar ${student.name || 'estudiante'}`}
                      >
                        ×
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={addStudent}>
            Agregar estudiante
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              focusActive
                ? setFocusStudentId(null)
                : setFocusStudentId(students[0]?.id ?? null)
            }
          >
            {focusActive ? 'Volver a la grilla' : 'Modo enfoque'}
          </Button>
        </div>

        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm text-slate-700">
            Cargar una lista de estudiantes
          </summary>
          <p className="mt-1 text-xs text-slate-500">
            Pega los nombres, un estudiante por línea. Se omiten los que ya están en la lista.
          </p>
          <div className="mt-2">
            <TextArea
              className="min-h-24"
              value={rosterText}
              onChange={(event) => setRosterText(event.target.value)}
              placeholder={'Ana Gómez\nLuis Pérez'}
              aria-label="Lista de estudiantes para pegar"
            />
          </div>
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={addRosterStudents}>
              Cargar lista
            </Button>
          </div>
        </details>

        <PerformanceMatrixImport
          matrix={matrix}
          stats={matrixStats}
          readOnly={readOnly}
          notice={matrixPanelNotice}
          applyDisabled={matrix && !matrixNamesValid}
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
