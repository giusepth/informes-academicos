import { describe, expect, it } from 'vitest'
import { parseRosterNames, remainingSubjectSuggestions, SUBJECT_SUGGESTIONS } from './roster'

describe('parseRosterNames', () => {
  it('splits lines, trims and skips blanks', () => {
    expect(
      parseRosterNames('Ana Gómez\n  Luis Pérez  \n\nCarla Ruiz\n', [],),
    ).toEqual(['Ana Gómez', 'Luis Pérez', 'Carla Ruiz'])
  })

  it('skips names already on the roster, case-insensitively', () => {
    expect(parseRosterNames('ana gómez\nLuis Pérez', ['Ana Gómez'])).toEqual(['Luis Pérez'])
  })

  it('dedupes inside the pasted block itself', () => {
    expect(parseRosterNames('Luis Pérez\nluis pérez\n', [])).toEqual(['Luis Pérez'])
  })
})

describe('remainingSubjectSuggestions', () => {
  it('suggests common subjects not already present (normalized)', () => {
    expect(remainingSubjectSuggestions(['Matemáticas'])).toContain('Ciencias Naturales')
    expect(remainingSubjectSuggestions(['matematicas'])).not.toContain('Matemáticas')
    expect(remainingSubjectSuggestions([])).toEqual(SUBJECT_SUGGESTIONS)
  })
})
