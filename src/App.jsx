import { useEffect, useMemo, useRef, useState } from 'react'
import DataInputMode from './components/DataInputMode'
import ExportToolbar from './components/ExportToolbar'
import PeriodBar from './components/PeriodBar'
import ReportDashboard from './components/ReportDashboard'
import ReportPreview from './components/ReportPreview'
import SetupModal from './components/SetupModal'
import { Button } from './components/ui'
import {
  buildFinalReport,
  DEFAULT_SCALE,
  DEFAULT_SCALES,
  rankStudents,
} from './utils/calculations'
import { fillPerformances, makeId } from './utils/parser'

const STORAGE_KEYS = {
  config: 'informes.config',
  reports: 'informes.reports',
  activeReport: 'informes.activeReport',
  selected: 'informes.selected',
  tab: 'informes.tab',
  // Final-report desempeño overrides, keyed by normalized student name.
  finalPerformances: 'informes.finalPerformances',
  // Legacy single-report key; read only, kept for one-shot migration.
  legacyReport: 'informes.report',
}

function readStorage(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sessionStorage may be unavailable (private mode); volatile state still works. */
  }
}

/**
 * Reads the multi-period reports from storage. Sessions stored as a single
 * legacy report are wrapped as the first period so old sessions migrate
 * transparently.
 */
function initReports() {
  const stored = readStorage(STORAGE_KEYS.reports)
  if (Array.isArray(stored) && stored.length > 0) return stored
  const legacy = readStorage(STORAGE_KEYS.legacyReport)
  if (legacy) return [{ ...legacy, id: makeId(), label: legacy.label ?? 'Informe 1' }]
  return []
}

/**
 * App orchestrator: owns session state (persisted in sessionStorage so a reload
 * survives but closing the tab wipes everything), the active period report,
 * the computed final report and the configuration modal.
 */
