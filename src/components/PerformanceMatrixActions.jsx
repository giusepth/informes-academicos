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
 * Shared desempeño-matrix actions: load an .xlsx, download the template or a
 * sample, and show the pending payload with replace/remove controls. The
 * landing and the management menu consume this same component so their copy
 * and behavior never drift (R5).
 */
export default function PerformanceMatrixActions({
  pendingMatrix = null,
  onLoadMatrix,
  onClearMatrix,
  onApplyToFinal,
  readOnly = false,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef(null)
  const pendingCount = subjectCount(pendingMatrix)
  const hasPending = pendingCount > 0

  const readMatrixFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      assertImportSize(file)
      const matrix = await parsePerformanceMatrix(await file.arrayBuffer())
      // A blank matrix (the template loaded unedited) has nothing to apply:
      // say so instead of arming a pending payload that would never fill.
      if (!matrixHasText(matrix)) {
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        aria-label="Archivo de matriz del informe final"
        onChange={(event) => {
          const input = event.currentTarget
          void readMatrixFile(input.files?.[0]).finally(() => {
            input.value = ''
          })
        }}
      />

      {hasPending ? (
        <div
          role="status"
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
        >
          <p className="font-medium">
            Matriz del informe final: {pendingCount}{' '}
            {pendingCount === 1 ? 'asignatura detectada' : 'asignaturas detectadas'}.
          </p>
          <p className="mt-1 text-sky-900">
            Se aplicará solo al informe final, en los casilleros de desempeño vacíos.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || readOnly}
        >
          {busy ? 'Leyendo…' : hasPending ? 'Reemplazar archivo' : 'Cargar matriz del informe final (excel)'}
        </Button>
        {hasPending && onClearMatrix ? (
          <Button variant="secondary" onClick={onClearMatrix} disabled={busy || readOnly}>
            Quitar matriz
          </Button>
        ) : null}
        {hasPending && onApplyToFinal ? (
          <Button variant="secondary" onClick={onApplyToFinal} disabled={busy || readOnly}>
            Aplicar al informe final
          </Button>
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
