import { useState } from 'react'
import { flushSync } from 'react-dom'
import { buildPdfZip, downloadBlob, safeFileName } from '../utils/exporter'
import { Button } from './ui'

/** Waits two animation frames so the DOM reflects the latest selection. */
function nextPaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/**
 * Export panel (RF-07): print, on-screen preview and full-class ZIP.
 *
 * The individual action opens an HTML print preview (via `onPreview`) instead of
 * auto-downloading a PDF.
 *
 * ZIP generation reuses the single off-screen capture element: for each student
 * it switches the selection synchronously (flushSync) and captures. That keeps
 * the DOM small instead of mounting N sheets at once.
 */
export default function ExportToolbar({
  report,
  students,
  selectedStudentId,
  onSelectStudent,
  getPrintElement,
  onPreview,
  onBackupExport,
  onNotify,
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')

  const withBusy = async (task) => {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error al exportar.'
      setError(message)
      onNotify?.(`Error: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleZip = () =>
    withBusy(async () => {
      const previousId = selectedStudentId
      setProgress({ done: 0, total: students.length })

      const blob = await buildPdfZip(
        students,
        async (id) => {
          flushSync(() => onSelectStudent(id))
          await nextPaint()
          return getPrintElement()
        },
        (done, total) => setProgress({ done, total }),
      )

      flushSync(() => onSelectStudent(previousId))
      const slug = safeFileName(report.grade || 'curso')
      downloadBlob(blob, `informes-${slug}.zip`)
      onNotify?.(`ZIP generado con ${students.length} informes.`)
      setProgress({ done: 0, total: 0 })
    })

  const handleBackup = () =>
    withBusy(async () => {
      await onBackupExport?.()
    })

  return (
    <div className="no-print rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handlePrint} disabled={busy}>
          Imprimir
        </Button>
        <Button variant="secondary" onClick={onPreview} disabled={busy}>
          Vista previa
        </Button>
        <Button variant="secondary" onClick={handleZip} disabled={busy}>
          {busy && progress.total > 0
            ? `Generando ZIP… ${progress.done}/${progress.total}`
            : 'Generar ZIP (todos)'}
        </Button>
        {onBackupExport ? (
          <Button variant="secondary" onClick={handleBackup} disabled={busy}>
            {busy ? 'Generando…' : 'Descargar respaldo (.xlsx)'}
          </Button>
        ) : null}
        {busy ? (
          <span className="text-xs text-slate-500">
            Renderizando informes, puede demorar…
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  )
}
