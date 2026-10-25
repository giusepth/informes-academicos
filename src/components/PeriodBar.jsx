import { useRef, useState } from 'react'
import { buildBackupWorkbook, parseWorkbook } from '../utils/parser'
import { Button } from './ui'

/**
 * Period management bar (RF-03 + "quinto informe"): switches between period
 * reports, lets the teacher open the computed final report and adds new
 * periods either from an imported spreadsheet or by duplicating the active
 * structure as an empty shell to fill by hand.
 */
export default function PeriodBar({
  reports,
  activeReportId,
  activeTab,
  onSelectReport,
  onSelectFinal,
  onImportReport,
  onDuplicate,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const readFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const data = await parseWorkbook(await file.arrayBuffer())
      onImportReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setBusy(false)
    }
  }

  const handleBackup = async () => {
    setBusy(true)
    setError('')
    try {
      await buildBackupWorkbook(reports)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el backup.')
    } finally {
      setBusy(false)
    }
  }

  const finalLabel = `Informe ${reports.length + 1} (final)`

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <span className="text-sm font-semibold text-slate-700">Gestión de informes</span>

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

      <span className="flex-1" />

      <Button
        variant="secondary"
        size="sm"
        disabled={busy || activeTab !== 'period'}
        onClick={onDuplicate}
        title="Copia el informe activo con las notas en blanco"
      >
        Nuevo periodo en blanco
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
      >
        {busy ? 'Leyendo…' : 'Importar Excel (periodo)'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || reports.length === 0}
        onClick={handleBackup}
        title="Descarga un .xlsx con una hoja por informe (notas, docentes y desempeños). Podés volver a importarlo más tarde."
      >
        Exportar backup (.xlsx)
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => readFile(e.target.files?.[0])}
      />

      {error ? (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  )
}
