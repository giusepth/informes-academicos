import { DATA_STORAGE_KEYS, LEGACY_REPORT_KEY } from './idbState'

/**
 * Deletes every report slice while preserving institutional configuration.
 * IndexedDB commits both keys in one transaction; a failure leaves both
 * untouched. Session fallback removes the same keys synchronously.
 */
export async function clearReportData({ storageMode, idb, session = sessionStorage }) {
  if (storageMode === 'session') {
    try {
      clearSessionReportCopies(session)
    } catch {
      throw new Error('No se pudo limpiar la sesión de esta pestaña.')
    }
    return
  }

  const removed = await idb.setMany([
    [DATA_STORAGE_KEYS.reports, []],
    [DATA_STORAGE_KEYS.finalPerformances, {}],
  ])
  if (!removed) throw new Error('No se pudieron limpiar los informes guardados.')
  try {
    clearSessionReportCopies(session)
  } catch {
    // The IndexedDB transaction is the source of truth; a blocked
    // sessionStorage must not turn a successful clear into a failure.
  }
}

/**
 * Removes per-tab copies of report data without touching configuration or
 * view keys. Used locally and by tabs that receive another tab's clear.
 */
export function clearSessionReportCopies(session = sessionStorage) {
  session.removeItem(DATA_STORAGE_KEYS.reports)
  session.removeItem(DATA_STORAGE_KEYS.finalPerformances)
  // Pre-IndexedDB builds kept a single report under this key. It must never
  // resurrect after a clear when the app later falls back to session mode.
  session.removeItem(LEGACY_REPORT_KEY)
}
