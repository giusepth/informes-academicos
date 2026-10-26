import { useEffect, useMemo, useState } from 'react'
import { makeId } from '../utils/parser'
import { parseScoreInput } from '../utils/scoreInput'
import { Button, Field, TextInput } from './ui'

const normalizeSubject = (value) => value.trim().toLocaleLowerCase('es')

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
  readOnly = false,
  onSave,
  onCancel,
  onDirtyChange,
}) {
  const base = useMemo(
    () => ({
      grade: initial?.grade ?? '',
      teacher: initial?.teacher ?? '',
      subjects: initial?.subjects?.length ? initial.subjects : ['Matemáticas'],
      teachers: initial?.teachers ?? {},
      students:
        initial?.students?.length > 0
          ? initial.students
          : [
              { id: makeId(), name: '', scores: {}, performances: {} },
              { id: makeId(), name: '', scores: {}, performances: {} },
            ],
    }),
    [initial],
  )

  const [grade, setGrade] = useState(base.grade)
  const [teacher, setTeacher] = useState(base.teacher)
  const [subjects, setSubjects] = useState(base.subjects)
  const [teachers, setTeachers] = useState(base.teachers)
  const [students, setStudents] = useState(base.students)
  const [scoreDrafts, setScoreDrafts] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    setGrade(base.grade)
    setTeacher(base.teacher)
    setSubjects(base.subjects)
    setTeachers(base.teachers)
    setStudents(base.students)
    setScoreDrafts({})
    setError('')
  }, [base])

  const snapshot = JSON.stringify({ grade, teacher, subjects, teachers, students })
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
    const name = `Asignatura ${subjects.length + 1}`
    setSubjects((current) => [...current, name])
  }

  const renameSubject = (index, value) => {
    const previous = subjects[index]
    setSubjects((current) => current.map((subject, i) => (i === index ? value : subject)))
    setStudents((current) =>
      current.map((student) => {
        const { [previous]: score, ...scoreRest } = student.scores ?? {}
        const { [previous]: performance, ...performanceRest } = student.performances ?? {}
        return {
          ...student,
          scores: { ...scoreRest, [value]: score ?? null },
          performances: { ...performanceRest, [value]: performance ?? '' },
        }
      }),
    )
    setTeachers((current) => {
      const { [previous]: moved, ...rest } = current
      return { ...rest, [value]: moved ?? '' }
    })
    setScoreDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, draft]) => {
          const [studentId, subject] = key.split(':')
          return [subject === previous ? `${studentId}:${value}` : key, draft]
        }),
      ),
    )
  }

  const removeSubject = (index) => {
    const removed = subjects[index]
    setSubjects((current) => current.filter((_, i) => i !== index))
    setStudents((current) =>
      current.map((student) => {
        const { [removed]: _score, ...scores } = student.scores ?? {}
        const { [removed]: _performance, ...performances } = student.performances ?? {}
        return { ...student, scores, performances }
      }),
    )
    setTeachers((current) => {
      const { [removed]: _drop, ...rest } = current
      return rest
    })
    setScoreDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key.split(':')[1] !== removed),
      ),
    )
  }

  const setSubjectTeacher = (index, value) =>
    setTeachers((current) => ({ ...current, [subjects[index]]: value }))

  const addStudent = () =>
    setStudents((current) => [
      ...current,
      { id: makeId(), name: '', scores: {}, performances: {} },
    ])

  const removeStudent = (id) =>
    setStudents((current) => current.filter((student) => student.id !== id))

  const setStudentName = (id, name) =>
    setStudents((current) =>
      current.map((student) => (student.id === id ? { ...student, name } : student)),
    )

  const setPerformance = (id, subject, text) =>
    setStudents((current) =>
      current.map((student) =>
        student.id === id
          ? {
              ...student,
              performances: { ...(student.performances ?? {}), [subject]: text },
            }
          : student,
      ),
    )

  const commitScore = (id, subject, raw) => {
    const key = `${id}:${subject}`
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
            ? { ...student, scores: { ...student.scores, [subject]: null } }
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
          ? { ...student, scores: { ...student.scores, [subject]: value } }
          : student,
      ),
    )
    clearDraft()
  }

  const flushDrafts = () => {
    const next = students.map((student) => {
      const scores = { ...(student.scores ?? {}) }
      for (const subject of subjects) {
        const draft = scoreDrafts[`${student.id}:${subject}`]
        if (draft === undefined) continue
        scores[subject] = draft.trim() === '' ? null : parseScoreInput(draft, maxScore)
      }
      return { ...student, scores }
    })
    setStudents(next)
    setScoreDrafts({})
    return next
  }

  const handleSave = () => {
    if (readOnly) return
    const currentStudents = flushDrafts()
    const validSubjects = subjects.map((subject) => subject.trim()).filter(Boolean)
    if (validSubjects.length === 0) {
      setError('Agrega al menos una asignatura.')
      return
    }
    const normalized = validSubjects.map(normalizeSubject)
    if (new Set(normalized).size !== normalized.length) {
      setError('No repitas el nombre de una asignatura.')
      return
    }
    const validStudents = currentStudents
      .filter((student) => student.name.trim() !== '')
      .map((student) => ({
        id: student.id,
        name: student.name.trim(),
        scores: Object.fromEntries(
          validSubjects.map((subject) => [subject, student.scores?.[subject] ?? null]),
        ),
        performances: Object.fromEntries(
          validSubjects.map((subject) => [subject, student.performances?.[subject] ?? '']),
        ),
      }))
    if (validStudents.length === 0) {
      setError('Agrega al menos un estudiante con nombre.')
      return
    }
    onSave?.({
      grade: grade.trim(),
      teacher: teacher.trim(),
      subjects: validSubjects,
      teachers: Object.fromEntries(
        validSubjects
          .map((subject) => [subject, (teachers[subject] ?? '').trim()])
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
                key={index}
                className="flex items-center gap-1 rounded-lg bg-slate-100 p-1.5"
              >
                <div className="flex flex-col gap-1">
                  <TextInput
                    className="w-44 border-transparent bg-transparent shadow-none"
                    value={subject}
                    onChange={(event) => renameSubject(index, event.target.value)}
                    placeholder="Asignatura"
                    aria-label={`Nombre de asignatura ${index + 1}`}
                  />
                  <TextInput
                    className="w-44 border-transparent bg-transparent shadow-none"
                    value={teachers[subject] ?? ''}
                    onChange={(event) => setSubjectTeacher(index, event.target.value)}
                    placeholder="Docente (opcional)"
                    aria-label={`Docente de ${subject || 'asignatura'}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSubject(index)}
                  aria-label={`Quitar ${subject}`}
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
                {subjects.map((subject, index) => (
                  <th key={index} className="min-w-56 px-3 py-2">
                    {subject || '—'}
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
                  {subjects.map((subject, index) => {
                    const draftKey = `${student.id}:${subject}`
                    const draft = scoreDrafts[draftKey]
                    return (
                      <td key={index} className="px-3 py-2">
                        <div className="space-y-1.5">
                          <TextInput
                            className="w-24"
                            inputMode="decimal"
                            value={
                              draft ??
                              (student.scores?.[subject] === null ||
                              student.scores?.[subject] === undefined
                                ? ''
                                : String(student.scores[subject]))
                            }
                            onChange={(event) =>
                              setScoreDrafts((current) => ({
                                ...current,
                                [draftKey]: event.target.value,
                              }))
                            }
                            onBlur={(event) =>
                              commitScore(student.id, subject, event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                event.currentTarget.blur()
                              }
                            }}
                            aria-label={`Nota de ${student.name || 'estudiante'} en ${subject || 'asignatura'}`}
                          />
                          <textarea
                            className="min-h-[56px] w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            placeholder="Desempeño…"
                            value={student.performances?.[subject] ?? ''}
                            onChange={(event) =>
                              setPerformance(student.id, subject, event.target.value)
                            }
                            aria-label={`Desempeño de ${student.name || 'estudiante'} en ${subject || 'asignatura'}`}
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
