export const DB_NAME = 'informes'
export const DB_VERSION = 1
export const STORE = 'kv'

const UNAVAILABLE = 'IndexedDB is not available'
const BLOCKED = 'IndexedDB blocked by another connection'
const OPEN_TIMED_OUT = 'IndexedDB open timed out'
const TRANSACTION_FAILED = 'IndexedDB transaction failed'
const DEFAULT_OPEN_TIMEOUT_MS = 5000

/**
 * Creates a promise-based key/value adapter on top of IndexedDB.
 *
 * The factory reads `indexedDB` from its options when the property is present,
 * so `{ indexedDB: null }` explicitly models an unavailable environment.
 * Without the property it falls back to `globalThis.indexedDB`.
 *
 * @param {object} [options]
 * @param {IDBFactory | null} [options.indexedDB] IndexedDB implementation.
 * @param {string} [options.dbName] Database name.
 * @param {number} [options.version] Schema version.
 * @param {number} [options.openTimeoutMs] Maximum wait for `open()` before
 *   reporting unavailable (a hung open must not freeze the boot splash).
 * @returns {{ openDb: () => Promise<IDBDatabase>, get: (key: IDBValidKey) => Promise<unknown>, set: (key: IDBValidKey, value: unknown) => Promise<boolean>, setMany: (entries: Array<[IDBValidKey, unknown]>) => Promise<boolean>, remove: (key: IDBValidKey) => Promise<boolean>, isAvailable: () => Promise<boolean>, close: () => Promise<void> }}
 */
export function createIdbStorage(options = {}) {
  const dbName = options.dbName ?? DB_NAME
  const version = options.version ?? DB_VERSION
  const openTimeoutMs = options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS
  const indexedDB = 'indexedDB' in options ? options.indexedDB : globalThis.indexedDB

  let dbPromise = null

  /**
   * Opens the database once and memoizes the connection. The memo is cleared
   * on failure, on `versionchange` and on `close()` so a later call reopens.
   *
   * @returns {Promise<IDBDatabase>}
   */
  const openDb = () => {
    if (!indexedDB) return Promise.reject(new Error(UNAVAILABLE))
    if (dbPromise) return dbPromise

    dbPromise = new Promise((resolve, reject) => {
      let abandoned = false
      let timer

      const abandon = (error) => {
        if (abandoned) return
        abandoned = true
        clearTimeout(timer)
        dbPromise = null
        reject(error)
      }

      // A hung open (policy prompt, broken profile) would otherwise leave the
      // boot splash forever; after the timeout the app falls back to session.
      timer = setTimeout(() => abandon(new Error(OPEN_TIMED_OUT)), openTimeoutMs)

      let request
      try {
        request = indexedDB.open(dbName, version)
      } catch (error) {
        clearTimeout(timer)
        dbPromise = null
        reject(error)
        return
      }

      request.onupgradeneeded = () => {
        if (abandoned) return
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: null })
        }
      }

      request.onsuccess = () => {
        if (abandoned) {
          // The timeout already rejected this attempt; do not leak the
          // connection it eventually produced.
          request.result.close()
          return
        }
        clearTimeout(timer)
        const db = request.result
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        resolve(db)
      }

      request.onerror = () => {
        abandon(request.error ?? new Error('IndexedDB failed to open'))
      }

      request.onblocked = () => abandon(new Error(BLOCKED))
    })

    return dbPromise
  }

  /**
   * Runs a request inside a transaction and resolves only after the
   * transaction completes, so reads observe committed data and writes are
   * durable. A request error aborts the transaction and rejects the promise.
   *
   * @param {IDBDatabase} db
   * @param {IDBTransactionMode} mode
   * @param {(store: IDBObjectStore, capture: (value: unknown) => void) => void} run
   * @returns {Promise<unknown>}
   */
  const transact = (db, mode, run) =>
    new Promise((resolve, reject) => {
      let result
      let settled = false

      const fail = (error) => {
        if (settled) return
        settled = true
        reject(error ?? new Error(TRANSACTION_FAILED))
      }

      const tx = db.transaction(STORE, mode)

      tx.oncomplete = () => {
        if (settled) return
        settled = true
        resolve(result)
      }
      tx.onerror = () => fail(tx.error)
      tx.onabort = () => fail(tx.error)

      try {
        run(tx.objectStore(STORE), (value) => {
          result = value
        })
      } catch (error) {
        fail(error)
        try {
          tx.abort()
        } catch {
          /* The transaction may already be inactive when a request throws. */
        }
      }
    })

  /**
   * Closes the open connection, if any, and clears the memo.
   *
   * @returns {Promise<void>}
   */
  const close = async () => {
    const pending = dbPromise
    dbPromise = null
    if (!pending) return
    try {
      const db = await pending
      db.close()
    } catch {
      /* A failed or blocked open has no connection to close. */
    }
  }

  /**
   * Reads a key inside one readonly transaction.
   *
   * @param {IDBValidKey} key
   * @returns {Promise<unknown>} Stored value, or `undefined` when missing.
   */
  const get = async (key) => {
    const db = await openDb()
    return transact(db, 'readonly', (store, capture) => {
      const request = store.get(key)
      request.onsuccess = () => capture(request.result)
    })
  }

  /**
   * Stores a structured-clone value. `null` and `undefined` remove the key.
   *
   * @param {IDBValidKey} key
   * @param {unknown} value
   * @returns {Promise<boolean>} Resolves true after the transaction commits.
   */
  const set = async (key, value) => {
    if (value === null || value === undefined) return remove(key)
    const db = await openDb()
    await transact(db, 'readwrite', (store) => {
      store.put(value, key)
    })
    return true
  }

  /**
   * Stores several key/value pairs in one atomic transaction. `null` and
   * `undefined` values delete their key; any failure rolls the whole batch
   * back, so partial migrations can never happen.
   *
   * @param {Array<[IDBValidKey, unknown]>} entries
   * @returns {Promise<boolean>} Resolves true after the transaction commits.
   */
  const setMany = async (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return true
    const db = await openDb()
    await transact(db, 'readwrite', (store) => {
      for (const [key, value] of entries) {
        if (value === null || value === undefined) store.delete(key)
        else store.put(value, key)
      }
    })
    return true
  }

  /**
   * Deletes a key.
   *
   * @param {IDBValidKey} key
   * @returns {Promise<boolean>} Resolves true after the transaction commits.
   */
  const remove = async (key) => {
    const db = await openDb()
    await transact(db, 'readwrite', (store) => {
      store.delete(key)
    })
    return true
  }

  /**
   * Reports whether IndexedDB can open the configured database. Never throws.
   *
   * @returns {Promise<boolean>}
   */
  const isAvailable = async () => {
    if (!indexedDB) return false
    try {
      await openDb()
      await close()
      return true
    } catch {
      return false
    }
  }

  return { openDb, get, set, setMany, remove, isAvailable, close }
}

/** Shared adapter for application code. */
export const idb = createIdbStorage()

export default idb
