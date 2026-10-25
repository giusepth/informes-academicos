import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ContactPage from './components/ContactPage'
import DataInputMode from './components/DataInputMode'
import ExportToolbar from './components/ExportToolbar'
import Landing from './components/Landing'
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
import { idb } from './utils/idbStorage'
import { createPersistQueue, loadDataState, migrateLegacy } from './utils/idbState'
import { fillPerformances, makeId } from './utils/parser'
import { readStorage, writeStorage } from './utils/storage'

const MIGRATED_TOAST = 'Trabajo anterior importado a este navegador.'
const PRIVATE_MODE_TOAST = 'Modo privado: el trabajo se guarda solo en esta pestaña.'
const SAVE_ERROR_TOAST =
  'No se pudo guardar en este navegador; exporta el backup (.xlsx) para no perder datos.'

const STORAGE_KEYS = {
  config: 'informes.config',
  reports: 'informes.reports',
  activeReport: 'informes.activeReport',
  selected: 'informes.selected',
  tab: 'informes.tab',
  // Landing gate: flips to true the first time the visitor opens the tool.
  entered: 'informes.entered',
  // Final-report desempeño overrides, keyed by normalized student name.
  finalPerformances: 'informes.finalPerformances',
  // Legacy single-report key; read only, kept for one-shot migration.
  legacyReport: 'informes.report',
}

/**
 * Reads the multi-period reports from storage. Sessions stored as a single
 * legacy report are wrapped as the first period so old sessions migrate
 * transparently.
 */
const initReports = () => {
  const stored = readStorage(STORAGE_KEYS.reports)
  if (Array.isArray(stored) && stored.length > 0) return stored
  const legacy = readStorage(STORAGE_KEYS.legacyReport)
  if (legacy) return [{ ...legacy, id: makeId(), label: 'Informe 1' }]
  return []
}

const readSessionFallback = () => ({
  available: false,
  migrated: false,
  config: readStorage(STORAGE_KEYS.config),
  reports: initReports(),
  finalPerformances: readStorage(STORAGE_KEYS.finalPerformances) ?? {},
})

let bootPromise = null

const boot = () => {
  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        if (!(await idb.isAvailable())) return readSessionFallback()
        const { migrated } = await migrateLegacy({ idb, session: sessionStorage })
        return { available: true, migrated, ...(await loadDataState(idb)) }
      } catch {
        return readSessionFallback()
      }
    })()
  }
  return bootPromise
}

/**
 * App orchestrator: owns report data (persisted in IndexedDB), view state
 * (kept in sessionStorage per tab), the active period report, the computed
 * final report and the configuration modal.
 */
export default function App() {
  const [config, setConfig] = useState(null)
  const [reports, setReports] = useState([])
  const [activeReportId, setActiveReportId] = useState(() =>
    readStorage(STORAGE_KEYS.activeReport),
  )
  const [tab, setTab] = useState(() => (readStorage(STORAGE_KEYS.tab) === 'final' ? 'final' : 'period'))
  const [selectedStudentId, setSelectedStudentId] = useState(() =>
    readStorage(STORAGE_KEYS.selected),
  )
  const [finalPerformances, setFinalPerformances] = useState({})
  const [hydrating, setHydrating] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [entered, setEntered] = useState(() => readStorage(STORAGE_KEYS.entered) === true)
  const [hash, setHash] = useState(() => window.location.hash)
  const printSheetRef = useRef(null)
  const storageModeRef = useRef('idb')
  const [dataQueue] = useState(() =>
    createPersistQueue({
      write: async (key, value) => {
        if (storageModeRef.current === 'session') {
          if (!writeStorage(key, value)) throw new Error('sessionStorage write failed')
          return true
        }
        return idb.set(key, value)
      },
      onError: () => setToast(SAVE_ERROR_TOAST),
    }),
  )

  const applyHydratedState = useCallback((state) => {
    const nextConfig = state.config ?? null
    const nextReports = Array.isArray(state.reports) ? state.reports : []
    const nextFinalPerformances = state.finalPerformances ?? {}

    storageModeRef.current = state.available ? 'idb' : 'session'
    dataQueue.prime(STORAGE_KEYS.config, nextConfig)
    dataQueue.prime(STORAGE_KEYS.reports, nextReports)
    dataQueue.prime(STORAGE_KEYS.finalPerformances, nextFinalPerformances)
    dataQueue.enable()

    setConfig(nextConfig)
    setReports(nextReports)
    setFinalPerformances(nextFinalPerformances)
    setHydrating(false)
    document.documentElement.dataset.hydrated = 'true'
    if (state.migrated) setToast(MIGRATED_TOAST)
    else if (!state.available) setToast(PRIVATE_MODE_TOAST)
  }, [dataQueue])

  useEffect(() => {
    let active = true
    boot().then((state) => {
      if (active) applyHydratedState(state)
    })
    return () => {
      active = false
    }
  }, [applyHydratedState])

  const configured = config !== null
  // The landing only faces first-time visitors: existing sessions (seeded e2e
  // included) go straight to the tool.
  const showLanding = !entered && !configured

  // Session persistence with an audible failure: a full quota must warn
  // instead of silently dropping edits (re-export the .xlsx backup then).
  const persist = (key, value) => {
    if (!writeStorage(key, value)) {
      setToast('La pestaña no pudo guardar la sesión (cuota llena): exportá el backup (.xlsx) para no perder datos.')
    }
  }
  useEffect(() => {
    dataQueue.enqueue(STORAGE_KEYS.config, config)
  }, [config, dataQueue])
  useEffect(() => {
    dataQueue.enqueue(STORAGE_KEYS.reports, reports)
  }, [reports, dataQueue])
  useEffect(() => persist(STORAGE_KEYS.activeReport, activeReportId), [activeReportId])
  useEffect(() => persist(STORAGE_KEYS.selected, selectedStudentId), [selectedStudentId])
  useEffect(() => persist(STORAGE_KEYS.tab, tab), [tab])
  useEffect(() => {
    dataQueue.enqueue(STORAGE_KEYS.finalPerformances, finalPerformances)
  }, [finalPerformances, dataQueue])
  useEffect(() => persist(STORAGE_KEYS.entered, entered), [entered])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  // The contact page is hash-routed so it is reachable directly and from the
  // landing footer, before the visitor enters the tool or configures anything.
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  const handleLoadedBackup = (rawReports, skipped = []) => {
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
    setToast(
      `Backup restaurado: ${restored.length} informe(s) importados.` +
        (skipped.length > 0 ? ` — ${skipped.length} hoja(s) omitida(s): ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}` : ''),
    )
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

  if (hydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-6">
        <p
          role="status"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          className="text-center text-[13px] tracking-[0.03em] text-[#6f6757]"
        >
          Preparando tu trabajo…
        </p>
      </div>
    )
  }

  // The contact route bypasses the landing gate once every hook has run.
  if (hash === '#/contacto') return <ContactPage />

  // Early return after every hook: first-time visitors see only the landing.
  if (showLanding) return <Landing onOpen={() => setEntered(true)} />

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
