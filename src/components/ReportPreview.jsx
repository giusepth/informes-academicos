import FinalReportSheet from './FinalReportSheet'
import ReportSheet from './ReportSheet'
import { Button } from './ui'

/**
 * On-screen HTML print preview for a single report (RF-07).
 *
 * Renders the clean (non-editable) sheet inside a full-screen overlay — either
 * a period sheet or the final report depending on `variant`. The overlay is
 * `no-print`, so printing relies on the existing `.capture-layer` (which
 * already holds the clean sheet of the selected student): only that sheet
 * reaches the printer, never the toolbar or the preview chrome.
 */
export default function ReportPreview({ config, report, student, variant = 'period', onClose }) {
  return (
    <div className="no-print fixed inset-0 z-40 overflow-auto bg-slate-100">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Vista previa del informe</h2>
          <span className="text-xs text-slate-500">También podés imprimir con Ctrl + P</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()}>Imprimir</Button>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>

      <div className="px-4 py-6">
        {variant === 'final' ? (
          <FinalReportSheet config={config} report={report} student={student} />
        ) : (
          <ReportSheet config={config} report={report} student={student} editable={false} />
        )}
      </div>
    </div>
  )
}