export default function App() {
  const [config, setConfig] = useState(() => readStorage(STORAGE_KEYS.config))
  const [reports, setReports] = useState(initReports)
  const [activeReportId, setActiveReportId] = useState(() =>
    readStorage(STORAGE_KEYS.activeReport),
  )
  const [tab, setTab] = useState(() => (readStorage(STORAGE_KEYS.tab) === 'final' ? 'final' : 'period'))
  const [selectedStudentId, setSelectedStudentId] = useState(() =>
    readStorage(STORAGE_KEYS.selected),
  )
  const [finalPerformances, setFinalPerformances] = useState(() =>
    readStorage(STORAGE_KEYS.finalPerformances) ?? {},
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [toast, setToast] = useState('')
  const printSheetRef = useRef(null)

  const configured = config !== null

  useEffect(() => writeStorage(STORAGE_KEYS.config, config), [config])
  useEffect(() => writeStorage(STORAGE_KEYS.reports, reports), [reports])
  useEffect(() => writeStorage(STORAGE_KEYS.activeReport, activeReportId), [activeReportId])
  useEffect(() => writeStorage(STORAGE_KEYS.selected, selectedStudentId), [selectedStudentId])
  useEffect(() => writeStorage(STORAGE_KEYS.tab, tab), [tab])
  useEffect(() => writeStorage(STORAGE_KEYS.finalPerformances, finalPerformances), [finalPerformances])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const activeReport = useMemo(
    () => reports.find((report) => report.id === activeReportId) ?? reports[0] ?? null,
    [reports, activeReportId],
  )

  const scaleType = config?.scaleType ?? 'decimal'
  const maxScore = scaleType === 'centesimal' ? 100 : 5

  // The final report ("quinto informe") is always derived from every period:
  // per-subject means across periods, ranked with the institutional rules.
  // Final-sheet desempeño annotations are kept in their own storage slice so a
  // period re-import can never overwrite them.
  const finalReport = useMemo(
    () =>
      reports.length > 0
        ? buildFinalReport(reports, config?.scale ?? DEFAULT_SCALES[scaleType], finalPerformances, scaleType)
        : null,
    [reports, config, finalPerformances, scaleType],
  )

  const isFinal = tab === 'final' && finalReport !== null
  const displayReport = isFinal ? finalReport : activeReport

  const rankedStudents = useMemo(
    () => rankStudents(displayReport?.students ?? [], config?.scale ?? DEFAULT_SCALES[scaleType], scaleType),
    [displayReport, config, scaleType],
  )

  // Derive the active selection during render: the stored id when it still
  // exists, otherwise the top-ranked student.
  const activeStudentId = useMemo(() => {
    if (rankedStudents.some((student) => student.id === selectedStudentId)) {
      return selectedStudentId
    }
    return rankedStudents[0]?.id ?? null
  }, [rankedStudents, selectedStudentId])

  const activeStudent = useMemo(
    () => rankedStudents.find((student) => student.id === activeStudentId) ?? null,
    [rankedStudents, activeStudentId],
  )

  const handleConfigSave = (nextConfig) => {
    setConfig(nextConfig)
    setSettingsOpen(false)
    setToast('Configuración guardada.')
  }

  const handleLoaded = (data) => {
    if (!config) {
      setConfig({ institution: '', period: '', scaleType: 'decimal', scale: DEFAULT_SCALE, logo: null })
    }
    const first = { ...data, id: makeId(), label: 'Informe 1' }
    setReports([first])
    setActiveReportId(first.id)
    setTab('period')
    setSelectedStudentId(first.students[0]?.id ?? null)
    setToast(`Informe 1 cargado con ${first.students.length} estudiantes.`)
  }

  const handleLoadedBackup = (rawReports) => {
    if (!config) {
      setConfig({ institution: '', period: '', scaleType: 'decimal', scale: DEFAULT_SCALE, logo: null })
    }
    const restored = rawReports.map((report, index) => ({
      ...report,
      id: makeId(),
      label: report.label ?? `Informe ${index + 1}`,
      students: (report.students ?? []).map((student) => ({ ...student, id: makeId() })),
    }))
    setReports(restored)
    setActiveReportId(restored[0]?.id ?? null)
    setSelectedStudentId(restored[0]?.students[0]?.id ?? null)
    setTab('period')
    setToast(`Backup restaurado: ${restored.length} informe(s) importados.`)
  }

  const handleImportPeriod = (data) => {
    const next = { ...data, id: makeId(), label: `Informe ${reports.length + 1}` }
    setReports((current) => [...current, next])
    setActiveReportId(next.id)
    setTab('period')
    setSelectedStudentId(next.students[0]?.id ?? null)
    setToast(`${next.label} importado con ${next.students.length} estudiantes.`)
  }

  const handleDuplicatePeriod = () => {
    if (!activeReport || tab !== 'period') return
    const subjects = activeReport.subjects ?? []
    const copy = {
      ...activeReport,
      id: makeId(),
      label: `Informe ${reports.length + 1}`,
      // Fresh ids: performances are per period, so a shared id would leak
      // edits across every period at once.
      students: activeReport.students.map((student) => ({
        id: makeId(),
        name: student.name,
        scores: Object.fromEntries(Object.keys(student.scores ?? {}).map((subject) => [subject, null])),
        performances: Object.fromEntries(subjects.map((subject) => [subject, ''])),
      })),
    }
    setReports((current) => [...current, copy])
    setActiveReportId(copy.id)
    setTab('period')
    setSelectedStudentId(copy.students[0]?.id ?? null)
    setToast(`${copy.label} creado: asignaturas y estudiantes copiados, notas en blanco.`)
  }

  const handleSelectReport = (id) => {
    setActiveReportId(id)
    setTab('period')
  }

  const handleSelectFinal = () => setTab('final')

  const handlePerformanceChange = (studentId, subject, text) => {
    // On the final tab the annotation belongs to the finalPerformances slice,
    // keyed by normalized name — the same matching rule as period reports.
    if (isFinal) {
      const student = rankedStudents.find((entry) => entry.id === studentId)
      if (!student) return
      const key = student.name.trim().toUpperCase()
      setFinalPerformances((current) => ({
        ...current,
        [key]: { ...current?.[key], [subject]: text },
      }))
      return
    }
    if (!activeReport) return
    setReports((current) =>
      current.map((reportEntry) =>
        reportEntry.id === activeReport.id
          ? {
              ...reportEntry,
              students: reportEntry.students.map((student) =>
                student.id === studentId
                  ? {
                      ...student,
                      performances: { ...student.performances, [subject]: text },
                    }
                  : student,
              ),
            }
          : reportEntry,
      ),
    )
  }

  const handleReset = () => {
    setReports([])
    setActiveReportId(null)
    setTab('period')
    setSelectedStudentId(null)
    setFinalPerformances({})
    setToast('Datos de los informes reiniciados.')
  }

  /**
   * Pre-loads desempeño texts from the descriptive matrix (Asignatura ×
   * Banda). Applies to whatever is active: the final report (annotations
   * keyed by student name) or the current period report — and only fills
   * EMPTY cells, teacher-written judgments stay untouched.
   */
  const handleApplyMatrix = (matrix) => {
    const scale = config?.scale ?? DEFAULT_SCALES[scaleType]

    if (tab === 'final' && finalReport) {
      const scoresById = Object.fromEntries(
        finalReport.students.map((student) => [student.id, student.scores ?? {}]),
      )
      const filled = fillPerformances(
        finalReport.students,
        finalReport.subjects,
        scoresById,
        scale,
        matrix,
        scaleType,
      )
      const next = { ...finalPerformances }
      finalReport.students.forEach((student) => {
        const key = student.name.trim().toUpperCase()
        next[key] = filled[student.id]
      })
      setFinalPerformances(next)
      setToast('Matriz aplicada al informe final (solo casilleros vacíos).')
      return
    }

    if (!activeReport) return
    const subjects = activeReport.subjects ?? []
    const scoresById = Object.fromEntries(
      activeReport.students.map((student) => [student.id, student.scores ?? {}]),
    )
    const filled = fillPerformances(activeReport.students, subjects, scoresById, scale, matrix, scaleType)
    setReports((current) =>
      current.map((reportEntry) =>
        reportEntry.id === activeReport.id
          ? {
              ...reportEntry,
              students: reportEntry.students.map((student) => ({
                ...student,
                performances: filled[student.id],
              })),
            }
          : reportEntry,
      ),
    )
    setToast(`Matriz aplicada a ${activeReport.label} (solo casilleros vacíos).`)
  }

  return (
    <div className="min-h-full">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Informes académicos</h1>
            <p className="text-xs text-slate-500">
              Generá y exportá informes 100% en tu navegador. Nada se sube a un servidor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              Configuración
            </Button>
            {reports.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Nuevo informe
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!configured ? (
          <p className="text-sm text-slate-500">
            Configurá la escala y el escudo para comenzar.
          </p>
        ) : reports.length > 0 ? (
          <div className="space-y-6">
            <PeriodBar
              reports={reports}
              activeReportId={activeReport?.id}
              activeTab={tab}
              onSelectReport={handleSelectReport}
              onSelectFinal={handleSelectFinal}
              onImportReport={handleImportPeriod}
              onDuplicate={handleDuplicatePeriod}
              onApplyMatrix={handleApplyMatrix}
            />
            <ExportToolbar
              report={displayReport}
              students={rankedStudents}
              selectedStudentId={activeStudentId}
              onSelectStudent={setSelectedStudentId}
              getPrintElement={() => printSheetRef.current}
              onPreview={() => setPreviewOpen(true)}
              onNotify={setToast}
            />
            <ReportDashboard
              config={config}
              report={displayReport}
              rankedStudents={rankedStudents}
              selectedStudentId={activeStudentId}
              onSelectStudent={setSelectedStudentId}
              onPerformanceChange={handlePerformanceChange}
              printSheetRef={printSheetRef}
              variant={isFinal ? 'final' : 'period'}
            />
          </div>
        ) : (
          <DataInputMode
            onLoaded={handleLoaded}
            onLoadedBackup={handleLoadedBackup}
            onOpenSettings={() => setSettingsOpen(true)}
            hasConfig={configured}
            maxScore={maxScore}
          />
        )}
      </main>

      {previewOpen && activeStudent ? (
        <ReportPreview
          config={config}
          report={displayReport}
          student={activeStudent}
          variant={isFinal ? 'final' : 'period'}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      {!configured || settingsOpen ? (
        <SetupModal
          initialRun={!configured}
          initialConfig={config}
          onSave={handleConfigSave}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {toast ? (
        <div className="no-print fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
