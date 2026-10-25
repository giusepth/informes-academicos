import { makeId } from './parser'

export const DATA_STORAGE_KEYS = {
  config: 'informes.config',
  reports: 'informes.reports',
  finalPerformances: 'informes.finalPerformances',
}

export const MIGRATION_FLAG = 'informes.migratedFromSession'

const LEGACY_REPORT_KEY = 'informes.report'

function readSessionValue(session, key) {
  let raw
  if (session && typeof session.get === 'function') raw = session.get(key)
  else if (session && typeof session.getItem === 'function') raw = session.getItem(key)

  if (raw === undefined || raw === null) return { present: false }
  if (typeof raw !== 'string') return { present: true, value: raw }

  try {
    return { present: true, value: JSON.parse(raw) }
  } catch {
    return { present: false }
  }
}

export async function loadDataState(storage) {
  const [config, reports, finalPerformances] = await Promise.all([
    storage.get(DATA_STORAGE_KEYS.config),
    storage.get(DATA_STORAGE_KEYS.reports),
    storage.get(DATA_STORAGE_KEYS.finalPerformances),
  ])

  return {
    config: config === undefined ? null : config,
    reports: reports === undefined ? [] : reports,
    finalPerformances: finalPerformances === undefined ? {} : finalPerformances,
  }
}

export async function migrateLegacy({ idb, session } = {}) {
  const flag = await idb.get(MIGRATION_FLAG)
  if (flag !== undefined) return { migrated: false }

  const [existingConfig, existingReports, existingFinalPerformances] = await Promise.all([
    idb.get(DATA_STORAGE_KEYS.config),
    idb.get(DATA_STORAGE_KEYS.reports),
    idb.get(DATA_STORAGE_KEYS.finalPerformances),
  ])

  const entries = []
  const legacyConfig = readSessionValue(session, DATA_STORAGE_KEYS.config)
  if (legacyConfig.present && legacyConfig.value !== null && existingConfig === undefined) {
    entries.push([DATA_STORAGE_KEYS.config, legacyConfig.value])
  }

  const hasStoredReports = Array.isArray(existingReports) && existingReports.length > 0
  if (!hasStoredReports) {
    const legacyReports = readSessionValue(session, DATA_STORAGE_KEYS.reports)
    if (Array.isArray(legacyReports.value) && legacyReports.value.length > 0) {
      entries.push([DATA_STORAGE_KEYS.reports, legacyReports.value])
    } else {
      const legacyReport = readSessionValue(session, LEGACY_REPORT_KEY)
      if (
        legacyReport.present &&
        legacyReport.value &&
        typeof legacyReport.value === 'object' &&
        !Array.isArray(legacyReport.value)
      ) {
        entries.push([
          DATA_STORAGE_KEYS.reports,
          [
            {
              ...legacyReport.value,
              id: makeId(),
              label: 'Informe 1',
            },
          ],
        ])
      }
    }
  }

  const legacyFinalPerformances = readSessionValue(session, DATA_STORAGE_KEYS.finalPerformances)
  if (
    legacyFinalPerformances.present &&
    legacyFinalPerformances.value !== null &&
    existingFinalPerformances === undefined
  ) {
    entries.push([DATA_STORAGE_KEYS.finalPerformances, legacyFinalPerformances.value])
  }

  if (entries.length === 0) return { migrated: false }

  entries.push([MIGRATION_FLAG, true])

  try {
    await idb.setMany(entries)
    return { migrated: true }
  } catch {
    return { migrated: false }
  }
}

/**
 * Structural equality that treats `undefined`-valued keys as significant:
 * `{ a: 1 }` and `{ a: 1, b: undefined }` are NOT equal. IndexedDB preserves
 * own keys with `undefined` values, so JSON serialization would silently drop
 * them and skip a write that actually changes the stored shape.
 */
export function deepEqual(a, b) {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false

  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]),
  )
}

export function createPersistQueue({ write, onError } = {}) {
  let enabled = false
  let pending = 0
  let failureScheduled = false
  const chains = new Map()
  const snapshots = new Map()

  const notifyFailure = (error) => {
    if (failureScheduled) return
    failureScheduled = true
    setTimeout(() => {
      failureScheduled = false
    }, 0)
    try {
      onError?.(error)
    } catch {
      /* The toast is best-effort; persistence failures never break the UI. */
    }
  }

  const prime = (key, value) => {
    snapshots.set(key, value)
  }

  const enqueue = (key, value) => {
    if (!enabled) return Promise.resolve(false)
    if (snapshots.has(key) && deepEqual(snapshots.get(key), value)) return Promise.resolve(false)
    snapshots.set(key, value)

    pending += 1
    const previous = chains.get(key) ?? Promise.resolve()
    const next = previous
      .catch(() => {})
      .then(async () => {
        try {
          await write(key, value)
          return true
        } catch (error) {
          // Forget the failed snapshot so the next enqueue of the same value
          // actually retries instead of being deduped as already persisted.
          if (snapshots.has(key) && deepEqual(snapshots.get(key), value)) snapshots.delete(key)
          notifyFailure(error)
          return false
        } finally {
          pending -= 1
        }
      })

    chains.set(key, next)
    return next
  }

  const enable = () => {
    enabled = true
  }

  const isIdle = () => pending === 0

  /*
   * Best-effort flush: awaits every write already scheduled in this tab.
   * A write still queued when the browser destroys the page can be lost in
   * that close race (IndexedDB commits asynchronously); the visibility flush
   * narrows the window but cannot eliminate it.
   */
  const flush = async () => {
    await Promise.all([...chains.values()].map((chain) => chain.catch(() => {})))
    return isIdle()
  }

  return { enqueue, prime, enable, isIdle, flush }
}
