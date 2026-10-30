import { formatScore, qualitativeFor, roundForScale, toneFor } from '../utils/calculations'
import { cx } from '../utils/cx'
import { Info, SignatureField, TextArea, ToneBadge } from './ui'

/**
 * The printable report sheet for a single student (RF-05, RF-06, RF-07).
 *
 * `editable` renders the "desempeño" cells as textareas for on-screen editing.
 * The exported/printed copy uses `editable={false}` so the capture shows clean
 * text instead of input boxes.
 *
 * Scores are always static here: period scores are edited in the period
 * editor (R4), and the final sheet only edits performance annotations.
 *
 * Score display and institutional rounding follow `config.scaleType`
 * (1.0–5.0 decimal or 1–100 centesimal).
 */
export default function ReportSheet({
  ref,
  config,
  report,
  student,
  editable = false,
  readOnly = false,
  onPerformanceChange,
  className,
}) {
  const subjects = report.subjects
  const scale = config.scale
  const scaleType = config.scaleType ?? 'decimal'
  const teachers = report.teachers ?? {}
  const hasSubjectTeachers = subjects.some((subject) => teachers[subject])
  return (
    <div
      ref={ref}
      className={cx(
        'report-sheet relative mx-auto w-[794px] overflow-hidden rounded-xl border border-slate-200 bg-white p-10 shadow-sm',
        className,
      )}
    >
      {config.logo ? (
        <img
          src={config.logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 w-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 opacity-10"
        />
      ) : null}

      <div className="relative z-10">
        <header className="flex items-center gap-4 border-b border-slate-200 pb-4">
          {config.logo ? (
            <img src={config.logo} alt="Escudo institucional" className="h-16 w-16 object-contain" />
          ) : null}
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">
              {config.institution || 'Institución educativa'}
            </h1>
            <p className="text-sm text-slate-600">
              Informe académico{config.period ? ` · ${config.period}` : ''}
            </p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Info label="Estudiante" value={student.name} />
          <Info label="Grado / Curso" value={report.grade || '—'} />
          <Info
            label="Docente"
            value={
              report.teacher ||
              (hasSubjectTeachers ? 'Por asignatura (ver detalle de cada materia)' : '—')
            }
          />
          <Info label="Puesto" value={student.position ? `${student.position}°` : '—'} />
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="border border-slate-200 px-3 py-2">Asignatura</th>
              <th className="w-16 border border-slate-200 px-3 py-2 text-center">Nota</th>
              <th className="w-28 border border-slate-200 px-3 py-2 text-center">Valoración</th>
              <th className="border border-slate-200 px-3 py-2">Desempeño</th>
            </tr>
          </thead>
          <tbody>
          {subjects.map((subject) => {
            const score = student.scores?.[subject]
            // Institutional rounding applies to EVERY qualitative lookup,
            // including per-subject cells: a raw 2.92 sits in the gap
            // between bands, but its rounded 3.0 is Básico.
            const roundedScore =
              score === null || score === undefined ? null : roundForScale(score, scaleType)
            const tone = toneFor(roundedScore, scale)
            const label = qualitativeFor(roundedScore, scale)
              return (
                <tr key={subject}>
                  <td className="border border-slate-200 px-3 py-2 align-top">
                    <span className="font-medium text-slate-800">{subject}</span>
                    {teachers[subject] ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        Docente: {teachers[subject]}
                      </span>
                    ) : null}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">
                    {score === null || score === undefined ? '—' : formatScore(score, scaleType)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center">
                    {label ? <ToneBadge tone={tone}>{label}</ToneBadge> : '—'}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 align-top">
                    {editable ? (
                      <TextArea
                        placeholder="Juicio valorativo del docente…"
                        value={student.performances?.[subject] ?? ''}
                        readOnly={readOnly}
                        onChange={(e) => onPerformanceChange?.(student.id, subject, e.target.value)}
                      />
                    ) : (
                      <span className="block whitespace-pre-wrap text-slate-700">
                        {student.performances?.[subject] || ' '}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <footer className="mt-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div className="text-sm text-slate-600">
            Promedio final{' '}
            <span className="ml-1 text-lg font-bold tabular-nums text-slate-900">
              {student.average === null || student.average === undefined
                ? '—'
                : student.average.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Valoración general</span>
            {student.qualitative ? (
              <ToneBadge tone={student.tone}>{student.qualitative}</ToneBadge>
            ) : (
              <span className="text-sm text-slate-600">—</span>
            )}
          </div>
        </footer>

        <section className="mt-10 grid grid-cols-2 gap-10 text-center">
          <SignatureField label="Firma del Docente" />
          <SignatureField label="Firma del Rector" />
        </section>
      </div>
    </div>
  )
}
