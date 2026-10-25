import { useRef, useState } from 'react'
import { assertImportSize, downloadTemplate, parseBackupWorkbook, parseWorkbook } from '../utils/parser'
import ManualEntryForm from './ManualEntryForm'
import { Button } from './ui'

/**
 * Entry point selector (RF-02): import a tabular .xlsx file or build the data
 * by hand. Owns the file reading and error surfacing.
 *
 * Imported workbooks are tried as MULTI-sheet backups first
 * (`parseBackupWorkbook`), then as a single period sheet (`parseWorkbook`).
 * One sheet and one sheet only still loads a single "Informe 1"; a workbook
 * with several Informe sheets restores the whole multi-period session.
 */
export default function DataInputMode({
  onLoaded,
  onLoadedBackup,
  onOpenSettings,
  hasConfig,
  maxScore = 5,
  readOnly = false,
}) {
  const [mode, setMode] = useState('choose')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const readFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      assertImportSize(file)
      const buffer = await file.arrayBuffer()
      try {
        const { reports, skipped } = await parseBackupWorkbook(buffer)
        if (reports.length > 0 && onLoadedBackup) {
          onLoadedBackup(reports, skipped)
          return
        }
      } catch {
        // Not a backup workbook: fall through to the single-period import.
      }
      const data = await parseWorkbook(buffer)
      onLoaded(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setBusy(false)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    if (readOnly) return
    readFile(event.dataTransfer.files?.[0])
  }

  if (mode === 'manual') {
    return (
      <ManualEntryForm onCancel={() => setMode('choose')} onLoaded={onLoaded} maxScore={maxScore} />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition',
            dragging ? 'border-slate-500 bg-slate-50' : 'border-slate-300 bg-white',
          ].join(' ')}
        >
          <p className="text-base font-semibold text-slate-800">Importar Excel (.xlsx)</p>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            Arrastra el archivo aquí o elígelo manualmente.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => readFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || readOnly}
            >
              {busy ? 'Leyendo…' : 'Elegir archivo'}
            </Button>
            <Button variant="secondary" onClick={downloadTemplate}>
              Descargar plantilla
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-base font-semibold text-slate-800">Carga manual</p>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            Carga grado, docente, asignaturas y estudiantes a mano.
          </p>
          <Button variant="secondary" onClick={() => setMode('manual')} disabled={readOnly}>
            Crear manualmente
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span>
          {hasConfig
            ? 'Escala y escudo configurados.'
            : 'Todavía no configuraste la escala ni el escudo.'}
        </span>
        <Button variant="ghost" size="sm" onClick={onOpenSettings}>
          Abrir configuración
        </Button>
      </div>
    </div>
  )
}
