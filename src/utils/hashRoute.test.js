import { describe, expect, it } from 'vitest'
import {
  hashForRoute,
  parseToolRoute,
  resolveToolRoute,
  TOOL_ROUTES,
} from './hashRoute'

describe('parseToolRoute', () => {
  it('accepts every tool route', () => {
    for (const route of Object.values(TOOL_ROUTES)) {
      expect(parseToolRoute(`#/${route}`)).toBe(route)
    }
  })

  it('ignores landing anchors and unknown hashes', () => {
    expect(parseToolRoute('#pasos')).toBeNull()
    expect(parseToolRoute('#/desconocido')).toBeNull()
    // The final editor route belongs to F5; until then it is not exposed.
    expect(parseToolRoute('#/editor-final')).toBeNull()
    expect(parseToolRoute('')).toBeNull()
    expect(parseToolRoute(undefined)).toBeNull()
  })

  it('strips trailing path and query segments', () => {
    expect(parseToolRoute('#/boletin/extra')).toBe(TOOL_ROUTES.boletin)
    expect(parseToolRoute('#/gestion?tab=1')).toBe(TOOL_ROUTES.gestion)
  })
})

describe('resolveToolRoute', () => {
  it('always allows management and contact', () => {
    expect(resolveToolRoute('#/gestion', { hasReports: false })).toBe(TOOL_ROUTES.gestion)
    expect(resolveToolRoute('#/contacto', { hasReports: true })).toBe(TOOL_ROUTES.contacto)
  })

  it('falls back to management without reports', () => {
    expect(resolveToolRoute('', { hasReports: false })).toBe(TOOL_ROUTES.gestion)
    expect(resolveToolRoute('#/boletin', { hasReports: false })).toBe(TOOL_ROUTES.gestion)
    expect(resolveToolRoute('#/final', { hasReports: false })).toBe(TOOL_ROUTES.gestion)
  })

  it('keeps the stored tab when there is no explicit route', () => {
    expect(resolveToolRoute('', { hasReports: true, activeTab: 'period' })).toBe(
      TOOL_ROUTES.boletin,
    )
    expect(resolveToolRoute('', { hasReports: true, activeTab: 'final' })).toBe(
      TOOL_ROUTES.final,
    )
  })

  it('honours explicit report routes and unknown hashes', () => {
    expect(resolveToolRoute('#/final', { hasReports: true })).toBe(TOOL_ROUTES.final)
    expect(resolveToolRoute('#/editor', { hasReports: true })).toBe(TOOL_ROUTES.editor)
    expect(resolveToolRoute('#/editor', { hasReports: false })).toBe(TOOL_ROUTES.editor)
    expect(resolveToolRoute('#/nope', { hasReports: true, activeTab: 'final' })).toBe(
      TOOL_ROUTES.final,
    )
  })
})

describe('hashForRoute', () => {
  it('builds a valid hash and falls back for unknown routes', () => {
    expect(hashForRoute(TOOL_ROUTES.editor)).toBe('#/editor')
    expect(hashForRoute('nope')).toBe('#/gestion')
  })
})
