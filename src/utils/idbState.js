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

export function createPersistQueue({ write, onError } = {}) {
  let enabled = false
  let failureScheduled = false
  const chains = new Map()
  const queued = new Map()

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

  const signatureOf = (value) => {
    try {
      return JSON.stringify(value)
    } catch {
      return undefined
    }
  }

  const prime = (key, value) => {
    const signature = signatureOf(value)
    if (signature !== undefined) queued.set(key, signature)
  }

  const enqueue = (key, value) => {
    if (!enabled) return Promise.resolve(false)

    const signature = signatureOf(value)
    const canDedupe = signature !== undefined
    if (canDedupe && queued.get(key) === signature) return Promise.resolve(false)
    if (canDedupe) queued.set(key, signature)

    const previous = chains.get(key) ?? Promise.resolve()
    const next = previous
      .catch(() => {})
      .then(async () => {
        try {
          await write(key, value)
          return true
        } catch (error) {
          if (canDedupe && queued.get(key) === signature) queued.delete(key)
          notifyFailure(error)
          return false
        }
      })

    chains.set(key, next)
    return next
  }

  const enable = () => {
    enabled = true
  }

  return { enqueue, prime, enable }
}
