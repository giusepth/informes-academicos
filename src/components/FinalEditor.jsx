import { useEffect, useState } from 'react'
import { DEFAULT_SCALE, formatScore } from '../utils/calculations'
import {
  applyMatrixToReport,
  finalPerformanceKey,
  matrixApplicationStats,
} from '../utils/parser'
import PerformanceMatrixImport from './PerformanceMatrixImport'
import { Button } from './ui'

/**
 * Builds the editor's local draft once from the stored annotations. Students
 * without text need no entry, and annotations for a student no longer present
 * are preserved instead of being dropped on save.
 */
const buildBase = (initialPerformances) => ({ ...(initialPerformances ?? {}) })

/** Report-shaped view of the draft, used by the shared matrix helpers. */
const draftReport = (report, draft) => ({
  subjects: report?.subjects ?? [],
  students: (report?.students ?? []).map((student) => ({
    id: student.id,
    name: student.name,
    scores: student.scores ?? {},
    performances: draft[finalPerformanceKey(student.name)] ?? {},
  })),
})

/**
 * Final-report editor (F5). The bulletin is read-only; this screen is the only
 * place where final desempeño annotations change. It owns a local draft, loads
 * the final matrix with the same shared import as the period editor, and never
 * edits averages or calculated results.
 */
export default function FinalEditor({
  report,
  initialPerformances = {},
  scale = DEFAULT_SCALE,
  scaleType = 'decimal',
  readOnly = false,
  onSave,
  onCancel,
  onDirtyChange,
}) {
  // Freeze the opening snapshot: a remote resync may replace the final report,
  // but it must never replace this draft behind the teacher's back.
  const [base] = useState(() => buildBase(initialPerformances))
  const [draft, setDraft] = useState(base)
  const [matrix, setMatrix] = useState(null)
  const [matrixNotice, setMatrixNotice] = useState('')

  const snapshot = JSON.stringify(draft)
  const baseSnapshot = JSON.stringify(base)
  const dirty = snapshot !== baseSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setPerformance = (key, subject, text) =>
    setDraft((current) => ({
      ...current,
      [key]: { ...(current[key] ?? {}), [subject]: text },
    }))

  const preview = matrix ? draftReport(report, draft) : null
  const matrixStats = preview
    ? matrixApplicationStats(preview, matrix, scale, scaleType)
    : null

  const handleLoadMatrix = (nextMatrix) => {
    setMatrix(nextMatrix)
    setMatrixNotice('')
  }

  const handleClearMatrix = () => {
    setMatrix(null)
    setMatrixNotice('')
  }

  const handleApplyMatrix = () => {
    if (!matrix || readOnly) return
    const current = draftReport(report, draft)
    const stats = matrixApplicationStats(current, matrix, scale, scaleType)
    if (stats.fillable === 0) {
      setMatrixNotice(
        stats.missingScore > 0 && stats.unmatched > 0
          ? 'Faltan notas en algunas celdas y la matriz no coincide con otras. Revisa ambas cosas.'
          : stats.missingScore > 0
            ? 'Todavía no hay notas para aplicar la matriz. Carga las notas y vuelve a intentar.'
            : stats.unmatched > 0 || stats.coverage === 0
              ? 'La matriz no coincide con las asignaturas o bandas del informe final.'
              : 'No hay casilleros vacíos para completar en el informe final.',
      )
      return
    }

    const filled = applyMatrixToReport(current, matrix, scale, scaleType)
    setDraft((existing) => {
      const next = { ...existing }
      ;(report?.students ?? []).forEach((student, index) => {
        next[finalPerformanceKey(student.name)] = filled[index]?.performances ?? {}
      })
      return next
    })
    setMatrixNotice(
      stats.fillable === 1
        ? 'Matriz aplicada: 1 casillero completado.'
        : `Matriz aplicada: ${stats.fillable} casilleros completados.`,
    )
  }

  const handleSave = () => {
    if (readOnly) return
    onSave?.(draft)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Editar informe final</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ajusta los desempeños finales de cada estudiante. Los promedios y resultados
          calculados se actualizan solo desde los períodos.
        </p>
      </div>

      <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-60">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Estudiante</th>
                {(report?.subjects ?? []).map((subject) => (
                  <th key={subject} className="min-w-56 px-3 py-2">
                    {subject}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(report?.students ?? []).map((student) => {
                const key = finalPerformanceKey(student.name)
                return (
                  <tr key={student.id} className="border-t border-slate-100 align-top">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-800">
                      {student.name}
                    </td>
                    {(report?.subjects ?? []).map((subject) => {
                      const average = student.scores?.[subject]
                      return (
                        <td key={subject} className="px-3 py-2">
                          <div className="space-y-1.5">
                            <span className="block text-xs text-slate-500">
                              Promedio:{' '}
                              {average === null || average === undefined
                                ? '—'
                                : formatScore(average, scaleType)}
                            </span>
                            <textarea
                              className="min-h-[56px] w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                              placeholder="Desempeño final…"
                              value={draft[key]?.[subject] ?? ''}
                              onChange={(event) =>
                                setPerformance(key, subject, event.target.value)
                              }
                              aria-label={`Desempeño final de ${student.name || 'estudiante'} en ${subject}`}
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <PerformanceMatrixImport
          scope="final"
          matrix={matrix}
          stats={matrixStats}
          readOnly={readOnly}
          notice={matrixNotice}
          onLoadMatrix={handleLoadMatrix}
          onClearMatrix={handleClearMatrix}
          onApply={handleApplyMatrix}
        />
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Volver
        </Button>
        <Button onClick={handleSave} disabled={readOnly}>
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
