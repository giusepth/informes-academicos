/**
 * Single-writer coordination between tabs of the same origin.
 *
 * The IndexedDB-backed app shares one data set between every open tab, so two
 * editing tabs would overwrite each other ("last write wins"). Web Locks gives
 * real exclusivity: the first page that asks with `ifAvailable` becomes the
 * writer and keeps the lock for its whole lifetime; every other page gets a
 * null lock and runs in read-only mode.
 *
 * There is no TTL, heartbeat or stale-lock takeover: the browser releases the
 * lock when the holding document is closed or crashes. A read-only page asks
 * again without `ifAvailable`, so it is promoted as soon as the writer dies.
 *
 * Without `navigator.locks` the module reports `unsupported` and the app keeps
 * its previous behaviour (both tabs editable; last write wins) with an
 * advisory notice instead of claiming exclusivity.
 */

const DEFAULT_NAME = 'informes.writer'

export function createWriterLock({ locks = globalThis.navigator?.locks, name = DEFAULT_NAME } = {}) {
  const supported = Boolean(locks && typeof locks.request === 'function')

  let writer = false
  let acquirePromise = null
  let promotePromise = null
  let releaseHeld = null
  const promoteCallbacks = new Set()

  /** Holds the lock until the returned promise resolves (page lifetime). */
  const hold = () =>
    new Promise((resolve) => {
      releaseHeld = resolve
    })

  /**
   * Requests the writer lock once per page. Resolves to `'writer'` when this
   * page owns the lock, `'reader'` when another page holds it, and
   * `'unsupported'` when the Web Locks API is unavailable or the request fails.
   * The single promise is memoized so StrictMode double-mounting cannot ask
   * twice or flash the wrong mode.
   */
  const acquire = () => {
    if (!supported) return Promise.resolve('unsupported')
    if (acquirePromise) return acquirePromise

    acquirePromise = new Promise((resolve) => {
      let settled = false
      const settle = (mode) => {
        if (settled) return
        settled = true
        resolve(mode)
      }

      try {
        const request = locks.request(
          name,
          { mode: 'exclusive', ifAvailable: true },
          (lock) => {
            if (!lock) {
              settle('reader')
              return undefined
            }
            writer = true
            settle('writer')
            return hold()
          },
        )
        if (request && typeof request.then === 'function') {
          request.catch(() => {
            writer = false
            settle('unsupported')
          })
        }
      } catch {
        settle('unsupported')
      }
    })

    return acquirePromise
  }

  /**
   * Queues a promotion request (no `ifAvailable`) and runs `onGranted` once the
   * previous writer releases. While pending the page stays read-only. Repeated
   * calls (the banner's retry button) share one request and one callback per
   * function identity.
   */
  const promote = (onGranted) => {
    if (!supported) {
      return Promise.resolve(false)
    }
    if (writer) {
      if (typeof onGranted === 'function') {
        try {
          onGranted()
        } catch {
          /* A promotion callback must never break the page. */
        }
      }
      return Promise.resolve(true)
    }
    if (typeof onGranted === 'function') promoteCallbacks.add(onGranted)
    if (promotePromise) return promotePromise

    promotePromise = new Promise((resolve) => {
      let settled = false
      const settle = (value) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      try {
        const request = locks.request(name, { mode: 'exclusive' }, () => {
          writer = true
          const callbacks = [...promoteCallbacks]
          promoteCallbacks.clear()
          callbacks.forEach((callback) => {
            try {
              callback()
            } catch {
              /* One failing callback must not strand the lock. */
            }
          })
          settle(true)
          return hold()
        })
        if (request && typeof request.then === 'function') {
          request.catch(() => {
            promotePromise = null
            promoteCallbacks.clear()
            settle(false)
          })
        }
      } catch {
        promotePromise = null
        promoteCallbacks.clear()
        settle(false)
      }
    })

    return promotePromise
  }

  /** Best-effort release: resolves the promise the browser is waiting on. */
  const release = () => {
    writer = false
    const resolve = releaseHeld
    releaseHeld = null
    resolve?.()
  }

  return {
    acquire,
    promote,
    release,
    get isWriter() {
      return writer
    },
    get isSupported() {
      return supported
    },
  }
}

/** One lock per page: module scope keeps StrictMode from acquiring twice. */
export const writerLock = createWriterLock()

export default writerLock
