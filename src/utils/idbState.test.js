import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIdbStorage } from './idbStorage'
import {
  createPersistQueue,
  DATA_STORAGE_KEYS,
  deepEqual,
  loadDataState,
  MIGRATION_FLAG,
  migrateLegacy,
} from './idbState'

let dbSequence = 0
const liveStorages = []

const makeStorage = (options = {}) => {
  const storage = createIdbStorage({
    indexedDB: options.indexedDB ?? new IDBFactory(),
    dbName: options.dbName ?? `state-test-${++dbSequence}`,
  })
  liveStorages.push(storage)
  return storage
}

const sessionFrom = (entries) => new Map(Object.entries(entries))

afterEach(async () => {
  await Promise.all(liveStorages.splice(0).map((storage) => storage.close()))
})

describe('loadDataState', () => {
  it('returns the empty state shape when nothing is stored', async () => {
    const storage = makeStorage()
    await expect(loadDataState(storage)).resolves.toEqual({
      config: null,
      reports: [],
      finalPerformances: {},
    })
  })

  it('preserves falsy stored values instead of coercing them away', async () => {
    const storage = makeStorage()
    await storage.set(DATA_STORAGE_KEYS.config, false)
    await storage.set(DATA_STORAGE_KEYS.reports, 0)
    await storage.set(DATA_STORAGE_KEYS.finalPerformances, '')

    await expect(loadDataState(storage)).resolves.toEqual({
      config: false,
      reports: 0,
      finalPerformances: '',
    })
  })

  it('returns the three stored slices independently', async () => {
    const storage = makeStorage()
    const config = { institution: 'Colegio Ejemplo', scaleType: 'decimal' }
    const reports = [{ id: 'r_1', label: 'Informe 1', students: [] }]
    const finalPerformances = { ANA: { Matemáticas: 'Alto desempeño' } }

    await storage.set(DATA_STORAGE_KEYS.config, config)
    await storage.set(DATA_STORAGE_KEYS.reports, reports)
    await storage.set(DATA_STORAGE_KEYS.finalPerformances, finalPerformances)

    await expect(loadDataState(storage)).resolves.toEqual({ config, reports, finalPerformances })
  })
})

