import { describe, expect, it, vi, afterEach } from 'vitest'
import { readStorage, writeStorage } from './storage'

describe('writeStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('persists JSON values and returns true', () => {
    expect(writeStorage('t.key', { a: 1 })).toBe(true)
    expect(readStorage('t.key')).toEqual({ a: 1 })
  })

  it('removes the key for null values and returns true', () => {
    writeStorage('t.key', { a: 1 })
    expect(writeStorage('t.key', null)).toBe(true)
    expect(sessionStorage.getItem('t.key')).toBeNull()
  })

  it('returns false (instead of crashing silently) when the quota is exceeded', () => {
    const fail = new DOMException('quota exceeded', 'QuotaExceededError')
    vi.stubGlobal('sessionStorage', { setItem: () => {
      throw fail
    } })
    expect(writeStorage('t.key', { big: true })).toBe(false)
  })

  it('returns false when storage is unavailable', () => {
    vi.stubGlobal('sessionStorage', { setItem: () => {
      throw new Error('private mode')
    } })
    expect(writeStorage('t.key', 1)).toBe(false)
  })
})

describe('readStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the fallback for missing or corrupt entries', () => {
    expect(readStorage('t.missing', 'fallback')).toBe('fallback')
    sessionStorage.setItem('t.corrupt', '{broken')
    expect(readStorage('t.corrupt', null)).toBeNull()
  })

  it('returns the fallback when storage access itself throws', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => {
      throw new Error('unavailable')
    } })
    expect(readStorage('t.key', 'safe')).toBe('safe')
  })
})
