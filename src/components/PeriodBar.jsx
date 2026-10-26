import { useEffect, useState } from 'react'
import { Button, TextInput } from './ui'

/**
 * Period navigation inside a report view. File imports, backups and matrix
 * actions live in the management menu (R3); this bar only switches periods,
 * opens the final report and, while the legacy score editor is still here,
 * toggles manual entry for the active period.
 */
export default function PeriodBar({
  reports,
  activeReportId,
  activeTab,
  onSelectReport,
  onSelectFinal,
  canEdit = true,
  scoreEntry = false,
  onToggleScoreEntry,
  onAddStudent,
  readOnly = false,
}) {
  const [studentName, setStudentName] = useState('')

  // A half-typed name belongs to one period and one edit session: never leak
  // it into another report or back into edit mode after committing.
  useEffect(() => {
    setStudentName('')
  }, [activeReportId, scoreEntry])

  const handleAddStudent = (event) => {
    event.preventDefault()
    const name = studentName.trim()
    if (!name) return
    onAddStudent?.(name)
    setStudentName('')
  }

  const finalLabel = `Informe ${reports.length + 1} (final)`

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
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

      <span className="flex-1" />

      {canEdit && activeTab !== 'final' && !readOnly ? (
        <Button variant="secondary" size="sm" onClick={onToggleScoreEntry}>
          {scoreEntry ? 'Terminar edición' : 'Editar notas'}
        </Button>
      ) : null}

      {canEdit && scoreEntry && activeTab !== 'final' && !readOnly ? (
        <form
          className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
          onSubmit={handleAddStudent}
        >
          <label htmlFor="manual-student-name" className="sr-only">
            Nombre del estudiante
          </label>
          <TextInput
            id="manual-student-name"
            className="min-w-0 flex-1"
            placeholder="Nombre del estudiante"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
          />
          <Button type="submit" size="sm">
            Agregar
          </Button>
        </form>
      ) : null}
    </div>
  )
}
