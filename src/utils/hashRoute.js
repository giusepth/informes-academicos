export const TOOL_ROUTES = Object.freeze({
  gestion: 'gestion',
  editor: 'editor',
  editorFinal: 'editor-final',
  boletin: 'boletin',
  final: 'final',
  contacto: 'contacto',
})

const ROUTE_NAMES = new Set(Object.values(TOOL_ROUTES))
const DEFAULT_TOOL_ROUTE = TOOL_ROUTES.gestion
const DEFAULT_REPORT_ROUTE = TOOL_ROUTES.boletin

/**
 * Parses a location hash into a known tool route. Hash anchors used by the
 * landing (`#pasos`, `#features`) and unknown values return null so callers can
 * fall back to a safe route instead of rendering a blank tool.
 */
export function parseToolRoute(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#/')) return null
  const name = hash.slice(2).split(/[/?]/)[0]
  return ROUTE_NAMES.has(name) ? name : null
}

/**
 * Resolves the screen to render. Editor routes are only valid once a report
 * exists; a missing or unknown hash keeps the current tab for backward
 * compatibility with sessions stored by the previous build.
 */
export function resolveToolRoute(hash, { hasReports = false, activeTab = 'period' } = {}) {
  const parsed = parseToolRoute(hash)

  if (parsed === TOOL_ROUTES.contacto) return TOOL_ROUTES.contacto
  if (parsed === TOOL_ROUTES.gestion) return TOOL_ROUTES.gestion

  if (!hasReports) return DEFAULT_TOOL_ROUTE
  if (parsed) return parsed

  return activeTab === 'final' ? TOOL_ROUTES.final : DEFAULT_REPORT_ROUTE
}

export function hashForRoute(route) {
  return `#/${ROUTE_NAMES.has(route) ? route : DEFAULT_TOOL_ROUTE}`
}
