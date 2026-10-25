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
import {
  createPersistQueue,
  loadDataState,
  migrateLegacy,
  MIGRATION_FLAG,
} from './utils/idbState'
import {
  applyMatrixToReport,
  countMatrixFills,
  fillPerformances,
  finalPerformanceKey,
  makeId,
} from './utils/parser'
import { createPersistenceRequester } from './utils/persistence'
import { readStorage, writeStorage } from './utils/storage'
import { createTabSync } from './utils/tabSync'
import { writerLock } from './utils/writerLock'

const PROMOTED_TOAST = 'Otra pestaña dejó de editar: esta pestaña ya puede editar.'
const MULTI_TAB_ADVISORY_TOAST =
  'Otra pestaña también está editando: revisa los cambios antes de seguir.'
const READ_ONLY_BANNER =
  'Solo lectura: otra pestaña está editando los informes. Esta pestaña se activará cuando esa pestaña se cierre.'
const MIGRATED_TOAST = 'Trabajo anterior importado a este navegador.'
const MIGRATION_FAILED_TOAST =
  'No se pudo importar el trabajo a este navegador: se muestra la copia de esta pestaña.'
const STORAGE_FALLBACK_TOAST =
  'Sin almacenamiento persistente: el trabajo se guarda solo en esta pestaña.'
const SAVE_ERROR_TOAST =
  'No se pudo guardar en este navegador; exporta el backup (.xlsx) para no perder datos.'
const PENDING_MATRIX_TOAST =
  'Desempeños cargados: se aplicarán al primer informe que abras.'

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
  // Matrix loaded from the empty main menu, waiting for the first report.
  pendingMatrix: 'informes.pendingMatrix',
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

/**
 * One fallback path for both the unavailable-IndexedDB case (private mode,
 * policy block, open timeout) and a failed import: shows the session copy and
 * persists every later edit to sessionStorage instead of IndexedDB.
 */
const readSessionFallback = () => ({
  available: false,
  storageMode: 'session',
  lockMode: 'unsupported',
  migrated: false,
  config: readStorage(STORAGE_KEYS.config),
  reports: initReports(),
  finalPerformances: readStorage(STORAGE_KEYS.finalPerformances) ?? {},
})

const persistence = createPersistenceRequester()

// Data slices the pre-IndexedDB build kept in sessionStorage. Their presence
// marks a tab that already used the tool, not a first-time visitor.
const LEGACY_SESSION_DATA_KEYS = [
  STORAGE_KEYS.config,
  STORAGE_KEYS.reports,
  STORAGE_KEYS.legacyReport,
  STORAGE_KEYS.finalPerformances,
]

const hasLegacySessionData = () => {
  if (readStorage(STORAGE_KEYS.entered) === true) return false
  try {
    return LEGACY_SESSION_DATA_KEYS.some((key) => sessionStorage.getItem(key) !== null)
  } catch {
    return false
  }
}

let hydratePromise = null

/**
 * Read-only hydration: loads the three persisted data keys (or the session
 * copy) without touching the writer lock, the migration or the persist queue.
 * Safe to run while the landing is visible, and the only boot step a tab needs
 * before it can decide whether the tool should be shown.
 */
