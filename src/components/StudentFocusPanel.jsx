import { roundForScale, TONE_CLASSES } from '../utils/calculations'
import { Button, TextArea, TextInput } from './ui'

/**
 * Focus mode lens (S1/S2 of the UX remodel): one student at a time over the
 * same draft state the grid edits — nota, desempeño and institutional band
 * per subject. It replaces the grid while active; it never adds a second
 * copy of the data. Band is shown for the COMMITTED score: drafts commit on
 * blur, exactly like the grid inputs.
 * readOnly is enforced by the parent disabled fieldset.
 */
export default function StudentFocusPanel({
  student,
  position,
  count,
  subjects,
  scoreDrafts,
  maxScore,
  scale,
  scaleType,
  onNameChange,
  onScoreDraftChange,
  onScoreCommit,
  onPerformanceChange,
  onNavigate,
  onClose,
}) {
  if (!student) return null

  const atFirst = position <= 0
  const atLast = position >= count - 1

  const bandFor = (score) => {
    const rounded = roundForScale(score, scaleType)
    return scale.find((band) => rounded >= band.min && rounded <= band.max) ?? null
  }

  const commitOnEnter = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  return (
    <div className="rounded-xl border border-kraft-line bg-sheet p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">
          Enfoque: {student.name.trim() || 'sin nombre'}{' '}
          <span className="text-slate-500">({position + 1} de {count})</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            aria-label="Cerrar modo enfoque"
          >
            Volver a la grilla
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <TextInput
          className="w-full max-w-md"
          value={student.name}
          onChange={(event) => onNameChange(student.id, event.target.value)}
          placeholder="Nombre del estudiante"
          aria-label={`Nombre del estudiante ${position + 1} (enfoque)`}
        />
      </div>

      <div className="mt-4 space-y-4">
        {subjects.map((subject) => {
          const draft = scoreDrafts[`${student.id}:${subject.id}`]
          const score = student.scores?.[subject.id]
          const band = score === null || score === undefined ? null : bandFor(score)
          return (
            <div
              key={subject.id}
              className="rounded-lg border border-kraft-line/60 bg-paper/60 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  {subject.name || '—'}
                  {subject.teacher.trim() ? (
                    <span className="ml-2 text-xs text-slate-500">{subject.teacher.trim()}</span>
                  ) : null}
                </p>
                {band ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[band.tone] ?? TONE_CLASSES.slate}`}
                  >
                    {band.label}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-start gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500" htmlFor={`nota-${student.id}-${subject.id}`}>
                    Nota (0 a {maxScore})
                  </label>
                  <TextInput
                    id={`nota-${student.id}-${subject.id}`}
                    className="w-24"
                    inputMode="decimal"
                    value={draft ?? (score === null || score === undefined ? '' : String(score))}
                    onChange={(event) => onScoreDraftChange(student.id, subject.id, event.target.value)}
                    onBlur={(event) => onScoreCommit(student.id, subject.id, event.target.value)}
                    onKeyDown={commitOnEnter}
                    aria-label={`Nota de ${student.name || 'estudiante'} en ${subject.name || 'asignatura'}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label
                    className="text-xs text-slate-500"
                    htmlFor={`desempeno-${student.id}-${subject.id}`}
                  >
                    Desempeño
                  </label>
                  <TextArea
                    id={`desempeno-${student.id}-${subject.id}`}
                    className="w-full"
                    placeholder="Desempeño…"
                    value={student.performances?.[subject.id] ?? ''}
                    onChange={(event) => onPerformanceChange(student.id, subject.id, event.target.value)}
                    aria-label={`Desempeño de ${student.name || 'estudiante'} en ${subject.name || 'asignatura'}`}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={atFirst}
          onClick={() => onNavigate(-1)}
          aria-label="Estudiante anterior"
        >
          Anterior
        </Button>
        <span className="text-xs text-slate-500">
          Estudiante {position + 1} de {count}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={atLast}
          onClick={() => onNavigate(1)}
          aria-label="Siguiente estudiante"
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
