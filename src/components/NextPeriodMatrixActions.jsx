import { useRef, useState } from 'react'
import {
  assertImportSize,
  downloadPerformanceSample,
  downloadPerformanceTemplate,
  EMPTY_MATRIX_MESSAGE,
  matrixHasText,
  parsePerformanceMatrix,
} from '../utils/parser'
import { Button } from './ui'

const subjectCount = (matrix) =>
  Object.values(matrix ?? {}).filter((bands) =>
    Object.values(bands ?? {}).some((text) => String(text ?? '').trim().length > 0),
  ).length

/**
 * Next-period performance-matrix actions shared by the landing and the
 * management menu (R5/F6). The matrix is a per-tab preload: it is applied once
 * to the first created or imported period, only to empty cells with a grade,
 * and is never persisted in IndexedDB or the backup.
 *
 * `mode="downloads"` keeps the template/sample downloads available once the
 * first period exists, when a next-period preload would be a false promise.
 */
export default function NextPeriodMatrixActions({
  matrix = null,
  mode = 'nextPeriod',
  readOnly = false,
  onLoadMatrix,
  onClearMatrix,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef(null)
  const count = subjectCount(matrix)
  const hasMatrix = count > 0
  const allowLoad = mode === 'nextPeriod'

  const clearPending = () => {
    setError('')
    setNotice('')
    onClearMatrix?.()
  }

  const readMatrixFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      assertImportSize(file)
      const matrix = await parsePerformanceMatrix(await file.arrayBuffer())
      if (!matrixHasText(matrix)) {
        onClearMatrix?.()
        setNotice(EMPTY_MATRIX_MESSAGE)
        return
      }
      onLoadMatrix?.(matrix)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la matriz de desempeños.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {allowLoad ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          aria-label="Archivo de matriz del próximo período"
          disabled={readOnly}
          onChange={(event) => {
            const input = event.currentTarget
            void readMatrixFile(input.files?.[0]).finally(() => {
              input.value = ''
            })
          }}
        />
      ) : null}

      {allowLoad && hasMatrix ? (
        <div
          role="status"
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
        >
          <p className="font-medium">
            Matriz del próximo período: {count}{' '}
            {count === 1 ? 'asignatura detectada' : 'asignaturas detectadas'}.
          </p>
          <p className="mt-1 text-sky-900">
            Se aplicará al primer período que crees, solo a celdas vacías y cuando existan
            notas.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {allowLoad ? (
          hasMatrix ? (
            <>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || readOnly}
              >
                Reemplazar archivo
              </Button>
              <Button variant="secondary" onClick={clearPending} disabled={busy || readOnly}>
                Quitar matriz
              </Button>
            </>
          ) : (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || readOnly}
            >
              {busy ? 'Leyendo…' : 'Cargar desempeños del próximo período (.xlsx)'}
            </Button>
          )
        ) : null}
        <Button variant="secondary" onClick={downloadPerformanceTemplate}>
          Descargar plantilla de desempeños
        </Button>
        <Button variant="secondary" onClick={downloadPerformanceSample}>
          Descargar ejemplo de desempeños
        </Button>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
