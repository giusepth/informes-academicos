import { describe, expect, it, vi } from 'vitest'
import { clearReportData } from './clearReports'
import { DATA_STORAGE_KEYS } from './idbState'

describe('clearReportData', () => {
  it('removes both data keys in a single IndexedDB transaction', async () => {
    const setMany = vi.fn().mockResolvedValue(true)

    await clearReportData({ storageMode: 'idb', idb: { setMany } })

    expect(setMany).toHaveBeenCalledWith([
      [DATA_STORAGE_KEYS.reports, []],
      [DATA_STORAGE_KEYS.finalPerformances, {}],
    ])
  })

  it('fails without touching state when the transaction fails', async () => {
    const idb = { setMany: vi.fn().mockRejectedValue(new Error('quota')) }

    await expect(clearReportData({ storageMode: 'idb', idb })).rejects.toThrow('quota')
  })

  it('removes the session keys without deleting configuration', async () => {
    const session = new Map([
      [DATA_STORAGE_KEYS.config, '{"institution":"Colegio"}'],
      [DATA_STORAGE_KEYS.reports, '[{"id":"r1"}]'],
      [DATA_STORAGE_KEYS.finalPerformances, '{"ANA":{}}'],
    ])

    await clearReportData({ storageMode: 'session', session: mockSession(session) })

    expect(session.has(DATA_STORAGE_KEYS.config)).toBe(true)
    expect(session.has(DATA_STORAGE_KEYS.reports)).toBe(false)
    expect(session.has(DATA_STORAGE_KEYS.finalPerformances)).toBe(false)
  })
})

function mockSession(store) {
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  }
}
