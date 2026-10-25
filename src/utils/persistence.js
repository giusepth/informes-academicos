const UNSUPPORTED = 'unsupported'
const UNKNOWN = 'unknown'
const GRANTED = 'granted'
const DENIED = 'denied'

/**
 * One-shot wrapper around the Storage API persistence request.
 *
 * `requestOnce` is memoized per page load: concurrent and later calls share
 * the same promise, so `storage.persist()` runs at most once. It never
 * throws and resolves `null` when the API is missing, `true` when the
 * browser grants persistence and `false` when it denies it or the call
 * rejects. Creating the requester has no side effects.
 */
export function createPersistenceRequester({ storage, persist } = {}) {
  const source = storage === undefined ? globalThis.navigator?.storage : storage
  const persistFn = typeof persist === 'function' ? persist : source?.persist

  let status = persistFn ? UNKNOWN : UNSUPPORTED
  let request = null

  const requestOnce = () => {
    if (!persistFn) return Promise.resolve(null)
    if (request) return request

    request = Promise.resolve()
      .then(() => persistFn.call(source))
      .then((granted) => {
        status = granted ? GRANTED : DENIED
        return Boolean(granted)
      })
      .catch(() => {
        status = DENIED
        return false
      })

    return request
  }

  const getStatus = () => status

  return { requestOnce, getStatus }
}

export default createPersistenceRequester