const hydrate = () => {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        if (!(await idb.isAvailable())) return readSessionFallback()
        const [data, migrationFlag] = await Promise.all([
          loadDataState(idb),
          idb.get(MIGRATION_FLAG),
        ])
        // Legacy tabs already used the tool: keep them out of the landing so
        // their pre-deploy session is migrated (under the writer lock) before
        // it can die with the tab. This detection stays read-only on
        // IndexedDB; only the session flag is written, never the data.
        const resumeLegacySession =
          migrationFlag === undefined && hasLegacySessionData()
        if (resumeLegacySession) writeStorage(STORAGE_KEYS.entered, true)
        return {
          available: true,
          storageMode: 'idb',
          migrated: false,
          resumeLegacySession,
          ...data,
        }
      } catch {
        return readSessionFallback()
      }
    })()
  }
  return hydratePromise
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
  const [pendingMatrix, setPendingMatrix] = useState(() =>
    readStorage(STORAGE_KEYS.pendingMatrix),
  )
  const [scoreEntry, setScoreEntry] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const [activated, setActivated] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [lockState, setLockState] = useState('pending')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [persistenceStatus, setPersistenceStatus] = useState()
  const [entered, setEntered] = useState(() => readStorage(STORAGE_KEYS.entered) === true)
  const [hash, setHash] = useState(() => window.location.hash)
  const printSheetRef = useRef(null)
  const storageModeRef = useRef('idb')
  const hydratedRef = useRef(false)
  const hydratedStateRef = useRef(null)
  const hydrationPromiseRef = useRef(null)
  const activatedRef = useRef(false)
  const activationPromiseRef = useRef(null)
  const pendingResyncRef = useRef(false)
  const readOnlyRef = useRef(false)
  const lockModeRef = useRef('pending')
  const tabSyncRef = useRef(null)
  // A duplicated blank period switches the report and enters score entry in
  // the same render: skip the navigation reset exactly once.
  const keepScoreEntryRef = useRef(false)
  const mountedRef = useRef(true)
  const persistenceRequestedRef = useRef(false)
  const [dataQueue] = useState(() =>
    createPersistQueue({
      write: async (key, value) => {
        // Defense in depth: a read-only tab never commits data, even if a
        // state effect slipped past the enqueue guard.
        if (readOnlyRef.current) return false
        if (storageModeRef.current === 'session') {
          if (!writeStorage(key, value)) throw new Error('sessionStorage write failed')
          return true
        }
        const saved = await idb.set(key, value)
        // Announce the committed batch so other tabs converge on it.
        tabSyncRef.current?.notify()
        // Persistence is requested only after the first committed write: a
        // page that never stored anything must not trigger the prompt.
        if (saved && !persistenceRequestedRef.current && storageModeRef.current === 'idb') {
          persistenceRequestedRef.current = true
          void persistence.requestOnce().then(() => {
            if (mountedRef.current) setPersistenceStatus(persistence.getStatus())
          })
        }
        return saved
      },
      onError: () => setToast(SAVE_ERROR_TOAST),
    }),
  )

  // Read-only hydration used by the landing: it may read IndexedDB to find out
  // whether the visitor already configured the tool, but it never acquires the
  // writer lock, writes, migrates or enables the persist queue.
  const applyHydratedState = useCallback((state) => {
    if (hydratedRef.current) return
    const nextConfig = state.config ?? null
    const nextReports = Array.isArray(state.reports) ? state.reports : []
    const nextFinalPerformances = state.finalPerformances ?? {}

    hydratedStateRef.current = {
      ...state,
      config: nextConfig,
      reports: nextReports,
      finalPerformances: nextFinalPerformances,
    }
    storageModeRef.current = state.storageMode ?? (state.available ? 'idb' : 'session')
    hydratedRef.current = true
    if (state.resumeLegacySession) setEntered(true)
    setConfig(nextConfig)
    setReports(nextReports)
    setFinalPerformances(nextFinalPerformances)
    setHydrating(false)
    document.documentElement.dataset.hydrated = 'true'
  }, [])

  // Activation happens only when the tool UI (or its initial setup modal) is
  // actually shown. Lock mode and read-only flag land in the same React batch
  // as the data and the queue enablement, and the tool is not rendered before
  // `activated`, so there is no editable flash for a reader.
  const applyActivatedState = useCallback(
    (
      state,
      {
        lockMode,
        readOnly: nextReadOnly,
        enableQueue,
        migrated = false,
        migrationFailed = false,
        fallback = false,
      },
    ) => {
      const nextConfig = state.config ?? null
      const nextReports = Array.isArray(state.reports) ? state.reports : []
      const nextFinalPerformances = state.finalPerformances ?? {}
      const snapshot = {
        ...state,
        config: nextConfig,
        reports: nextReports,
        finalPerformances: nextFinalPerformances,
      }

      hydratedStateRef.current = snapshot
      storageModeRef.current = state.storageMode ?? (state.available ? 'idb' : 'session')
      hydratedRef.current = true
      readOnlyRef.current = nextReadOnly
      lockModeRef.current = lockMode

      setConfig(nextConfig)
      setReports(nextReports)
      setFinalPerformances(nextFinalPerformances)
      setReadOnly(nextReadOnly)
      setLockState(lockMode)
      setHydrating(false)
      setActivated(true)
      activatedRef.current = true
      document.documentElement.dataset.hydrated = 'true'

      if (enableQueue) {
        dataQueue.prime(STORAGE_KEYS.config, nextConfig)
        dataQueue.prime(STORAGE_KEYS.reports, nextReports)
        dataQueue.prime(STORAGE_KEYS.finalPerformances, nextFinalPerformances)
        dataQueue.enable()
      }

      if (migrationFailed) setToast(MIGRATION_FAILED_TOAST)
      else if (migrated) setToast(MIGRATED_TOAST)
      else if (fallback) setToast(STORAGE_FALLBACK_TOAST)
    },
    [dataQueue],
  )

  // Pull the latest committed data from IndexedDB. Returns whether the
  // snapshot was actually refreshed so promotion can refuse to enable editing
  // on a failed read. Only called for a remote change or a visible tab, and
  // only when no local write is in flight: a stale tab must refresh, never
  // overwrite newer work from another tab.
  const resyncFromIdb = useCallback(async () => {
    if (!hydratedRef.current || !activatedRef.current) return false
    if (storageModeRef.current !== 'idb') return false
    if (!dataQueue.isIdle()) return false

    let state
    try {
      state = await loadDataState(idb)
    } catch {
      return false
    }
    if (!dataQueue.isIdle()) return false

    const nextConfig = state.config ?? null
    const nextReports = Array.isArray(state.reports) ? state.reports : []
    const nextFinalPerformances = state.finalPerformances ?? {}

    // Prime before setting state: the state effects then dedupe against this
    // snapshot instead of echoing an identical write back to the other tab.
    dataQueue.prime(STORAGE_KEYS.config, nextConfig)
    dataQueue.prime(STORAGE_KEYS.reports, nextReports)
    dataQueue.prime(STORAGE_KEYS.finalPerformances, nextFinalPerformances)
    hydratedStateRef.current = {
      ...state,
      config: nextConfig,
      reports: nextReports,
      finalPerformances: nextFinalPerformances,
    }
    setConfig(nextConfig)
    setReports(nextReports)
    setFinalPerformances(nextFinalPerformances)
    return true
  }, [dataQueue])

  // Remote changes that arrive before activation (landing, contact, or a tab
  // still waiting on the lock) are replayed once the tool finishes activating.
  const requestResync = useCallback(() => {
    if (!hydratedRef.current || !activatedRef.current) {
      pendingResyncRef.current = true
      return
    }
    void resyncFromIdb()
  }, [resyncFromIdb])

  const replayPendingResync = useCallback(() => {
    if (!pendingResyncRef.current) return
    pendingResyncRef.current = false
    void resyncFromIdb()
  }, [resyncFromIdb])

  // The previous writer released the lock (usually because its tab closed):
  // keep read-only, re-read the three data keys and only enable editing when
  // that read succeeded. A failed read (or flush) releases the lock again so
  // the banner's «Reintentar» can ask for it with a clean lifecycle.
  const handlePromoted = useCallback(async () => {
    if (!mountedRef.current) {
      writerLock.release()
      return
    }
    await dataQueue.flush()
    const refreshed = await resyncFromIdb()
    if (!mountedRef.current) {
      writerLock.release()
      return
    }
    if (!refreshed) {
      writerLock.release()
      return
    }
    pendingResyncRef.current = false
    dataQueue.enable()
    readOnlyRef.current = false
    lockModeRef.current = 'writer'
    setReadOnly(false)
    setLockState('writer')
    setToast(PROMOTED_TOAST)
  }, [dataQueue, resyncFromIdb])

  const activateTool = useCallback(async () => {
    let state = hydratedStateRef.current
    if (!state) {
      state = await hydrate()
      applyHydratedState(state)
    }

    // Session fallback is per tab: nothing to coordinate, both tabs may edit.
    if (state.storageMode !== 'idb') {
      applyActivatedState(state, {
        lockMode: 'unsupported',
        readOnly: false,
        enableQueue: true,
        fallback: !state.available,
      })
      replayPendingResync()
      return
    }

    // The lock is acquired before the legacy migration and before anything is
    // written: a reader never migrates, never primes or enables the queue.
    let mode
    try {
      mode = await writerLock.acquire()
    } catch {
      mode = 'unsupported'
    }
    if (!mountedRef.current) {
      if (mode === 'writer') writerLock.release()
      return
    }

    if (mode === 'reader') {
      let fresh = state
      try {
        fresh = { ...state, ...(await loadDataState(idb)) }
      } catch {
        /* Keep the hydrated snapshot if the refresh fails. */
      }
      applyActivatedState(fresh, { lockMode: 'reader', readOnly: true, enableQueue: false })
      replayPendingResync()
      void writerLock.promote(handlePromoted)
      return
    }

    if (mode === 'unsupported') {
      let fresh = state
      try {
        fresh = { ...state, ...(await loadDataState(idb)) }
      } catch {
        /* Keep the hydrated snapshot if the refresh fails. */
      }
      applyActivatedState(fresh, { lockMode: 'unsupported', readOnly: false, enableQueue: true })
      replayPendingResync()
      return
    }

    let migration
    try {
      migration = await migrateLegacy({ idb, session: sessionStorage })
    } catch {
      migration = { migrated: false, failed: true }
    }
    if (migration.failed) {
      // Never hold the writer lock while falling back to per-tab storage: it
      // would block the tabs that still share IndexedDB.
      writerLock.release()
      applyActivatedState(readSessionFallback(), {
        lockMode: 'unsupported',
        readOnly: false,
        enableQueue: true,
        migrationFailed: true,
      })
      replayPendingResync()
      return
    }
    if (migration.migrated) tabSyncRef.current?.notify()

    let fresh = state
    try {
      fresh = { ...state, ...(await loadDataState(idb)) }
    } catch {
      /* Keep the hydrated snapshot if the refresh fails. */
    }
    applyActivatedState(fresh, {
      lockMode: 'writer',
      readOnly: false,
      enableQueue: true,
      migrated: migration.migrated,
    })
    replayPendingResync()
  }, [applyActivatedState, applyHydratedState, handlePromoted, replayPendingResync])

  const configured = config !== null
  // The landing only faces first-time visitors: existing sessions (seeded e2e
  // included) go straight to the tool.
  const showLanding = !entered && !configured

  useEffect(() => {
    const sync = createTabSync({
      onRemoteChange: (origin) => {
        requestResync()
        // Without Web Locks both tabs can write. Never claim exclusivity:
        // just warn when another tab actually committed something.
        if (
          origin === 'channel' &&
          lockModeRef.current === 'unsupported' &&
          storageModeRef.current === 'idb'
        ) {
          setToast(MULTI_TAB_ADVISORY_TOAST)
        }
      },
    })
    tabSyncRef.current = sync
    return () => {
      sync.close()
      if (tabSyncRef.current === sync) tabSyncRef.current = null
    }
  }, [requestResync])

  // Give the last scheduled writes a chance to commit before the tab is
  // hidden (a hard close can still race the asynchronous IndexedDB commit).
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void dataQueue.flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [dataQueue])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Hydration is the only step the landing waits for: no lock, no writes. The
  // contact route skips it entirely.
  useEffect(() => {
    if (hash === '#/contacto') return
    if (hydratedRef.current) return
    if (!hydrationPromiseRef.current) hydrationPromiseRef.current = hydrate()
    void hydrationPromiseRef.current.then((state) => {
      if (hydratedRef.current) return
      applyHydratedState(state)
    })
  }, [hash, applyHydratedState])

  // Activation is a single shot per page, and only when the tool is visible:
  // contact is excluded and the landing never acquires the lock.
  useEffect(() => {
    if (hash === '#/contacto') return
    if (hydrating || showLanding || activated) return
    if (!activationPromiseRef.current) activationPromiseRef.current = activateTool()
    void activationPromiseRef.current
  }, [hash, hydrating, showLanding, activated, activateTool])

  // Session persistence with an audible failure: a full quota must warn
  // instead of silently dropping edits (re-export the .xlsx backup then).
  const persist = (key, value) => {
    if (!writeStorage(key, value)) {
      setToast('La pestaña no pudo guardar la sesión (cuota llena): exporta el backup (.xlsx) para no perder datos.')
    }
  }
  useEffect(() => {
    if (readOnly) return
    dataQueue.enqueue(STORAGE_KEYS.config, config)
  }, [config, dataQueue, readOnly])
  useEffect(() => {
    if (readOnly) return
    dataQueue.enqueue(STORAGE_KEYS.reports, reports)
  }, [reports, dataQueue, readOnly])
  useEffect(() => persist(STORAGE_KEYS.activeReport, activeReportId), [activeReportId])
  useEffect(() => persist(STORAGE_KEYS.selected, selectedStudentId), [selectedStudentId])
  useEffect(() => persist(STORAGE_KEYS.tab, tab), [tab])
  // Score entry belongs to one period: navigation always leaves edit mode,
  // except the blank-period flow that enters it on purpose.
  useEffect(() => {
    if (keepScoreEntryRef.current) {
      keepScoreEntryRef.current = false
      return
    }
    setScoreEntry(false)
  }, [activeReportId, tab])
  useEffect(() => {
    if (readOnly) return
    dataQueue.enqueue(STORAGE_KEYS.finalPerformances, finalPerformances)
  }, [finalPerformances, dataQueue, readOnly])
  useEffect(() => persist(STORAGE_KEYS.pendingMatrix, pendingMatrix), [pendingMatrix])
  useEffect(() => persist(STORAGE_KEYS.entered, entered), [entered])

  useEffect(() => {
    if (!toast) return undefined
    // Save errors carry a recovery instruction and need longer on screen.
    const duration = toast.length > 60 ? 6000 : 3500
    const timer = setTimeout(() => setToast(''), duration)
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

  // A matrix loaded from the empty main menu waits here until there is an
  // active period report with students AND real grades to band. It fills ONLY
  // empty desempeño cells and clears itself in the same batch, so it can never
  // apply twice to the same payload. A roster without scores keeps the pending
  // matrix waiting instead of consuming it. The final tab is excluded:
  // annotations live elsewhere.
  useEffect(() => {
    // Activation lands the real lock mode/readOnly flag; before it, a reader
    // must never consume the pending payload.
    if (!activated || !pendingMatrix || readOnly || tab === 'final') return
    if (!activeReport || (activeReport.students ?? []).length === 0) return

    const scale = config?.scale ?? DEFAULT_SCALES[scaleType]
    if (countMatrixFills(activeReport, pendingMatrix, scale, scaleType) === 0) return

    const students = applyMatrixToReport(activeReport, pendingMatrix, scale, scaleType)
    setReports((current) =>
      current.map((entry) => (entry.id === activeReport.id ? { ...entry, students } : entry)),
    )
    setPendingMatrix(null)
    setToast(`Desempeños aplicados a ${activeReport.label ?? 'el informe activo'}.`)
  }, [activated, pendingMatrix, activeReport, readOnly, tab, config, scaleType])

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
    if (readOnlyRef.current) return
    setConfig(nextConfig)
    setSettingsOpen(false)
    setToast('Configuración guardada.')
  }

  const handleLoaded = (data) => {
    if (readOnlyRef.current) return
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

  const handleLoadedBackup = (rawReports, skipped = [], restoredFinalPerformances = {}) => {
    if (readOnlyRef.current) return
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
    // An old backup has no final sheet: absence means "keep what this browser
    // already has", never "clear it". A present sheet merges by normalized
    // name so restoring the period data does not drop final annotations.
    if (restoredFinalPerformances && Object.keys(restoredFinalPerformances).length > 0) {
      setFinalPerformances((current) => ({ ...current, ...restoredFinalPerformances }))
    }
    setToast(
      `Backup restaurado: ${restored.length} informe(s) importados.` +
        (skipped.length > 0 ? ` — ${skipped.length} hoja(s) omitida(s): ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}` : ''),
    )
  }

  const handleImportPeriod = (data) => {
    if (readOnlyRef.current) return
    const next = { ...data, id: makeId(), label: `Informe ${reports.length + 1}` }
    setReports((current) => [...current, next])
    setActiveReportId(next.id)
    setTab('period')
    setSelectedStudentId(next.students[0]?.id ?? null)
    setToast(`${next.label} importado con ${next.students.length} estudiantes.`)
  }

  const handleDuplicatePeriod = () => {
    if (readOnlyRef.current || !activeReport || tab !== 'period') return
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
    keepScoreEntryRef.current = true
    setReports((current) => [...current, copy])
    setActiveReportId(copy.id)
    setTab('period')
    setSelectedStudentId(copy.students[0]?.id ?? null)
    setScoreEntry(true)
    setToast(`${copy.label} creado: asignaturas y estudiantes copiados, notas en blanco.`)
  }

  const handleSelectReport = (id) => {
    setActiveReportId(id)
    setTab('period')
  }

  /**
   * A matrix loaded while the main menu is visible has no report to fill yet:
   * keep it pending (sessionStorage survives a reload) and let the auto-apply
   * effect finish the job as soon as the first report has students.
   */
  const handleLoadMatrix = (matrix) => {
    if (readOnlyRef.current) return
    setPendingMatrix(matrix)
    setToast(PENDING_MATRIX_TOAST)
  }

  const handleSelectFinal = () => setTab('final')

  const handlePerformanceChange = (studentId, subject, text) => {
    if (readOnlyRef.current) return
    // On the final tab the annotation belongs to the finalPerformances slice,
    // keyed by normalized name — the same matching rule as period reports.
    if (isFinal) {
      const student = rankedStudents.find((entry) => entry.id === studentId)
      if (!student) return
      const key = finalPerformanceKey(student.name)
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

  const handleScoreChange = (studentId, subject, value) => {
    if (readOnlyRef.current || !activeReport) return
    setReports((current) =>
      current.map((reportEntry) =>
        reportEntry.id === activeReport.id
          ? {
              ...reportEntry,
              students: reportEntry.students.map((student) =>
                student.id === studentId
                  ? { ...student, scores: { ...student.scores, [subject]: value } }
                  : student,
              ),
            }
          : reportEntry,
      ),
    )
  }

  const handleAddStudent = (rawName) => {
    if (readOnlyRef.current) return
    const name = rawName.trim()
    if (!name || !activeReport || tab !== 'period') return
    const subjects = activeReport.subjects ?? []
    const student = {
      id: makeId(),
      name,
      scores: Object.fromEntries(subjects.map((subject) => [subject, null])),
      performances: Object.fromEntries(subjects.map((subject) => [subject, ''])),
    }
    setReports((current) =>
      current.map((reportEntry) =>
        reportEntry.id === activeReport.id
          ? { ...reportEntry, students: [...reportEntry.students, student] }
          : reportEntry,
      ),
    )
    setSelectedStudentId(student.id)
    setToast(`Se agregó a ${name} en ${activeReport.label}.`)
  }

  const handleReset = () => {
    if (readOnlyRef.current) return
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
    if (readOnlyRef.current) return
    const scale = config?.scale ?? DEFAULT_SCALES[scaleType]
    // An explicit apply supersedes whatever was waiting from the menu.
    setPendingMatrix(null)

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
        const key = finalPerformanceKey(student.name)
        next[key] = filled[student.id]
      })
      setFinalPerformances(next)
      setToast('Matriz aplicada al informe final (solo casilleros vacíos).')
      return
    }

    if (!activeReport) return
    const students = applyMatrixToReport(activeReport, matrix, scale, scaleType)
    setReports((current) =>
      current.map((reportEntry) =>
        reportEntry.id === activeReport.id ? { ...reportEntry, students } : reportEntry,
      ),
    )
    setToast(`Matriz aplicada a ${activeReport.label} (solo casilleros vacíos).`)
  }

  // The contact route is static: it must not mount the data boot at all (no
  // hydration, no lock, no IndexedDB read) and never waits on it.
  if (hash === '#/contacto') return <ContactPage />

  // The landing waits only for hydration. A tab heading to the tool keeps the
  // splash until activation has applied its lock mode and read-only flag.
  if (hydrating || (!showLanding && !activated)) {
    return (
      <div
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-6"
      >
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

  // One notice node reachable from every post-hydration branch (landing
  // included), so storage and migration notices are never hidden behind the
  // landing gate.
  const notice = toast ? (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="no-print fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
    >
      {toast}
    </div>
  ) : null

  // Early return after every hook: first-time visitors see only the landing.
  if (showLanding) {
    return (
      <>
        <Landing onOpen={() => setEntered(true)} />
        {notice}
      </>
    )
  }

  return (
    <>
      <div className="min-h-full">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Informes académicos</h1>
            <p className="text-xs text-slate-500">
              Genera y exporta informes 100% en tu navegador. Nada se sube a un servidor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              Configuración
            </Button>
            {reports.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={handleReset} disabled={readOnly}>
                Nuevo informe
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {lockState === 'reader' ? (
        <div role="status" className="no-print border-b border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
            <p className="text-sm text-slate-700">{READ_ONLY_BANNER}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void writerLock.promote(handlePromoted)
              }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!configured ? (
          <p className="text-sm text-slate-500">
            Configura la escala y el escudo para comenzar.
          </p>
        ) : reports.length > 0 ? (
          <div className="space-y-6">
            <PeriodBar
              reports={reports}
              finalPerformances={finalPerformances}
              activeReportId={activeReport?.id}
              activeTab={tab}
              onSelectReport={handleSelectReport}
              onSelectFinal={handleSelectFinal}
              onImportReport={handleImportPeriod}
              onDuplicate={handleDuplicatePeriod}
              onApplyMatrix={handleApplyMatrix}
              scoreEntry={scoreEntry}
              onToggleScoreEntry={() => setScoreEntry((current) => !current)}
              onAddStudent={handleAddStudent}
              readOnly={readOnly}
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
              onScoreChange={handleScoreChange}
              editableScores={tab === 'period' && scoreEntry}
              printSheetRef={printSheetRef}
              variant={isFinal ? 'final' : 'period'}
              readOnly={readOnly}
            />
          </div>
        ) : (
          <DataInputMode
            onLoaded={handleLoaded}
            onLoadedBackup={handleLoadedBackup}
            onLoadMatrix={handleLoadMatrix}
            onOpenSettings={() => setSettingsOpen(true)}
            hasConfig={configured}
            maxScore={maxScore}
            readOnly={readOnly}
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
          persistenceStatus={persistenceStatus}
          onSave={handleConfigSave}
          onClose={() => setSettingsOpen(false)}
          readOnly={readOnly}
        />
      ) : null}

      </div>
      {notice}
    </>
  )
}
