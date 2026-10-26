import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Copy and documentation contract for the browser-persistence model (RNF-01):
 * the teacher-facing manual is served from public/ and edited in docs/, the
 * spec and module docs must describe IndexedDB as the data store, and no stale
 * volatile-session or unconditional-survival claim may survive. Backup claims
 * are only allowed while the backup actually carries the final annotations.
 */

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const manual = read('../../docs/manual-de-uso.md')
const publicManual = read('../../public/manual-de-uso.md')
const spec = read('../../spec.md')
const finalReport = read('../../docs/final-report.md')
const product = read('../../PRODUCT.md')

const paragraphs = (text) => text.split(/\n\s*\n/)

const specSection = (heading, nextHeading) => {
  const start = spec.indexOf(heading)
  const end = spec.indexOf(nextHeading, start)
  return start === -1 ? '' : spec.slice(start, end === -1 ? undefined : end)
}

const RNF_01 = specSection('**RNF-01', '**RNF-02')

// sessionStorage is legitimate ONLY as per-tab view state or as the legacy
// store source of the one-shot migration.
const VIEW_STATE_OR_MIGRATION = /estado de vista|claves de (?:estado de )?vista|view state|migraci[oó]n|migration/i
const straySessionStorage = (text) =>
  paragraphs(text).filter(
    (paragraph) => /sessionStorage/i.test(paragraph) && !VIEW_STATE_OR_MIGRATION.test(paragraph),
  )

const FORBIDDEN_SOLO_LOSS = /se pierde[^.\n]{0,20}solo[^.\n]{0,10}si/i
const BACKUP_MENTIONS_FINALS = /(?:backup|respaldo)[\s\S]{0,400}desempeñ[oa]s? final(?:es)?/i

describe('manual de uso', () => {
  it('keeps docs/ and public/ byte-identical', () => {
    expect(publicManual).toBe(manual)
  })

  it('never claims the work dies with the tab or the computer', () => {
    for (const source of [manual, publicManual]) {
      expect(source).not.toMatch(/muere al cerrar/i)
      expect(source).not.toMatch(/se borra de la computadora/i)
      expect(source).not.toMatch(FORBIDDEN_SOLO_LOSS)
    }
  })

  it('mentions sessionStorage only for per-tab view state or legacy migration', () => {
    expect(straySessionStorage(manual)).toEqual([])
    expect(straySessionStorage(publicManual)).toEqual([])
  })

  it('states the final data model and every real loss condition', () => {
    expect(manual).toMatch(/IndexedDB/)
    expect(manual).toMatch(/sessionStorage/)
    expect(manual).toMatch(/cambias de navegador o de computadora/i)
    expect(manual).toMatch(/borras los datos del sitio/i)
    expect(manual).toMatch(/modo privado/i)
    expect(manual).toMatch(/presión de cuota/i)
    expect(manual).toMatch(/liberar espacio/i)
    expect(manual).toMatch(/Limpiar informes/i)
    expect(manual).toMatch(/pide\s+confirmación/i)
    expect(manual).toMatch(/backup \.xlsx/i)
    expect(manual).toMatch(/equipo compartido/i)
  })

  it('qualifies tab-close survival instead of promising every edit is kept', () => {
    expect(manual).toMatch(/escrituras ya confirmadas se conservan al cerrar la pestaña/i)
    expect(manual).toMatch(/puede no alcanzar a guardarse/i)
  })

  it('states that the backup includes period and final desempeños', () => {
    expect(manual).toMatch(BACKUP_MENTIONS_FINALS)
    expect(manual).toMatch(/desempeños de período y desempeños finales/i)
    expect(manual).toMatch(/Final \(desempeños\)/)
  })

  it('does not use "copia segura" without also naming the final annotations', () => {
    for (const source of [manual, publicManual, finalReport, product]) {
      if (/copia segura/i.test(source)) {
        expect(source).toMatch(/desempeñ[oa]s? final(?:es)?|Final \(desempeños\)/i)
      }
    }
  })
})

describe('spec RNF-01', () => {
  it('describes IndexedDB persistence without the volatile-session model', () => {
    expect(RNF_01).toMatch(/IndexedDB/)
    expect(RNF_01).not.toMatch(/sessionStorage/i)
    expect(RNF_01).not.toMatch(/memoria de la pestaña/i)
    expect(RNF_01).not.toMatch(/destruy/i)
  })

  it('enumerates every loss cause and the .xlsx bridge', () => {
    expect(RNF_01).toMatch(/cambia(?:r|n|s)? de navegador o (?:de )?computadora/i)
    expect(RNF_01).toMatch(/borra(?:r|n|s)? los datos del sitio/i)
    expect(RNF_01).toMatch(/modo privado/i)
    expect(RNF_01).toMatch(/presión de cuota/i)
    expect(RNF_01).toMatch(/liberar espacio/i)
    expect(RNF_01).toMatch(/Limpiar informes/i)
    expect(RNF_01).toMatch(/\.xlsx/)
    expect(RNF_01).toMatch(/desempeños finales/i)
  })

  it('qualifies the writer lock with the Web Locks caveat', () => {
    expect(RNF_01).toMatch(/Web Locks/i)
    expect(RNF_01).toMatch(/sin esa API/i)
    expect(RNF_01).toMatch(/vale la última escritura/i)
    expect(RNF_01).toMatch(/escrituras ya confirmadas/i)
    expect(RNF_01).toMatch(/puede no alcanzar a guardarse/i)
  })

  it('leaves no stale no-persistence or volatile-session claims in the spec', () => {
    expect(spec).not.toMatch(/sin persistencia/i)
    expect(spec).not.toMatch(/sesiones volátiles/i)
    expect(spec).not.toMatch(/sin almacenamiento en bases de datos/i)
    expect(spec).not.toMatch(/memoria volátil/i)
  })
})

describe('module docs and product brief', () => {
  it('mentions sessionStorage only for per-tab view state or legacy migration', () => {
    expect(straySessionStorage(finalReport)).toEqual([])
    expect(straySessionStorage(product)).toEqual([])
  })

  it('never claims the work dies with the tab or promises unconditional survival', () => {
    for (const source of [finalReport, product]) {
      expect(source).not.toMatch(/muere al cerrar/i)
      expect(source).not.toMatch(/se borra de la computadora/i)
      expect(source).not.toMatch(FORBIDDEN_SOLO_LOSS)
    }
    expect(finalReport).toMatch(/puede no alcanzar a guardarse/i)
    expect(product).toMatch(/may not reach storage/i)
  })

  it('describes the backup scope including final annotations', () => {
    expect(finalReport).toMatch(BACKUP_MENTIONS_FINALS)
    expect(finalReport).toMatch(/Final \(desempeños\)/)
    expect(product).toMatch(/final-report annotations/i)
  })

  it('documents reset as a real data-loss path', () => {
    expect(finalReport).toMatch(/Limpiar informes/i)
    expect(finalReport).toMatch(/pide\s+confirmación/i)
    expect(product).toMatch(/Limpiar informes/i)
    expect(product).toMatch(/asks for confirmation/i)
  })
})
