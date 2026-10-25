import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPersistenceRequester } from './persistence'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createPersistenceRequester', () => {
  it('calls persist at most once per page load and memoizes the granted result', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    const requester = createPersistenceRequester({ storage: { persist } })

    const first = requester.requestOnce()
    const second = requester.requestOnce()

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('memoizes the in-flight promise across overlapping calls', async () => {
    const pending = deferred()
    const persist = vi.fn(() => pending.promise)
    const requester = createPersistenceRequester({ storage: { persist } })

    const first = requester.requestOnce()
    const second = requester.requestOnce()
    expect(first).toBe(second)

    pending.resolve(true)
    await Promise.all([first, second])
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('resolves false and never throws when persist rejects', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied by policy'))
    const requester = createPersistenceRequester({ storage: { persist } })

    await expect(requester.requestOnce()).resolves.toBe(false)
    expect(requester.getStatus()).toBe('denied')
  })

  it('returns null and stays unsupported when the API is missing', async () => {
    const requester = createPersistenceRequester({ storage: {} })

    expect(requester.getStatus()).toBe('unsupported')
    await expect(requester.requestOnce()).resolves.toBeNull()
    await expect(requester.requestOnce()).resolves.toBeNull()
    expect(requester.getStatus()).toBe('unsupported')
  })

  it('reports unknown while the request is in flight, then granted', async () => {
    const pending = deferred()
    const persist = vi.fn(() => pending.promise)
    const requester = createPersistenceRequester({ storage: { persist } })

    expect(requester.getStatus()).toBe('unknown')
    const result = requester.requestOnce()
    expect(requester.getStatus()).toBe('unknown')

    pending.resolve(true)
    await expect(result).resolves.toBe(true)
    expect(requester.getStatus()).toBe('granted')
  })

  it('reports denied when the browser resolves false', async () => {
    const persist = vi.fn().mockResolvedValue(false)
    const requester = createPersistenceRequester({ storage: { persist } })

    expect(requester.getStatus()).toBe('unknown')
    await expect(requester.requestOnce()).resolves.toBe(false)
    expect(requester.getStatus()).toBe('denied')
  })

  it('accepts an injected persist function for tests', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    const requester = createPersistenceRequester({ persist })

    await expect(requester.requestOnce()).resolves.toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(requester.getStatus()).toBe('granted')
  })

  it('does not request persistence just by importing the module', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persist } })
    vi.resetModules()

    const mod = await import('./persistence')

    expect(typeof mod.createPersistenceRequester).toBe('function')
    expect(persist).not.toHaveBeenCalled()
  })
})
