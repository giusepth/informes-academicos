import { useRef, useState } from 'react'
import {
  assertImportSize,
  buildBackupWorkbook,
  downloadTemplate,
  parseBackupWorkbook,
  parseWorkbook,
} from '../utils/parser'
import NextPeriodMatrixActions from './NextPeriodMatrixActions'
import { Button } from './ui'

/**
 * Management menu (R3): the single place to start work, switch periods,
 * manage desempeño matrices and back up or clear data. Each responsibility
 * lives in its own semantic section so destructive actions never share a row
 * with period navigation or file imports.
 */
export default function ManagementMenu({
  reports = [],
  finalPerformances = {},
  activeReport = null,
  config = null,
  nextPeriodMatrix = null,
  readOnly = false,
  onNewReport,
  onLoadedBackup,
  onCreateManual,
  onNewBlank,
  onOpenReport,
  onEditReport,
  onEditFinal,
  onOpenFinal,
  onOpenSettings,
  onLoadNextMatrix,
  onClearNextMatrix,
  onOpenClear,
}) {
  const [busy, setBusy] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [error, setError] = useState('')
  const [backupError, setBackupError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const readWorkbook = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      assertImportSize(file)
      const buffer = await file.arrayBuffer()
      try {
        const { reports: restored, skipped, finalPerformances: restoredFinals } =
          await parseBackupWorkbook(buffer)
        // A backup is more than one report sheet or a final-annotations sheet.
        // A stray worksheet next to one report must not turn a period import
        // into a silent full restore.
        const isBackup =
          restored.length > 1 ||
          Object.keys(restoredFinals ?? {}).length > 0
        if (isBackup) {
          if (reports.length > 0) {
            setError(
              'Ese archivo parece un backup completo. Para restaurarlo, elimina primero los informes actuales con Limpiar informes.',
            )
            return
          }
          if (onLoadedBackup) {
            onLoadedBackup(restored, skipped, restoredFinals)
            return
          }
        }
      } catch {
        // Not a backup workbook: fall through to the single-period import.
      }
      // With existing work, importing is always a new period: read only the
      // first sheet through parseWorkbook so student ids are assigned and the
      // current session is preserved. With no work it is the first report.
      const data = await parseWorkbook(buffer)
      onNewReport?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setBusy(false)
    }
  }

  const handleBackup = async () => {
    setBackupBusy(true)
    setBackupError('')
    try {
      await buildBackupWorkbook(reports, finalPerformances)
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'No se pudo generar el backup.')
    } finally {
      setBackupBusy(false)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    if (readOnly) return
    void readWorkbook(event.dataTransfer.files?.[0])
  }

  const hasReports = reports.length > 0
  const finalLabel = `Informe ${reports.length + 1} (final)`
  const studentCount = activeReport?.students?.length ?? 0
  const subjectCount = activeReport?.subjects?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Gestión de informes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Empieza un trabajo, retoma un período o prepara los desempeños y el respaldo.
        </p>
      </div>

      <section
        aria-labelledby="menu-new-work"
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h3 id="menu-new-work" className="text-base font-semibold text-slate-900">
          Nuevo trabajo
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={[
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition',
              dragging ? 'border-slate-500 bg-slate-50' : 'border-slate-300 bg-slate-50/60',
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
              onChange={(event) => {
                const input = event.currentTarget
                void readWorkbook(input.files?.[0]).finally(() => {
                  input.value = ''
                })
              }}
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

          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-base font-semibold text-slate-800">Carga manual</p>
            <p className="mt-1 mb-4 text-sm text-slate-500">
              Carga grado, docente, asignaturas y estudiantes a mano.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={onCreateManual} disabled={readOnly}>
                Crear manualmente
              </Button>
              {hasReports ? (
                <Button
                  variant="secondary"
                  onClick={onNewBlank}
                  disabled={readOnly || !activeReport}
                  title="Copia el informe activo con las notas en blanco"
                >
                  Nuevo periodo en blanco
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="menu-current-work"
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h3 id="menu-current-work" className="text-base font-semibold text-slate-900">
          Trabajo actual
        </h3>
        {hasReports ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Estado del período activo:</span>{' '}
              {activeReport?.label ?? 'Sin período'} · {studentCount}{' '}
              {studentCount === 1 ? 'estudiante' : 'estudiantes'} · {subjectCount}{' '}
              {subjectCount === 1 ? 'asignatura' : 'asignaturas'}
            </p>

            <div className="flex flex-wrap gap-2">
              {reports.map((report, index) => (
                <Button
                  key={report.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenReport?.(report.id)}
                >
                  {report.label ?? `Informe ${index + 1}`}
                </Button>
              ))}
              <Button variant="secondary" size="sm" onClick={onOpenFinal}>
                {finalLabel}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => activeReport && onOpenReport?.(activeReport.id)}
                disabled={!activeReport}
              >
                Abrir boletín
              </Button>
              <Button
                variant="secondary"
                onClick={() => activeReport && onEditReport?.(activeReport.id)}
                disabled={readOnly || !activeReport}
              >
                Editar período
              </Button>
              <Button
                variant="secondary"
                onClick={onEditFinal}
                disabled={readOnly || !hasReports}
              >
                Editar desempeños finales
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Todavía no hay períodos. Importa un Excel o crea uno manualmente para empezar.
          </p>
        )}
      </section>

      <section
        aria-labelledby="menu-performances"
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h3 id="menu-performances" className="text-base font-semibold text-slate-900">
          Desempeños
        </h3>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          {hasReports
            ? 'Descarga la plantilla y el ejemplo. La matriz de cada período se carga dentro de su editor; la del informe final, en «Editar desempeños finales».'
            : 'Precarga la matriz del próximo período o descarga la plantilla y el ejemplo. Se aplicará una sola vez al primer período que crees o importes.'}
        </p>
        <NextPeriodMatrixActions
          matrix={nextPeriodMatrix}
          mode={hasReports ? 'downloads' : 'nextPeriod'}
          readOnly={readOnly}
          onLoadMatrix={onLoadNextMatrix}
          onClearMatrix={onClearNextMatrix}
        />
      </section>

      <section
        aria-labelledby="menu-backup"
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h3 id="menu-backup" className="text-base font-semibold text-slate-900">
          Respaldo y datos
        </h3>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleBackup}
            disabled={backupBusy || !hasReports}
            title="Descarga un .xlsx con una hoja por informe y los desempeños del informe final."
          >
            {backupBusy ? 'Generando…' : 'Exportar backup (.xlsx)'}
          </Button>
        </div>
        {backupError ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {backupError}
          </p>
        ) : null}

        <div className="mt-5 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <p className="text-sm font-semibold text-red-900">Zona destructiva</p>
          <p className="mt-1 text-sm text-red-800">
            Borra los informes, los desempeños finales y la matriz del informe final pendiente. Conserva
            la configuración institucional.
          </p>
          <Button
            variant="danger"
            className="mt-3"
            onClick={onOpenClear}
            disabled={readOnly || !hasReports}
          >
            Limpiar informes
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span>
          {config
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
