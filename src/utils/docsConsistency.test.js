import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Copy and documentation contract for the browser-persistence model (RNF-01):
 * the teacher-facing manual is served from public/ and edited in docs/, the
 * spec must describe IndexedDB as the data store, and no stale volatile-session
 * claim may survive.
 */

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const manual = read('../../docs/manual-de-uso.md')
const publicManual = read('../../public/manual-de-uso.md')
const spec = read('../../spec.md')

const paragraphs = (text) => text.split(/\n\s*\n/)

const specSection = (heading, nextHeading) => {
  const start = spec.indexOf(heading)
  const end = spec.indexOf(nextHeading, start)
  return start === -1 ? '' : spec.slice(start, end === -1 ? undefined : end)
}

const RNF_01 = specSection('**RNF-01', '**RNF-02')

describe('manual de uso', () => {
  it('keeps docs/ and public/ byte-identical', () => {
    expect(publicManual).toBe(manual)
  })

  it('never claims the work dies with the tab or the computer', () => {
    for (const source of [manual, publicManual]) {
      expect(source).not.toMatch(/muere al cerrar/i)
      expect(source).not.toMatch(/se borra de la computadora/i)
    }
  })

  it('mentions sessionStorage only as a legacy migration note', () => {
    const stray = paragraphs(manual).filter(
      (paragraph) => /sessionStorage/i.test(paragraph) && !/migración/i.test(paragraph),
    )
    expect(stray).toEqual([])
  })

  it('states the final data model and every loss condition', () => {
    expect(manual).toMatch(/IndexedDB/)
    expect(manual).toMatch(/sessionStorage/)
    expect(manual).toMatch(/cambias de navegador o de computadora/i)
    expect(manual).toMatch(/borras los datos del sitio/i)
    expect(manual).toMatch(/modo privado/i)
    expect(manual).toMatch(/backup \.xlsx/i)
    expect(manual).toMatch(/equipo compartido/i)
  })
})

describe('spec RNF-01', () => {
  it('describes IndexedDB persistence without the volatile-session model', () => {
    expect(RNF_01).toMatch(/IndexedDB/)
    expect(RNF_01).not.toMatch(/sessionStorage/i)
    expect(RNF_01).not.toMatch(/memoria de la pestaña/i)
    expect(RNF_01).not.toMatch(/destruy/i)
  })

  it('enumerates the three loss causes and the .xlsx bridge', () => {
    expect(RNF_01).toMatch(/cambia(?:r|s)? de navegador o (?:de )?computadora/i)
    expect(RNF_01).toMatch(/borra(?:r|s)? los datos del sitio/i)
    expect(RNF_01).toMatch(/modo privado/i)
    expect(RNF_01).toMatch(/\.xlsx/)
    expect(RNF_01).toMatch(/una sola pestaña/i)
  })

  it('leaves no stale no-persistence or volatile-session claims in the spec', () => {
    expect(spec).not.toMatch(/sin persistencia/i)
    expect(spec).not.toMatch(/sesiones volátiles/i)
    expect(spec).not.toMatch(/sin almacenamiento en bases de datos/i)
    expect(spec).not.toMatch(/memoria volátil/i)
  })
})
