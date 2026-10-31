import { useRef, useState } from 'react'
import { assertImportSize, downloadStudentPerformancesTemplate, finalPerformanceKey, parsePerformancesWorkbook } from '../utils/parser'
import { parseRosterNames, remainingSubjectSuggestions } from '../utils/roster'
import { Button, Field, TextArea, TextInput } from './ui'

const normalizeSubject = (value) => value.trim().toLocaleLowerCase('es')
const emptyRow = () => ({ id: `w_${Math.random().toString(36).slice(2, 10)}`, name: '' })

/**
 * Guided manual entry (spec S8): students + subjects first, a confirmation
 * stop, then the desempeños question BEFORE grades exist. Manual performances
 * hand the draft to the period editor; an Excel of per-student texts shows a
 * preview and lets the teacher pick the editor or the reports view.
 */
export default function ManualEntryWizard({ onOpenEditor, onSaveAndOpenReports, onCancel }) {
  const [step, setStep] = useState('students')
  const [grade, setGrade] = useState('')
  const [teacher, setTeacher] = useState('')
  const [subjects, setSubjects] = useState([{ id: 'subject-0', name: 'Matemáticas' }])
  const [students, setStudents] = useState([emptyRow()])
  const [rosterText, setRosterText] = useState('')
  const [performanceByKey, setPerformanceByKey] = useState(null)
  const [excelName, setExcelName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const namedSubjects = subjects.map((s) => s.name.trim()).filter(Boolean)
  const namedStudents = students.map((s) => s.name.trim()).filter(Boolean)
  const suggestions = remainingSubjectSuggestions(subjects.map((s) => s.name))

  const addSubject = () =>
    setSubjects((current) => [
      ...current,
      { id: `subject-${current.length}-${Math.random().toString(36).slice(2, 6)}`, name: '' },
    ])
  const renameSubject = (id, name) =>
    setSubjects((current) => current.map((s) => (s.id === id ? { ...s, name } : s)))
  const removeSubject = (id) => setSubjects((current) => current.filter((s) => s.id !== id))
  const addSuggested = (name) => setSubjects((current) => [...current, { id: `sug-${name}`, name }])

  const setStudentName = (id, name) =>
    setStudents((current) => current.map((s) => (s.id === id ? { ...s, name } : s)))
  const removeStudent = (id) => setStudents((current) => current.filter((s) => s.id !== id))
  const addRoster = () => {
    const names = parseRosterNames(rosterText, students.map((s) => s.name))
    if (names.length === 0) return
    setStudents((current) => [...current, ...names.map((name) => ({ ...emptyRow(), name }))])
    setRosterText('')
  }

  const validateStudentsStep = () => {
    if (namedSubjects.length === 0) return 'Agrega al menos una asignatura.'
    if (namedSubjects.length !== subjects.length) return 'Completa o quita las asignaturas sin nombre.'
    const normalized = namedSubjects.map(normalizeSubject)
    if (new Set(normalized).size !== normalized.length) return 'No repitas el nombre de una asignatura.'
    if (namedStudents.length === 0) return 'Agrega al menos un estudiante con nombre.'
    return ''
  }

  const initial = (performances = null) => ({
    grade: grade.trim(),
    teacher: teacher.trim(),
    subjects: namedSubjects,
    teachers: {},
    students: namedStudents.map((name) => ({
      name,
      scores: {},
      performances: Object.fromEntries(
        namedSubjects.map((subject) => [
          subject,
          performances?.[finalPerformanceKey(name)]?.[subject] ?? '',
        ]),
      ),
    })),
  })

  const savePayload = () => {
    const draft = initial(performanceByKey)
    return {
      ...draft,
      students: draft.students.map((student) => ({
        ...student,
        scores: Object.fromEntries(namedSubjects.map((subject) => [subject, null])),
      })),
    }
  }

  const readPerformances = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      assertImportSize(file)
      const parsed = await parsePerformancesWorkbook(await file.arrayBuffer())
      setPerformanceByKey(parsed)
      setExcelName(file.name)
      setStep('excel')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo de desempeños.')
    } finally {
      setBusy(false)
    }
  }

  const matchedKeys = performanceByKey
    ? new Set(Object.keys(performanceByKey))
    : new Set()
  const matchedStudents = performanceByKey
    ? namedStudents.filter((name) => matchedKeys.has(finalPerformanceKey(name)))
    : []
  const totalTexts = performanceByKey
    ? matchedStudents.reduce((count, name) => {
        const bySubject = performanceByKey[finalPerformanceKey(name)] ?? {}
        return (
          count +
          namedSubjects.filter((subject) => String(bySubject[subject] ?? '').trim() !== '').length
        )
      }, 0)
    : 0
  const unmatched = namedStudents.filter((name) => !matchedKeys.has(finalPerformanceKey(name)))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Carga manual del período</h2>
        <p className="mt-1 text-sm text-slate-600">
          {step === 'students'
            ? 'Primero los estudiantes y las asignaturas; después decides si cargas los desempeños.'
            : step === 'confirm'
              ? 'Revisa lo cargado antes de continuar.'
              : step === 'desempenos'
                ? 'Puedes cargar los desempeños ahora, antes de las notas.'
                : 'Revisa los desempeños cargados y elige a dónde ir.'}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {step === 'students' ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Grado / Curso">
              <TextInput
                className="w-full"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                placeholder="5° A"
              />
            </Field>
            <Field label="Docente" hint="Docente titular del curso (opcional).">
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
                <div key={subject.id} className="flex items-center gap-1 rounded-lg bg-slate-100 p-1.5">
                  <TextInput
                    className="w-44"
                    value={subject.name}
                    onChange={(event) => renameSubject(subject.id, event.target.value)}
                    placeholder="Asignatura"
                    aria-label={`Nombre de asignatura ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSubject(subject.id)}
                    aria-label={`Quitar ${subject.name || 'asignatura'}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            {suggestions.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">Asignaturas comunes:</span>
                {suggestions.map((name) => (
                  <Button
                    key={name}
                    variant="ghost"
                    size="sm"
                    onClick={() => addSuggested(name)}
                    aria-label={`Asignatura sugerida: ${name}`}
                  >
                    + {name}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Estudiantes ({namedStudents.length})</p>
            <div className="space-y-2">
              {students.map((student, index) => (
                <div key={student.id} className="flex items-center gap-2">
                  <TextInput
                    className="w-full max-w-sm"
                    value={student.name}
                    onChange={(event) => setStudentName(student.id, event.target.value)}
                    placeholder="Nombre del estudiante"
                    aria-label={`Nombre del estudiante ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStudent(student.id)}
                    aria-label={`Quitar ${student.name || 'estudiante'}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={() => setStudents((c) => [...c, emptyRow()])}>
                Agregar estudiante
              </Button>
            </div>

            <details className="mt-3 rounded-lg border border-kraft-line bg-sheet p-3">
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
                <Button variant="secondary" size="sm" onClick={addRoster}>
                  Cargar lista
                </Button>
              </div>
            </details>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const message = validateStudentsStep()
                if (message) {
                  setError(message)
                  return
                }
                setError('')
                setStep('confirm')
              }}
            >
              Continuar
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'confirm' ? (
        <div className="space-y-4 rounded-xl border border-kraft-line bg-sheet p-4">
          <p role="status" className="text-sm text-slate-800">
            Se han cargado {namedStudents.length}{' '}
            {namedStudents.length === 1 ? 'estudiante' : 'estudiantes'} y {namedSubjects.length}{' '}
            {namedSubjects.length === 1 ? 'asignatura' : 'asignaturas'}.
          </p>
          <p className="text-xs text-slate-500">{namedStudents.join(' · ')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('students')}>
              Volver
            </Button>
            <Button onClick={() => setStep('desempenos')}>Continuar</Button>
          </div>
        </div>
      ) : null}

      {step === 'desempenos' ? (
        <div className="space-y-4 rounded-xl border border-kraft-line bg-sheet p-4">
          <h3 className="text-sm font-semibold text-slate-900">¿Quieres cargar los desempeños?</h3>
          <p className="text-sm text-slate-600">
            Puedes cargarlos ahora, antes de las notas, o dejarlo para la pantalla de edición.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            aria-label="Archivo de desempeños"
            onChange={(event) => {
              const input = event.currentTarget
              void readPerformances(input.files?.[0]).finally(() => {
                input.value = ''
              })
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onOpenEditor(initial(null))}>Cargar manualmente</Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? 'Leyendo…' : 'Cargar por Excel'}
            </Button>
            <Button variant="ghost" onClick={() => void downloadStudentPerformancesTemplate()}>
              Descargar plantilla (.xlsx)
            </Button>
            <Button variant="ghost" onClick={() => onOpenEditor(initial(null))}>
              Omitir por ahora
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'excel' ? (
        <div className="space-y-4 rounded-xl border border-kraft-line bg-sheet p-4">
          <h3 className="text-sm font-semibold text-slate-900">Desempeños cargados</h3>
          <p role="status" className="text-sm text-slate-700">
            {excelName}: {totalTexts}{' '}
            {totalTexts === 1 ? 'texto cargado' : 'textos cargados'} en {matchedStudents.length}{' '}
            {matchedStudents.length === 1 ? 'estudiante' : 'estudiantes'}.
          </p>
          {unmatched.length > 0 ? (
            <p className="text-xs text-amber-800">
              Sin coincidencia en la lista: {unmatched.slice(0, 5).join(', ')}
              {unmatched.length > 5 ? '…' : ''}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('desempenos')}>
              Volver
            </Button>
            <Button variant="secondary" onClick={() => onOpenEditor(initial(performanceByKey))}>
              Ir al menú de edición
            </Button>
            <Button onClick={() => onSaveAndOpenReports(savePayload())}>
              Ir a la vista de informes
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
