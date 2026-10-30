import FinalReportSheet from './FinalReportSheet'
import ReportSheet from './ReportSheet'
import { formatScore } from '../utils/calculations'
import { cx } from '../utils/cx'
import { Button, ToneBadge } from './ui'

/**
 * Management + preview view (RF-06, RF-07).
 *
 * Left: the class list ordered by institutional position.
 * Right: the report sheet for the selected student (or the computed final
 * report when `variant` is "final"). Both sheets are read-only; the final
 * annotations are edited in the final editor (F5).
 * Off-screen: a non-editable copy of the same sheet, used as the capture
 * source for PDF/ZIP so the exported file never shows input boxes.
 */
export default function ReportDashboard({
  config,
  report,
  rankedStudents,
  selectedStudentId,
  onSelectStudent,
  onEditFinal,
  printSheetRef,
  variant = 'period',
  readOnly = false,
}) {
  const scaleType = config.scaleType ?? 'decimal'
  const selected =
    rankedStudents.find((student) => student.id === selectedStudentId) ?? rankedStudents[0]

  return (
    <div className="report-grid grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="no-print rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Estudiantes</h2>
          <span className="text-xs text-slate-400">{rankedStudents.length}</span>
        </div>
        <ol className="space-y-1">
          {rankedStudents.map((student) => {
            const active = student.id === selected?.id
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => onSelectStudent(student.id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition',
                    active ? 'bg-slate-900 text-white' : 'hover:bg-slate-100',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      active ? 'bg-white/20' : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {student.position ?? '–'}
                  </span>
                  <span className="flex-1 truncate">{student.name}</span>
                  <span
                    className={cx(
                      'tabular-nums text-xs font-semibold',
                      active ? 'text-white' : 'text-slate-500',
                    )}
                  >
                    {student.average === null || student.average === undefined
                      ? '—'
                      : student.average.toFixed(2)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Escala
          </p>
          <ul className="space-y-1">
            {config.scale.map((band) => (
              <li key={band.key} className="flex items-center justify-between text-xs">
                <ToneBadge tone={band.tone}>{band.label}</ToneBadge>
                <span className="tabular-nums text-slate-500">
                  {formatScore(band.min, scaleType)} – {formatScore(band.max, scaleType)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="no-print min-w-0">
        {variant === 'final' ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              El informe final es de solo lectura: los desempeños se editan aparte.
            </p>
            <Button onClick={onEditFinal}>Editar desempeños finales</Button>
          </div>
        ) : null}
        <div className="overflow-x-auto pb-4">
          {selected ? (
            variant === 'final' ? (
              <FinalReportSheet config={config} report={report} student={selected} />
            ) : (
              <ReportSheet
                config={config}
                report={report}
                student={selected}
                editable={false}
                readOnly={readOnly}
              />
            )
          ) : (
            <p className="text-sm text-slate-500">No hay estudiantes para mostrar.</p>
          )}
        </div>
      </div>

      {/* Off-screen capture source: same sheet, non-editable. In print media
          this layer becomes the only visible content. */}
      <div aria-hidden="true" className="capture-layer">
        {selected ? (
          variant === 'final' ? (
            <FinalReportSheet ref={printSheetRef} config={config} report={report} student={selected} />
          ) : (
            <ReportSheet
              ref={printSheetRef}
              config={config}
              report={report}
              student={selected}
              editableScores={false}
            />
          )
        ) : null}
      </div>
    </div>
  )
}
