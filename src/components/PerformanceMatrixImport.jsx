import { useRef, useState } from 'react'
import {
  assertImportSize,
  EMPTY_MATRIX_MESSAGE,
  matrixHasText,
  parsePerformanceMatrix,
} from '../utils/parser'
import { Button } from './ui'

const countLabel = (count, singular, plural) =>
  `${count} ${count === 1 ? singular : plural}`

const SCOPES = {
  period: {
    titleId: 'period-matrix-title',
    title: 'Matriz de desempeños del período',
    description:
      'Completa solo los casilleros vacíos de este período. No se guarda en el respaldo: solo quedan los textos aplicados.',
    fileLabel: 'Archivo de matriz del período',
    applyLabel: 'Aplicar a este período',
  },
  final: {
    titleId: 'final-matrix-title',
    title: 'Matriz de desempeños del informe final',
    description:
      'Completa solo los casilleros vacíos del informe final. No se guarda en el respaldo: solo quedan los textos aplicados.',
    fileLabel: 'Archivo de matriz del informe final',
    applyLabel: 'Aplicar al informe final',
  },
}

/**
 * Local performance-matrix import shared by the period editor and the final
 * editor (R4.4/F5). The matrix lives only in its draft: it is applied to empty
 * cells on demand and is never persisted in IndexedDB or the backup.
 */
export default function PerformanceMatrixImport({
  scope = 'period',
  matrix = null,
  stats = null,
  readOnly = false,
  notice = '',
  applyDisabled = false,
  onLoadMatrix,
  onClearMatrix,
  onApply,
}) {
  const copy = SCOPES[scope] ?? SCOPES.period
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [localNotice, setLocalNotice] = useState('')
  const fileInputRef = useRef(null)

  const readMatrixFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    setLocalNotice('')
    try {
      assertImportSize(file)
      const next = await parsePerformanceMatrix(await file.arrayBuffer())
      if (!matrixHasText(next)) {
        // Replacing a loaded matrix with the blank template must not leave
        // the previous one silently armed.
        onClearMatrix?.()
        setLocalNotice(EMPTY_MATRIX_MESSAGE)
        return
      }
      onLoadMatrix?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la matriz de desempeños.')
    } finally {
      setBusy(false)
    }
  }

  const subjectCount = Object.keys(matrix ?? {}).length
  const message = localNotice || notice

  const clearMatrix = () => {
    setLocalNotice('')
    setError('')
    onClearMatrix?.()
  }

  return (
    <section
      aria-labelledby={copy.titleId}
      className="rounded-xl border border-sky-200 bg-sky-50/60 p-4"
    >
      <h3 id={copy.titleId} className="text-sm font-semibold text-slate-900">
        {copy.title}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{copy.description}</p>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-slate-500">
        <li>Descarga la plantilla y escribe un texto por banda (Bajo, Básico, Alto, Superior).</li>
        <li>Carga el archivo aquí.</li>
        <li>Revisa el resumen: solo se llenan los vacíos.</li>
        <li>Aplica: lo que ya escribiste no se reemplaza.</li>
      </ol>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        aria-label={copy.fileLabel}
        disabled={readOnly}
        onChange={(event) => {
          const input = event.currentTarget
          void readMatrixFile(input.files?.[0]).finally(() => {
            input.value = ''
          })
        }}
      />

      {matrix && stats ? (
        <div
          role="status"
          className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <p className="font-medium text-slate-900">
            Matriz cargada: {countLabel(subjectCount, 'asignatura detectada', 'asignaturas detectadas')}.
          </p>
          <p className="mt-1">
            {countLabel(stats.fillable, 'casillero a completar', 'casilleros a completar')} ·{' '}
            {countLabel(stats.ownText, 'con texto propio', 'con texto propio')} ·{' '}
            {countLabel(stats.missingScore, 'sin nota', 'sin nota')}
            {stats.unmatched > 0
              ? ` · ${countLabel(stats.unmatched, 'casillero sin coincidencia', 'casilleros sin coincidencia')}`
              : ''}.
          </p>
          <p className="mt-1 text-slate-600">
            Se completan solo los casilleros vacíos; los textos que ya escribiste no se reemplazan.
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {matrix ? (
          <>
            <Button onClick={onApply} disabled={busy || readOnly || applyDisabled}>
              {copy.applyLabel}
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || readOnly}
            >
              {busy ? 'Leyendo…' : 'Reemplazar matriz'}
            </Button>
            <Button variant="ghost" onClick={clearMatrix} disabled={busy || readOnly}>
              Quitar matriz
            </Button>
          </>
        ) : (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || readOnly}
          >
            {busy ? 'Leyendo…' : 'Cargar matriz (.xlsx)'}
          </Button>
        )}
      </div>

      {message ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {message}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}
