import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCALE,
  DEFAULT_SCALES,
  formatScore,
  qualitativeFor,
  roundForScale,
  roundUpTenth,
} from './calculations'

describe('scale types (RF-01 extended)', () => {
  it('keeps the original 1.0–5.0 decimal default intact', () => {
    expect(DEFAULT_SCALE).toBe(DEFAULT_SCALES.decimal)
    expect(DEFAULT_SCALES.decimal.map((b) => b.max)).toEqual([2.9, 3.9, 4.5, 5.0])
  })

  it('ships centesimal default bands (1–59 / 60–79 / 80–89 / 90–100)', () => {
    const centesimal = DEFAULT_SCALES.centesimal
    expect(centesimal.map((b) => b.label)).toEqual(DEFAULT_SCALE.map((b) => b.label))
    expect(centesimal.map((b) => [b.min, b.max])).toEqual([
      [1, 59],
      [60, 79],
      [80, 89],
      [90, 100],
    ])
  })

  it('rounds UP to the next tenth for the decimal scale (institutional rule)', () => {
    expect(roundForScale(2.92, 'decimal')).toBe(roundUpTenth(2.92))
    expect(roundForScale(4.44, 'decimal')).toBe(4.5)
  })

  it('rounds UP to the next integer for the centesimal scale', () => {
    expect(roundForScale(59.3, 'centesimal')).toBe(60)
    expect(roundForScale(80.2, 'centesimal')).toBe(81)
    expect(roundForScale(90, 'centesimal')).toBe(90)
  })

  it('assigns centesimal bands after institutional rounding', () => {
    const scale = DEFAULT_SCALES.centesimal
    expect(qualitativeFor(roundForScale(59.3, 'centesimal'), scale)).toBe(
      qualitativeFor(60, scale),
    )
    expect(qualitativeFor(roundForScale(40, 'centesimal'), scale)).toBe('Bajo')
    expect(qualitativeFor(roundForScale(95, 'centesimal'), scale)).toBe('Superior')
  })

  it('formats scores per scale type (no forced decimals on 1–100)', () => {
    expect(formatScore(4.5, 'decimal')).toBe('4.5')
    expect(formatScore(85, 'centesimal')).toBe('85')
    expect(formatScore(85.42, 'centesimal')).toBe('85.42')
    expect(formatScore(null, 'centesimal')).toBeNull()
  })
})
