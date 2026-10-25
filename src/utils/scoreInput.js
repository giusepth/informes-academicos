/**
 * Normalizes a raw score typed by a person into a clamped number.
 *
 * Accepts a decimal comma (the common notation in Spanish-speaking schools)
 * and clamps to the configured range. Returns `null` for an empty cell or an
 * unparseable value; callers decide whether empty means "clear score" or
 * "keep the previous one" (see the score inputs' commit handlers).
 *
 * A single trailing dot is allowed while typing but rejected here: on commit
 * "3." is not a complete number, so it falls back like any invalid input.
 */
export function parseScoreInput(raw, maxScore = 5) {
  if (raw === null || raw === undefined) return null
  const normalized = String(raw).trim().replace(/,/g, '.')
  if (normalized === '' || normalized.endsWith('.')) return null
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return Math.min(maxScore, Math.max(0, value))
}
