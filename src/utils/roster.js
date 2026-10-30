/** Common Colombian/LatAm primary-school subjects offered as one-click adds. */
export const SUBJECT_SUGGESTIONS = [
  'Ciencias Naturales',
  'Lengua',
  'Sociales',
  'Inglés',
  'Educación Física',
  'Artes',
  'Música',
  'Ética',
]

/** Case- and accent-fold (es locale), mirroring the app's header normalization. */
const foldName = (value) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')


/**
 * Parses a pasted roster block (one student per line) into trimmed names,
 * skipping blanks, names already on the roster and in-block duplicates.
 * Comparison is accent/tolerant: plain lowercase fold (es locale).
 */
export function parseRosterNames(text, existingNames = []) {
  const taken = new Set(existingNames.map((name) => foldName(name)))
  const parsed = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const name = line.trim()
    if (!name) continue
    const key = foldName(name)
    if (taken.has(key)) continue
    taken.add(key)
    parsed.push(name)
  }
  return parsed
}

/** Suggested subjects not already used, preserving the canonical order. */
export function remainingSubjectSuggestions(subjectNames = []) {
  const taken = new Set(subjectNames.map((name) => foldName(name)))
  return SUBJECT_SUGGESTIONS.filter((name) => !taken.has(foldName(name)))
}
