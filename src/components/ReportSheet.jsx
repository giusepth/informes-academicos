import { qualitativeFor, toneFor } from '../utils/calculations'
import { cx } from '../utils/cx'
import { ToneBadge } from './ui'

/**
 * The printable report sheet for a single student (RF-05, RF-06, RF-07).
 *
 * `editable` renders the "desempeño" cells as textareas for on-screen editing.
 * The exported/printed copy uses `editable={false}` so the capture shows clean
 * text instead of input boxes.
 */
export default function ReportSheet({
  ref,
  config,
  report,
  student,
  editable = false,
  onPerformanceChange,
  className,
}) {
  const subjects = report.subjects
  const scale = config.scale

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
            <p className="text-sm text-slate-500">
              Informe académico{config.period ? ` · ${config.period}` : ''}
            </p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Info label="Estudiante" value={student.name} />
          <Info label="Grado / Curso" value={report.grade || '—'} />
          <Info label="Docente" value={report.teacher || '—'} />
          <Info label="Puesto" value={student.position ? `${student.position}°` : '—'} />
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="border border-slate-200 px-3 py-2">Asignatura</th>
              <th className="w-16 border border-slate-200 px-3 py-2 text-center">Nota</th>
              <th className="w-28 border border-slate-200 px-3 py-2 text-center">Valoración</th>
              <th className="border border-slate-200 px-3 py-2">Desempeño</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => {
              const score = student.scores?.[subject]
              const tone = toneFor(score, scale)
              const label = qualitativeFor(score, scale)
              return (
                <tr key={subject}>
                  <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800">
                    {subject}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">
                    {score === null || score === undefined ? '—' : score.toFixed(1)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center">
                    {label ? <ToneBadge tone={tone}>{label}</ToneBadge> : '—'}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 align-top">
                    {editable ? (
                      <textarea
                        className="min-h-[56px] w-full resize-y rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
                        placeholder="Juicio valorativo del docente…"
                        value={student.performances?.[subject] ?? ''}
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
              {student.roundedAverage === null || student.roundedAverage === undefined
                ? '—'
                : student.roundedAverage.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Valoración general</span>
            {student.qualitative ? (
              <ToneBadge tone={student.tone}>{student.qualitative}</ToneBadge>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-slate-500">{label}:</span>
      <span className="text-slate-800">{value}</span>
    </div>
  )
}
