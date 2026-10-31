import { Button } from './ui'

/**
 * Period navigation inside a report view. All editing lives in the period
 * editor (R4); this bar only switches periods and opens the final report.
 */
export default function PeriodBar({
  reports,
  activeReportId,
  activeTab,
  onSelectReport,
  onSelectFinal,
}) {
  const finalLabel = `Informe ${reports.length + 1} (final)`

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-kraft-line bg-sheet p-3">
      <span className="text-sm font-semibold text-slate-700">Períodos</span>

      {reports.map((report, index) => (
        <Button
          key={report.id}
          variant={activeTab === 'period' && report.id === activeReportId ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSelectReport(report.id)}
        >
          {report.label ?? `Informe ${index + 1}`}
        </Button>
      ))}
      <Button
        variant={activeTab === 'final' ? 'primary' : 'secondary'}
        size="sm"
        onClick={onSelectFinal}
        disabled={reports.length === 0}
      >
        {finalLabel}
      </Button>
    </div>
  )
}
