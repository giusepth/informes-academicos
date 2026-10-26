import { DATA_STORAGE_KEYS, LEGACY_REPORT_KEY } from './idbState'

/**
 * Deletes every report slice while preserving institutional configuration.
 * IndexedDB commits both keys in one transaction; a failure leaves both
 * untouched. Session fallback removes the same keys synchronously.
 */
export async function clearReportData({ storageMode, idb, session = sessionStorage }) {
  const removeSessionCopies = () => {
    session.removeItem(DATA_STORAGE_KEYS.reports)
    session.removeItem(DATA_STORAGE_KEYS.finalPerformances)
    // Pre-IndexedDB builds kept a single report under this key. It must never
    // resurrect after a clear when the app later falls back to session mode.
    session.removeItem(LEGACY_REPORT_KEY)
  }

  if (storageMode === 'session') {
    try {
      removeSessionCopies()
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
    removeSessionCopies()
  } catch {
    // The IndexedDB transaction is the source of truth; a blocked
    // sessionStorage must not turn a successful clear into a failure.
  }
}
