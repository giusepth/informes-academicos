import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIdbStorage } from './idbStorage'

let dbSequence = 0
const liveStorages = []

const makeStorage = (options = {}) => {
  const storage = createIdbStorage({
    indexedDB: 'indexedDB' in options ? options.indexedDB : new IDBFactory(),
    dbName: options.dbName ?? `test-${++dbSequence}`,
    version: options.version,
  })
  liveStorages.push(storage)
  return storage
}

/**
 * Delegates to fake-indexeddb but wraps every opened connection so `put`
 * throws synchronously. This makes quota failures deterministic instead of
 * depending on the fake implementation's write limit.
 */
const quotaIndexedDB = (factory) => ({
  open(name, version) {
    const request = factory.open(name, version)
    let wrappedDb

    return new Proxy(request, {
      get(target, property) {
        if (property !== 'result') {
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        }

        const db = target.result
        if (!db) return db

        wrappedDb ??= new Proxy(db, {
          get(dbTarget, dbProperty) {
            if (dbProperty === 'transaction') {
              return (...args) => {
                const tx = dbTarget.transaction(...args)
                return new Proxy(tx, {
                  get(txTarget, txProperty) {
                    if (txProperty === 'objectStore') {
                      return (storeName) => {
                        const store = txTarget.objectStore(storeName)
                        return new Proxy(store, {
                          get(storeTarget, storeProperty) {
                            if (storeProperty === 'put') {
                              return () => {
                                throw new DOMException('quota exceeded', 'QuotaExceededError')
                              }
                            }
                            const value = Reflect.get(storeTarget, storeProperty, storeTarget)
                            return typeof value === 'function' ? value.bind(storeTarget) : value
                          },
                        })
                      }
                    }
                    const value = Reflect.get(txTarget, txProperty, txTarget)
                    return typeof value === 'function' ? value.bind(txTarget) : value
                  },
                  set(txTarget, txProperty, value) {
                    txTarget[txProperty] = value
                    return true
                  },
                })
              }
            }
            const value = Reflect.get(dbTarget, dbProperty, dbTarget)
            return typeof value === 'function' ? value.bind(dbTarget) : value
          },
          set(dbTarget, dbProperty, value) {
            dbTarget[dbProperty] = value
            return true
          },
        })

        return wrappedDb
      },
      set(target, property, value) {
        target[property] = value
        return true
      },
    })
  },
})

afterEach(async () => {
  await Promise.all(liveStorages.splice(0).map((storage) => storage.close()))
})

describe('get', () => {
  it('resolves undefined for a missing key', async () => {
    const storage = makeStorage()
    await expect(storage.get('missing')).resolves.toBeUndefined()
  })
})

describe('set', () => {
  it('round-trips nested objects, arrays and falsy primitives', async () => {
    const storage = makeStorage()
    const value = { nested: { list: [1, 'two', { three: false }] } }

    await expect(storage.set('object', value)).resolves.toBe(true)
    await storage.set('false', false)
    await storage.set('empty', '')
    await storage.set('zero', 0)

    await expect(storage.get('object')).resolves.toEqual(value)
    await expect(storage.get('false')).resolves.toBe(false)
    await expect(storage.get('empty')).resolves.toBe('')
    await expect(storage.get('zero')).resolves.toBe(0)
  })

  it('preserves structured-clone values such as Date and undefined properties', async () => {
    const storage = makeStorage()
    const value = { createdAt: new Date('2026-10-24T12:00:00.000Z'), optional: undefined }

    await storage.set('clone', value)
    const stored = await storage.get('clone')

    expect(stored.createdAt).toBeInstanceOf(Date)
    expect(stored.createdAt.toISOString()).toBe('2026-10-24T12:00:00.000Z')
    expect('optional' in stored).toBe(true)
    expect(stored.optional).toBeUndefined()
  })

  it('removes the key when the value is null', async () => {
    const storage = makeStorage()
    await storage.set('key', 'value')

    await expect(storage.set('key', null)).resolves.toBe(true)
    await expect(storage.get('key')).resolves.toBeUndefined()
  })

  it('removes the key when the value is undefined', async () => {
    const storage = makeStorage()
    await storage.set('key', 'value')

    await expect(storage.set('key', undefined)).resolves.toBe(true)
    await expect(storage.get('key')).resolves.toBeUndefined()
  })

  it('surfaces transaction errors such as QuotaExceededError', async () => {
    const storage = makeStorage({ indexedDB: quotaIndexedDB(new IDBFactory()) })

    await expect(storage.set('key', 'value')).rejects.toMatchObject({
      name: 'QuotaExceededError',
    })
  })

  it('keeps concurrent writes and lets the last same-key write win', async () => {
    const storage = makeStorage()
    const writes = Array.from({ length: 10 }, (_, index) => storage.set(`key-${index}`, index))

    await expect(Promise.all(writes)).resolves.toEqual(Array(10).fill(true))

    for (let index = 0; index < 10; index += 1) {
      await expect(storage.get(`key-${index}`)).resolves.toBe(index)
    }

    await Promise.all(Array.from({ length: 10 }, (_, index) => storage.set('shared', index)))
    await expect(storage.get('shared')).resolves.toBe(9)
  })
})

