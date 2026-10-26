import { DATA_STORAGE_KEYS } from './idbState'

/**
 * Deletes every report slice while preserving institutional configuration.
 * IndexedDB commits both keys in one transaction; a failure leaves both
 * untouched. Session fallback removes the same keys synchronously.
 */
export async function clearReportData({ storageMode, idb, session = sessionStorage }) {
  if (storageMode === 'session') {
    try {
      session.removeItem(DATA_STORAGE_KEYS.reports)
      session.removeItem(DATA_STORAGE_KEYS.finalPerformances)
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
}