describe('migrateLegacy', () => {
  it('wraps a legacy single report as Informe 1 when IndexedDB has no reports', async () => {
    const storage = makeStorage()
    const legacy = {
      id: 'legacy-id',
      label: 'Old single report',
      grade: '5° A',
      teacher: 'Prof. Rivera',
      subjects: ['Matemáticas'],
      students: [{ id: 'legacy-student', name: 'Ana', scores: { Matemáticas: 4.5 } }],
    }
    const session = sessionFrom({ 'informes.report': JSON.stringify(legacy) })

    await expect(migrateLegacy({ idb: storage, session })).resolves.toEqual({ migrated: true })

    const reports = await storage.get(DATA_STORAGE_KEYS.reports)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      grade: '5° A',
      teacher: 'Prof. Rivera',
      subjects: ['Matemáticas'],
      label: 'Informe 1',
    })
    expect(reports[0].id).toBeTruthy()
    expect(reports[0].id).not.toBe('legacy-id')
    expect(reports[0].students).toEqual(legacy.students)
  })

  it('migrates config, reports and finalPerformances in one write including the one-shot flag', async () => {
    const storage = makeStorage()
    const calls = []
    const idb = {
      get: storage.get,
      setMany: async (entries) => {
        calls.push(entries)
        return storage.setMany(entries)
      },
    }
    const config = { institution: 'Colegio Legacy' }
    const reports = [{ id: 'r_1', label: 'Informe 1', students: [] }]
    const finalPerformances = { ANA: { Matemáticas: 'Previo' } }
    const session = sessionFrom({
      'informes.config': JSON.stringify(config),
      'informes.reports': JSON.stringify(reports),
      'informes.finalPerformances': JSON.stringify(finalPerformances),
    })

    await expect(migrateLegacy({ idb, session })).resolves.toEqual({ migrated: true })

    expect(calls).toHaveLength(1)
    expect(calls[0].map(([key]) => key)).toEqual([
      DATA_STORAGE_KEYS.config,
      DATA_STORAGE_KEYS.reports,
      DATA_STORAGE_KEYS.finalPerformances,
      MIGRATION_FLAG,
    ])
    await expect(storage.get(DATA_STORAGE_KEYS.config)).resolves.toEqual(config)
    await expect(storage.get(DATA_STORAGE_KEYS.reports)).resolves.toEqual(reports)
    await expect(storage.get(DATA_STORAGE_KEYS.finalPerformances)).resolves.toEqual(finalPerformances)
    await expect(storage.get(MIGRATION_FLAG)).resolves.toBe(true)
  })

  it('never overwrites existing IndexedDB values and skips the wrapped legacy report', async () => {
    const storage = makeStorage()
    const existingConfig = { institution: 'Already in IDB' }
    const existingReports = [{ id: 'r_idb', label: 'Informe IDB', students: [] }]
    await storage.set(DATA_STORAGE_KEYS.config, existingConfig)
    await storage.set(DATA_STORAGE_KEYS.reports, existingReports)

    const session = sessionFrom({
      'informes.config': JSON.stringify({ institution: 'From session' }),
      'informes.reports': JSON.stringify([{ id: 'r_legacy', label: 'Informe legacy', students: [] }]),
      'informes.finalPerformances': JSON.stringify({ ANA: { Matemáticas: 'Nueva' } }),
      'informes.report': JSON.stringify({ id: 'legacy', students: [] }),
    })

    await expect(migrateLegacy({ idb: storage, session })).resolves.toEqual({ migrated: true })

    await expect(storage.get(DATA_STORAGE_KEYS.config)).resolves.toEqual(existingConfig)
    await expect(storage.get(DATA_STORAGE_KEYS.reports)).resolves.toEqual(existingReports)
    await expect(storage.get(DATA_STORAGE_KEYS.finalPerformances)).resolves.toEqual({
      ANA: { Matemáticas: 'Nueva' },
    })
  })

  it('is idempotent when the one-shot flag already exists', async () => {
    const storage = makeStorage()
    await storage.set(MIGRATION_FLAG, true)
    const setMany = vi.fn()
    const session = sessionFrom({
      'informes.config': JSON.stringify({ institution: 'Legacy' }),
      'informes.reports': JSON.stringify([{ id: 'r_1', label: 'Informe 1', students: [] }]),
    })

    await expect(migrateLegacy({ idb: { get: storage.get, setMany }, session })).resolves.toEqual({
      migrated: false,
    })
    expect(setMany).not.toHaveBeenCalled()
    await expect(storage.get(DATA_STORAGE_KEYS.config)).resolves.toBeUndefined()
    await expect(storage.get(DATA_STORAGE_KEYS.reports)).resolves.toBeUndefined()
  })

  it('skips corrupt JSON keys individually and still migrates the valid ones', async () => {
    const storage = makeStorage()
    const reports = [{ id: 'r_1', label: 'Informe 1', students: [] }]
    const session = sessionFrom({
      'informes.config': '{not-json',
      'informes.reports': JSON.stringify(reports),
      'informes.finalPerformances': 'also-not-json',
    })

    await expect(migrateLegacy({ idb: storage, session })).resolves.toEqual({ migrated: true })

    await expect(storage.get(DATA_STORAGE_KEYS.config)).resolves.toBeUndefined()
    await expect(storage.get(DATA_STORAGE_KEYS.reports)).resolves.toEqual(reports)
    await expect(storage.get(DATA_STORAGE_KEYS.finalPerformances)).resolves.toBeUndefined()
    await expect(storage.get(MIGRATION_FLAG)).resolves.toBe(true)
  })

  it('preserves falsy legacy config and finalPerformances values', async () => {
    const storage = makeStorage()
    const session = sessionFrom({
      'informes.config': 'false',
      'informes.finalPerformances': '""',
    })

    await expect(migrateLegacy({ idb: storage, session })).resolves.toEqual({ migrated: true })

    await expect(storage.get(DATA_STORAGE_KEYS.config)).resolves.toBe(false)
    await expect(storage.get(DATA_STORAGE_KEYS.reports)).resolves.toBeUndefined()
    await expect(storage.get(DATA_STORAGE_KEYS.finalPerformances)).resolves.toBe('')
  })

  it('keeps legacy keys and reports failure without throwing when the write fails', async () => {
    const storage = makeStorage()
    const session = sessionFrom({
      'informes.config': JSON.stringify({ institution: 'Legacy' }),
      'informes.reports': JSON.stringify([{ id: 'r_1', label: 'Informe 1', students: [] }]),
    })
    const idb = {
      get: storage.get,
      setMany: async () => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      },
    }

    await expect(migrateLegacy({ idb, session })).resolves.toEqual({
      migrated: false,
      failed: true,
    })

    expect(session.has('informes.config')).toBe(true)
    expect(session.has('informes.reports')).toBe(true)
    await expect(storage.get(DATA_STORAGE_KEYS.config)).resolves.toBeUndefined()
    await expect(storage.get(MIGRATION_FLAG)).resolves.toBeUndefined()
  })

  it('flags a skipped legacy report so it cannot resurrect after IDB reports are cleared', async () => {
    const storage = makeStorage()
    const existingReports = [{ id: 'r_idb', label: 'Informe IDB', students: [] }]
    await storage.set(DATA_STORAGE_KEYS.reports, existingReports)
    const session = sessionFrom({
      'informes.report': JSON.stringify({ id: 'legacy', label: 'Viejo', students: [] }),
    })
    const idb = { get: storage.get, setMany: storage.setMany }

    await expect(migrateLegacy({ idb, session })).resolves.toEqual({ migrated: false })

    await expect(storage.get(MIGRATION_FLAG)).resolves.toBe(true)
    await expect(storage.get(DATA_STORAGE_KEYS.reports)).resolves.toEqual(existingReports)

    await storage.remove(DATA_STORAGE_KEYS.reports)
    await expect(migrateLegacy({ idb, session })).resolves.toEqual({ migrated: false })
    await expect(storage.get(DATA_STORAGE_KEYS.reports)).resolves.toBeUndefined()
  })

  it('does not write anything when there is nothing to migrate', async () => {
    const storage = makeStorage()
    const setMany = vi.fn()

    await expect(
      migrateLegacy({ idb: { get: storage.get, setMany }, session: sessionFrom({}) }),
    ).resolves.toEqual({ migrated: false })
    expect(setMany).not.toHaveBeenCalled()
    await expect(storage.get(MIGRATION_FLAG)).resolves.toBeUndefined()
  })
})

