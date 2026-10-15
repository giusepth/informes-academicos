import { useEffect, useMemo, useRef, useState } from 'react'
import DataInputMode from './components/DataInputMode'
import ExportToolbar from './components/ExportToolbar'
import ReportDashboard from './components/ReportDashboard'
import ReportPreview from './components/ReportPreview'
import SetupModal from './components/SetupModal'
import { Button } from './components/ui'
import { DEFAULT_SCALE, rankStudents } from './utils/calculations'

const STORAGE_KEYS = {
  config: 'informes.config',
  report: 'informes.report',
  selected: 'informes.selected',
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
 * App orchestrator: owns session state (persisted in sessionStorage so a reload
 * survives but closing the tab wipes everything), the active step and the
 * configuration modal.
 */
export default function App() {
  const [config, setConfig] = useState(() => readStorage(STORAGE_KEYS.config))
  const [report, setReport] = useState(() => readStorage(STORAGE_KEYS.report))
  const [selectedStudentId, setSelectedStudentId] = useState(() =>
    readStorage(STORAGE_KEYS.selected),
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [toast, setToast] = useState('')
  const printSheetRef = useRef(null)

  const configured = config !== null

  useEffect(() => writeStorage(STORAGE_KEYS.config, config), [config])
  useEffect(() => writeStorage(STORAGE_KEYS.report, report), [report])
  useEffect(() => writeStorage(STORAGE_KEYS.selected, selectedStudentId), [selectedStudentId])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const rankedStudents = useMemo(
    () => rankStudents(report?.students ?? [], config?.scale ?? DEFAULT_SCALE),
    [report, config],
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
      setConfig({ institution: '', period: '', scale: DEFAULT_SCALE, logo: null })
    }
    setReport(data)
    setSelectedStudentId(data.students[0]?.id ?? null)
    setToast(`Se cargaron ${data.students.length} estudiantes.`)
  }

  const handlePerformanceChange = (studentId, subject, text) => {
    setReport((current) => {
      if (!current) return current
      return {
        ...current,
        students: current.students.map((student) =>
          student.id === studentId
            ? {
                ...student,
                performances: { ...student.performances, [subject]: text },
              }
            : student,
        ),
      }
    })
  }

  const handleReset = () => {
    setReport(null)
    setSelectedStudentId(null)
    setToast('Datos del informe reiniciados.')
  }

  return (
    <div className="min-h-full">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
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
            {report ? (
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
        ) : report ? (
          <div className="space-y-6">
            <ExportToolbar
              report={report}
              students={rankedStudents}
              selectedStudentId={activeStudentId}
              onSelectStudent={setSelectedStudentId}
              getPrintElement={() => printSheetRef.current}
              onPreview={() => setPreviewOpen(true)}
              onNotify={setToast}
            />
            <ReportDashboard
              config={config}
              report={report}
              rankedStudents={rankedStudents}
              selectedStudentId={activeStudentId}
              onSelectStudent={setSelectedStudentId}
              onPerformanceChange={handlePerformanceChange}
              printSheetRef={printSheetRef}
            />
          </div>
        ) : (
          <DataInputMode
            onLoaded={handleLoaded}
            onOpenSettings={() => setSettingsOpen(true)}
            hasConfig={configured}
          />
        )}
      </main>

      {previewOpen && activeStudent ? (
        <ReportPreview
          config={config}
          report={report}
          student={activeStudent}
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
        <div className="no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
