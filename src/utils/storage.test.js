import { describe, expect, it, vi, afterEach } from 'vitest'
import { readStorage, writeStorage } from './storage'

/**
 * CI runs vitest on Node 22, where the global sessionStorage may not exist
 * (webstorage is flag-gated there). Every test stubs an explicit Map-backed
 * storage so behavior never depends on the runner's Node version.
 */
const memoryStorage = (impl = {}) => {
  const store = new Map()
  return {
    store,
    getItem: impl.getItem ?? ((key) => (store.has(key) ? store.get(key) : null)),
    setItem: impl.setItem ?? ((key, value) => store.set(key, value)),
    removeItem: impl.removeItem ?? ((key) => store.delete(key)),
  }
}

describe('writeStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('persists JSON values and returns true', () => {
    vi.stubGlobal('sessionStorage', memoryStorage())
    expect(writeStorage('t.key', { a: 1 })).toBe(true)
    expect(readStorage('t.key')).toEqual({ a: 1 })
  })

  it('removes the key for null values and returns true', () => {
    vi.stubGlobal('sessionStorage', memoryStorage())
    writeStorage('t.key', { a: 1 })
    expect(writeStorage('t.key', null)).toBe(true)
    expect(sessionStorage.getItem('t.key')).toBeNull()
  })

  it('returns false (instead of crashing silently) when the quota is exceeded', () => {
    const fail = new DOMException('quota exceeded', 'QuotaExceededError')
    vi.stubGlobal('sessionStorage', memoryStorage({ setItem: () => {
      throw fail
    } }))
    expect(writeStorage('t.key', { big: true })).toBe(false)
  })

  it('returns false when storage is unavailable', () => {
    vi.stubGlobal('sessionStorage', memoryStorage({ setItem: () => {
      throw new Error('private mode')
    } }))
    expect(writeStorage('t.key', 1)).toBe(false)
  })
})

describe('readStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the fallback for missing or corrupt entries', () => {
    vi.stubGlobal('sessionStorage', memoryStorage())
    expect(readStorage('t.missing', 'fallback')).toBe('fallback')
    sessionStorage.setItem('t.corrupt', '{broken')
    expect(readStorage('t.corrupt', null)).toBeNull()
  })

  it('returns the fallback when storage access itself throws', () => {
    vi.stubGlobal('sessionStorage', memoryStorage({ getItem: () => {
      throw new Error('unavailable')
    } }))
    expect(readStorage('t.key', 'safe')).toBe('safe')
  })
})
