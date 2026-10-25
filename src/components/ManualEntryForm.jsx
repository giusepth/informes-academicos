import { useState } from 'react'
import { makeId } from '../utils/parser'
import { parseScoreInput } from '../utils/scoreInput'
import { Button, Field, TextInput } from './ui'

/**
 * Manual "vanilla" entry form (RF-02, option B).
 *
 * The user defines grade, teacher, an unbounded number of subjects (N) and the
 * student list, all by hand. Nothing leaves the browser.
 *
 * `maxScore` follows the configured scoring scale (5 for 1.0–5.0, 100 for
 * 1–100) so manual entry clamps to the school's real range.
 */
export default function ManualEntryForm({ onCancel, onLoaded, initial, maxScore = 5 }) {
  const [grade, setGrade] = useState(initial?.grade ?? '')
  const [teacher, setTeacher] = useState(initial?.teacher ?? '')
  const [subjects, setSubjects] = useState(initial?.subjects ?? ['Matemáticas'])
  // Per-subject docent, keyed by subject name so it survives renames the same
  // way scores do. Empty/absent entries fall back to the course-wide teacher.
  const [teachers, setTeachers] = useState(initial?.teachers ?? {})
  const [students, setStudents] = useState(
    () =>
      initial?.students ?? [
        { id: makeId(), name: '', scores: {} },
        { id: makeId(), name: '', scores: {} },
      ],
  )
  const [error, setError] = useState('')
  // Raw text per cell, keyed `${studentId}:${subject}`, so partial values
  // like "3," stay editable until blur/Enter commits the parsed number.
  const [scoreDrafts, setScoreDrafts] = useState({})

  const addSubject = () => {
    const name = `Asignatura ${subjects.length + 1}`
    setSubjects((current) => [...current, name])
  }

  const renameSubject = (index, value) => {
    const previous = subjects[index]
    setSubjects((current) => current.map((s, i) => (i === index ? value : s)))
    setStudents((current) =>
      current.map((student) => {
        const { [previous]: score, ...rest } = student.scores
        return { ...student, scores: { ...rest, [value]: score ?? null } }
      }),
    )
    setTeachers((current) => {
      const { [previous]: moved, ...rest } = current
      return { ...rest, [value]: moved ?? '' }
    })
  }

  const removeSubject = (index) => {
    const removed = subjects[index]
    setSubjects((current) => current.filter((_, i) => i !== index))
    setStudents((current) =>
      current.map((student) => {
        const { [removed]: _drop, ...rest } = student.scores
        return { ...student, scores: rest }
      }),
    )
    setTeachers((current) => {
      const { [removed]: _drop, ...rest } = current
      return rest
    })
  }

  const setSubjectTeacher = (index, value) =>
    setTeachers((current) => ({ ...current, [subjects[index]]: value }))

  const addStudent = () =>
    setStudents((current) => [...current, { id: makeId(), name: '', scores: {} }])

  const removeStudent = (id) =>
    setStudents((current) => current.filter((student) => student.id !== id))

  const setStudentName = (id, name) =>
    setStudents((current) =>
      current.map((student) => (student.id === id ? { ...student, name } : student)),
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

  const handleSubmit = () => {
    const validSubjects = subjects.map((s) => s.trim()).filter(Boolean)
    if (validSubjects.length === 0) {
      setError('Agrega al menos una asignatura.')
      return
    }
    const validStudents = students
      .filter((student) => student.name.trim() !== '')
      .map((student) => ({
        id: student.id,
        name: student.name.trim(),
        scores: Object.fromEntries(
          validSubjects.map((subject) => [subject, student.scores[subject] ?? null]),
        ),
        performances: Object.fromEntries(validSubjects.map((subject) => [subject, ''])),
      }))
    if (validStudents.length === 0) {
      setError('Agrega al menos un estudiante con nombre.')
      return
    }
    onLoaded({
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grado / Curso">
          <TextInput
            className="w-full"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="5° A"
          />
        </Field>
        <Field label="Docente" hint="Docente titular del curso. Cada asignatura puede llevar el suyo en su tarjeta.">
          <TextInput
            className="w-full"
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
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
            <div key={index} className="flex items-center gap-1 rounded-lg bg-slate-100 p-1.5">
              <div className="flex flex-col gap-1">
                <TextInput
                  className="w-44 border-transparent bg-transparent shadow-none"
                  value={subject}
                  onChange={(e) => renameSubject(index, e.target.value)}
                  placeholder="Asignatura"
                  aria-label={`Nombre de asignatura ${index + 1}`}
                />
                <TextInput
                  className="w-44 border-transparent bg-transparent shadow-none"
                  value={teachers[subject] ?? ''}
                  onChange={(e) => setSubjectTeacher(index, e.target.value)}
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
              <th className="px-3 py-2">Estudiante</th>
              {subjects.map((subject, index) => (
                <th key={index} className="px-3 py-2">
                  {subject || '—'}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <TextInput
                    className="w-full"
                    value={student.name}
                    onChange={(e) => setStudentName(student.id, e.target.value)}
                    placeholder="Nombre del estudiante"
                  />
                </td>
                {subjects.map((subject, index) => {
                  const draftKey = `${student.id}:${subject}`
                  const draft = scoreDrafts[draftKey]
                  return (
                    <td key={index} className="px-3 py-2">
                      <TextInput
                        className="w-20"
                        inputMode="decimal"
                        value={
                          draft ??
                          (student.scores[subject] === null ||
                          student.scores[subject] === undefined
                            ? ''
                            : String(student.scores[subject]))
                        }
                        onChange={(e) =>
                          setScoreDrafts((current) => ({
                            ...current,
                            [draftKey]: e.target.value,
                          }))
                        }
                        onBlur={(e) => commitScore(student.id, subject, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            e.currentTarget.blur()
                          }
                        }}
                        aria-label={`Nota de ${student.name || 'estudiante'} en ${subject || 'asignatura'}`}
                      />
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
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Volver
        </Button>
        <Button onClick={handleSubmit}>Generar informe</Button>
      </div>
    </div>
  )
}