describe('deepEqual', () => {
  it('treats undefined-valued keys as significant', () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
  })

  it('compares nested arrays and objects structurally', () => {
    expect(deepEqual({ list: [1, { b: 2 }] }, { list: [1, { b: 2 }] })).toBe(true)
    expect(deepEqual({ list: [1, { b: 2 }] }, { list: [1, { b: 3 }] })).toBe(false)
  })
})

describe('createPersistQueue', () => {
  it('does not write before hydration is enabled', async () => {
    const write = vi.fn().mockResolvedValue(true)
    const queue = createPersistQueue({ write, onError: vi.fn() })

    await queue.enqueue('key', 'value')
    expect(write).not.toHaveBeenCalled()

    queue.enable()
    await queue.enqueue('key', 'value')
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith('key', 'value')
  })

  it('serializes writes per key and keeps the last enqueued value', async () => {
    const writes = []
    let releaseFirst
    let signalStarted
    const started = new Promise((resolve) => {
      signalStarted = resolve
    })
    const write = vi.fn(async (key, value) => {
      writes.push([key, value])
      if (value === 1) {
        signalStarted()
        await new Promise((resolve) => {
          releaseFirst = resolve
        })
      }
      return true
    })
    const queue = createPersistQueue({ write, onError: vi.fn() })
    queue.enable()

    const first = queue.enqueue('key', 1)
    const second = queue.enqueue('key', 2)

    await started
    expect(writes).toEqual([['key', 1]])
    releaseFirst()
    await Promise.all([first, second])
    expect(writes).toEqual([
      ['key', 1],
      ['key', 2],
    ])
  })

  it('skips a deep-equal value instead of writing it twice', async () => {
    const write = vi.fn().mockResolvedValue(true)
    const queue = createPersistQueue({ write, onError: vi.fn() })
    queue.enable()

    await queue.enqueue('key', { nested: [1, 'two', { three: false }] })
    await queue.enqueue('key', { nested: [1, 'two', { three: false }] })

    expect(write).toHaveBeenCalledTimes(1)
  })

  it('treats primed hydrated values as already persisted', async () => {
    const write = vi.fn().mockResolvedValue(true)
    const queue = createPersistQueue({ write, onError: vi.fn() })

    queue.prime('key', { from: 'IndexedDB' })
    queue.enable()
    await queue.enqueue('key', { from: 'IndexedDB' })

    expect(write).not.toHaveBeenCalled()
  })

  it('resolves failed writes without rejecting and calls onError once per failure batch', async () => {
    const write = vi
      .fn()
      .mockRejectedValue(new DOMException('quota exceeded', 'QuotaExceededError'))
    const onError = vi.fn()
    const queue = createPersistQueue({ write, onError })
    queue.enable()

    const first = queue.enqueue('a', 1)
    const second = queue.enqueue('b', 2)

    await expect(Promise.all([first, second])).resolves.toEqual([false, false])
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('writes twice when a key is added with an undefined value', async () => {
    const write = vi.fn().mockResolvedValue(true)
    const queue = createPersistQueue({ write, onError: vi.fn() })
    queue.enable()

    await queue.enqueue('key', { a: 1 })
    await queue.enqueue('key', { a: 1, b: undefined })

    expect(write).toHaveBeenCalledTimes(2)
  })

  it('retries a failed value on the next enqueue instead of deduping it', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(true)
    const queue = createPersistQueue({ write, onError: vi.fn() })
    queue.enable()

    await expect(queue.enqueue('key', { a: 1 })).resolves.toBe(false)
    await expect(queue.enqueue('key', { a: 1 })).resolves.toBe(true)

    expect(write).toHaveBeenCalledTimes(2)
  })

  it('reports idleness and flushes in-flight writes', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const write = vi.fn(async () => {
      await gate
      return true
    })
    const queue = createPersistQueue({ write, onError: vi.fn() })
    queue.enable()

    const first = queue.enqueue('key', 1)
    expect(queue.isIdle()).toBe(false)

    const flushed = queue.flush()
    expect(queue.isIdle()).toBe(false)

    release()
    await expect(flushed).resolves.toBe(true)
    await expect(first).resolves.toBe(true)
    expect(queue.isIdle()).toBe(true)
  })
})
