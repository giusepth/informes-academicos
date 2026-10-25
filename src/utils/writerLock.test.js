import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWriterLock } from './writerLock'

/**
 * Minimal faithful stand-in for the Web Locks manager. A granted request keeps
 * the lock until the callback's returned promise settles, exactly like the
 * platform: the writer lock holds a promise that only `release()` resolves.
 */
function createFakeLocks() {
  const held = new Set()
  const waiting = new Map()
  const state = { requests: 0 }

  const flush = (name) => {
    const queue = waiting.get(name)
    if (!queue || queue.length === 0) return
    const next = queue.shift()
    if (queue.length === 0) waiting.delete(name)
    next()
  }

  const request = (name, options, callback) =>
    new Promise((resolve) => {
      const attempt = () => {
        if (held.has(name)) {
          if (options?.ifAvailable) {
            resolve(callback(null))
            return
          }
          const queue = waiting.get(name) ?? []
          queue.push(attempt)
          waiting.set(name, queue)
          return
        }

        held.add(name)
        let result
        try {
          result = callback({ name, mode: options?.mode ?? 'exclusive' })
        } catch {
          held.delete(name)
          flush(name)
          resolve(undefined)
          return
        }

        Promise.resolve(result).then(
          (value) => {
            held.delete(name)
            flush(name)
            resolve(value)
          },
          () => {
            held.delete(name)
            flush(name)
            resolve(undefined)
          },
        )
      }
      attempt()
    })

  return {
    request: (...args) => {
      state.requests += 1
      return request(...args)
    },
    isHeld: (name) => held.has(name),
    requests: () => state.requests,
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createWriterLock', () => {
  it('acquires an exclusive writer lock with ifAvailable', async () => {
    const locks = createFakeLocks()
    const lock = createWriterLock({ locks, name: 'test.writer' })

    expect(lock.isSupported).toBe(true)
    await expect(lock.acquire()).resolves.toBe('writer')
    expect(lock.isWriter).toBe(true)
    expect(locks.isHeld('test.writer')).toBe(true)
  })

  it('reports reader when another page holds the lock', async () => {
    const locks = createFakeLocks()
    const first = createWriterLock({ locks, name: 'test.writer' })
    await first.acquire()

    const second = createWriterLock({ locks, name: 'test.writer' })
    await expect(second.acquire()).resolves.toBe('reader')
    expect(second.isWriter).toBe(false)
  })

  it('promotes to writer once the current holder releases', async () => {
    const locks = createFakeLocks()
    const first = createWriterLock({ locks, name: 'test.writer' })
    await first.acquire()

    const second = createWriterLock({ locks, name: 'test.writer' })
    await expect(second.acquire()).resolves.toBe('reader')

    const onGranted = vi.fn()
    let promoted = false
    const promotion = second.promote(onGranted).then(() => {
      promoted = true
    })

    await settle()
    expect(promoted).toBe(false)
    expect(onGranted).not.toHaveBeenCalled()
    expect(second.isWriter).toBe(false)

    first.release()
    await promotion
    expect(promoted).toBe(true)
    expect(onGranted).toHaveBeenCalledTimes(1)
    expect(second.isWriter).toBe(true)
  })

  it('memoizes acquire to a single request per page', async () => {
    const locks = createFakeLocks()
    const lock = createWriterLock({ locks, name: 'test.writer' })

    const [first, second] = await Promise.all([lock.acquire(), lock.acquire()])
    await lock.acquire()

    expect(first).toBe('writer')
    expect(second).toBe('writer')
    expect(locks.requests()).toBe(1)
  })

  it('promotes idempotently and calls onGranted once', async () => {
    const locks = createFakeLocks()
    const first = createWriterLock({ locks, name: 'test.writer' })
    await first.acquire()

    const second = createWriterLock({ locks, name: 'test.writer' })
    await second.acquire()
    const onGranted = vi.fn()

    const firstAttempt = second.promote(onGranted)
    const retry = second.promote(onGranted)
    // Two acquisitions plus exactly one queued promotion request.
    expect(locks.requests()).toBe(3)

    first.release()
    await Promise.all([firstAttempt, retry])

    expect(onGranted).toHaveBeenCalledTimes(1)
    expect(second.isWriter).toBe(true)
  })

  it('is unsupported without navigator.locks and never throws', async () => {
    vi.stubGlobal('navigator', {})
    const lock = createWriterLock()

    expect(lock.isSupported).toBe(false)
    await expect(lock.acquire()).resolves.toBe('unsupported')
    await expect(lock.promote()).resolves.toBe(false)
    expect(() => lock.release()).not.toThrow()
  })

  it('survives a rejecting locks manager without unhandled rejections', async () => {
    const rejections = vi.fn()
    process.on('unhandledRejection', rejections)
    const locks = { request: () => Promise.reject(new Error('denied')) }
    const lock = createWriterLock({ locks })

    await expect(lock.acquire()).resolves.toBe('unsupported')
    await settle()

    process.off('unhandledRejection', rejections)
    expect(rejections).not.toHaveBeenCalled()
  })

  it('frees the lock on release for the next page to acquire', async () => {
    const locks = createFakeLocks()
    const first = createWriterLock({ locks, name: 'test.writer' })
    await first.acquire()

    const second = createWriterLock({ locks, name: 'test.writer' })
    await expect(second.acquire()).resolves.toBe('reader')

    first.release()
    await settle()
    expect(first.isWriter).toBe(false)
    expect(locks.isHeld('test.writer')).toBe(false)

    const third = createWriterLock({ locks, name: 'test.writer' })
    await expect(third.acquire()).resolves.toBe('writer')
  })
})