describe('setMany', () => {
  it('writes every pair in a single transaction and deletes null values', async () => {
    const storage = makeStorage()
    await storage.set('obsolete', 'value')

    await expect(
      storage.setMany([
        ['first', 1],
        ['second', { nested: true }],
        ['obsolete', null],
      ]),
    ).resolves.toBe(true)

    await expect(storage.get('first')).resolves.toBe(1)
    await expect(storage.get('second')).resolves.toEqual({ nested: true })
    await expect(storage.get('obsolete')).resolves.toBeUndefined()
  })

  it('rolls back the whole batch when one write fails', async () => {
    const storage = makeStorage()

    await expect(
      storage.setMany([
        ['first', 1],
        ['second', () => {}],
      ]),
    ).rejects.toMatchObject({ name: 'DataCloneError' })

    await expect(storage.get('first')).resolves.toBeUndefined()
    await expect(storage.get('second')).resolves.toBeUndefined()
  })
})

describe('remove', () => {
  it('deletes an existing key', async () => {
    const storage = makeStorage()
    await storage.set('key', 'value')

    await expect(storage.remove('key')).resolves.toBe(true)
    await expect(storage.get('key')).resolves.toBeUndefined()
  })
})

describe('isAvailable', () => {
  it('returns false when indexedDB is explicitly unavailable and never throws', async () => {
    const storage = makeStorage({ indexedDB: null })
    await expect(storage.isAvailable()).resolves.toBe(false)
  })

  it('returns true after opening and closing the real database', async () => {
    const storage = makeStorage()
    await expect(storage.isAvailable()).resolves.toBe(true)
  })

  it('reports unavailable after the open timeout instead of hanging forever', async () => {
    vi.useFakeTimers()
    try {
      const storage = makeStorage({ indexedDB: { open: () => ({}) } })
      const pending = storage.isAvailable()

      await vi.advanceTimersByTimeAsync(5000)

      await expect(pending).resolves.toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('connection lifecycle', () => {
  it('memoizes openDb', async () => {
    const storage = makeStorage()
    expect(storage.openDb()).toBe(storage.openDb())
    await storage.openDb()
  })

  it('close() releases the memo so later operations reopen the database', async () => {
    const storage = makeStorage()
    await storage.set('key', 'value')
    await storage.close()

    await expect(storage.get('key')).resolves.toBe('value')
  })

  it('releases the connection on versionchange so a newer version can reopen', async () => {
    const factory = new IDBFactory()
    const dbName = `test-versionchange-${++dbSequence}`
    const storage = makeStorage({ indexedDB: factory, dbName })
    await storage.set('persisted', 'yes')

    const upgraded = await new Promise((resolve, reject) => {
      const request = factory.open(dbName, 2)
      request.onupgradeneeded = () => {}
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect(upgraded.version).toBe(2)
    upgraded.close()

    const next = makeStorage({ indexedDB: factory, dbName, version: 2 })
    await expect(next.get('persisted')).resolves.toBe('yes')
  })
})
