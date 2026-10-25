import { describe, expect, it } from 'vitest'
import { parseScoreInput } from './scoreInput'

describe('parseScoreInput', () => {
  it('accepts a decimal comma', () => {
    expect(parseScoreInput('3,5', 5)).toBe(3.5)
  })

  it('accepts a leading zero with a decimal comma', () => {
    expect(parseScoreInput('0,5', 5)).toBe(0.5)
  })

  it('clamps above the decimal maximum', () => {
    expect(parseScoreInput('6', 5)).toBe(5)
  })

  it('clamps below zero', () => {
    expect(parseScoreInput('-1', 5)).toBe(0)
  })

  it('treats an empty value as no score', () => {
    expect(parseScoreInput('', 5)).toBeNull()
  })

  it('rejects text that is not a number', () => {
    expect(parseScoreInput('abc', 5)).toBeNull()
  })

  it('respects a centesimal maximum', () => {
    expect(parseScoreInput('95', 100)).toBe(95)
  })

  it('rejects a trailing dot on commit', () => {
    expect(parseScoreInput('3.', 5)).toBeNull()
  })
})
