import { formatScore, qualitativeFor, roundForScale, toneFor } from '../utils/calculations'
import { cx } from '../utils/cx'
import { Info, SignatureField, ToneBadge } from './ui'

/**
 * The printable final report sheet ("quinto informe") for a single student.
 *
 * One column per period report plus the cross-period mean per subject. The
 * "Promedio" column is the raw mean (two decimals) and the "Valoración" column
 * applies the institutional rounding rule to assign the qualitative band.
 *
 * The "Desempeño" column shows the final-report annotations (editable when
 * `editable`): unlike period sheets, this text belongs to the final document
 * itself and is keyed by student NAME so it survives period re-imports.
 *
 * `editable` renders the cells as textareas. The exported/printed copy uses
 * `editable={false}`, so the capture shows clean text instead of input boxes.
 */
export default function FinalReportSheet({
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
  const periodLabels = report.periodLabels ?? []
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
            <p className="text-sm text-slate-500">
              Informe académico final
              {config.period ? ` · ${config.period}` : ''}
              {periodLabels.length ? ` · ${periodLabels.length} informes promediados` : ''}
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
            <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="border border-slate-200 px-3 py-2">Asignatura</th>
              {periodLabels.map((label) => (
                <th
                  key={label}
                  className="w-14 border border-slate-200 px-2 py-2 text-center"
                  title={label}
                >
                  {label}
                </th>
              ))}
              <th className="w-20 border border-slate-200 px-2 py-2 text-center">Promedio</th>
              <th className="w-28 border border-slate-200 px-3 py-2 text-center">Valoración</th>
              <th className="border border-slate-200 px-3 py-2">Desempeño</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => {
              const average = student.scores?.[subject]
              const series = student.periodScores?.[subject] ?? []
              const rounded = average === null || average === undefined ? null : roundForScale(average, scaleType)
              const label = qualitativeFor(rounded, scale)
              const tone = toneFor(rounded, scale)
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
                  {periodLabels.map((periodLabel, periodIndex) => {
                    const cell = series[periodIndex]
                    return (
                      <td
                        key={periodLabel}
                        className="border border-slate-200 px-2 py-2 text-center text-xs tabular-nums text-slate-600"
                      >
                        {cell === null || cell === undefined ? '—' : formatScore(cell, scaleType)}
                      </td>
                    )
                  })}
                  <td className="border border-slate-200 px-2 py-2 text-center font-semibold tabular-nums text-slate-900">
                    {average === null || average === undefined ? '—' : average.toFixed(2)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center">
                    {label ? <ToneBadge tone={tone}>{label}</ToneBadge> : '—'}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 align-top">
                    {editable ? (
                      <textarea
                        className="min-h-[56px] w-full resize-y rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400 read-only:bg-slate-50 read-only:text-slate-700"
                        placeholder="Juicio valorativo final…"
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
            Promedio general final{' '}
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
              <span className="text-sm text-slate-400">—</span>
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
