import { expect, test } from '@playwright/test'
import { report, SCALE, seed, seedLegacy, waitForHydrated, waitForPersisted } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']
const MIGRATION_TOAST = 'Trabajo anterior importado a este navegador.'
const SAVE_ERROR_TOAST = 'No se pudo guardar en este navegador; exporta el backup (.xlsx) para no perder datos.'

const config = {
  institution: 'Colegio Legacy',
  period: '',
  scale: SCALE,
  logo: null,
}

const reports = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [
      {
        name: 'Ana',
        scores: { 'Matemáticas': 4.5, 'Ciencias': 4.2 },
        performances: { 'Matemáticas': 'Desempeño previo' },
      },
    ],
  }),
]

const finalPerformances = { ANA: { 'Matemáticas': 'Anotación final previa' } }

test('a true legacy session (no entered flag) is not parked on the landing', async ({ page }) => {
  await page.addInitScript(
    (state) => {
      sessionStorage.setItem('informes.config', JSON.stringify(state.config))
      sessionStorage.setItem('informes.reports', JSON.stringify(state.reports))
    },
    { config, reports },
  )

  await page.goto('/')
  await waitForHydrated(page)

  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'De la planilla de notas a los informes listos para imprimir.',
    }),
  ).toHaveCount(0)
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => Array.isArray(value) && value.length === 1,
  )
})

test('legacy session data is migrated once and survives a reload', async ({ page }) => {
  await seedLegacy(page, { config, reports, finalPerformances, tab: 'final' })

  await expect(page.getByText(MIGRATION_TOAST)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 2 (final)' })).toBeVisible()
  await expect(
    page.locator('tr', { hasText: 'Matemáticas' }).first().locator('textarea'),
  ).toHaveValue('Anotación final previa')

  await waitForPersisted(page, 'informes.config', (value) => value?.institution === 'Colegio Legacy')
  await waitForPersisted(page, 'informes.reports', (value) => Array.isArray(value) && value.length === 1)
  await waitForPersisted(
    page,
    'informes.finalPerformances',
    (value) => value?.ANA?.['Matemáticas'] === 'Anotación final previa',
  )

  await page.reload()
  await waitForHydrated(page)

  await expect(page.getByText(MIGRATION_TOAST)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Informe 2 (final)' })).toBeVisible()
  await expect(
    page.locator('tr', { hasText: 'Matemáticas' }).first().locator('textarea'),
  ).toHaveValue('Anotación final previa')
})

test('a legacy single report is wrapped as Informe 1', async ({ page }) => {
  const legacyReport = report({
    label: 'Informe viejo',
    subjects: SUBJECTS,
    students: [{ name: 'Ana', scores: { 'Matemáticas': 4.5, 'Ciencias': 4.2 } }],
  })

  await seedLegacy(page, { legacyReport, reports: [] })

  await expect(page.getByText(MIGRATION_TOAST)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 1' })).toBeVisible()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) =>
      Array.isArray(value) &&
      value.length === 1 &&
      value[0].label === 'Informe 1' &&
      typeof value[0].id === 'string' &&
      value[0].id !== legacyReport.id,
  )
})

test('reset after migration is not resurrected from legacy keys on reload', async ({ page }) => {
  await seedLegacy(page, { config, reports, finalPerformances })
  await expect(page.getByText(MIGRATION_TOAST)).toBeVisible()

  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await page.getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => Array.isArray(value) && value.length === 0,
  )

  await page.reload()
  await waitForHydrated(page)

  await expect(page.getByText(MIGRATION_TOAST)).toHaveCount(0)
  await expect(page.getByText('Importar Excel (.xlsx)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 1' })).toHaveCount(0)
})

test('cleared legacy keys cannot resurrect when IndexedDB becomes unavailable', async ({ page }) => {
  // Seed sessionStorage once, without an init script: after the clear a reload
  // must not repopulate the legacy keys behind the app's back.
  await page.goto('/')
  await page.evaluate(
    (state) => {
      sessionStorage.setItem('informes.config', JSON.stringify(state.config))
      sessionStorage.setItem('informes.reports', JSON.stringify(state.reports))
      sessionStorage.setItem('informes.finalPerformances', JSON.stringify(state.finalPerformances))
    },
    { config, reports, finalPerformances },
  )
  await page.reload()
  await waitForHydrated(page)
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await page
    .getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()
  await waitForPersisted(page, 'informes.reports', (value) => Array.isArray(value) && value.length === 0)
  expect(await page.evaluate(() => sessionStorage.getItem('informes.report'))).toBeNull()

  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined })
  })
  await page.reload()
  await waitForHydrated(page)

  await expect(page.getByText('Importar Excel (.xlsx)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toHaveCount(0)
})

test('booting with stored data does not write to IndexedDB until an edit', async ({ page }) => {
  await seed(page, { config, reports })

  await page.addInitScript(() => {
    window.__idbPuts = 0
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function countingPut(...args) {
      window.__idbPuts += 1
      return original.apply(this, args)
    }
  })

  await page.reload()
  await waitForHydrated(page)
  await expect(page.getByRole('button', { name: 'Informe 1' })).toBeVisible()
  // Hydration must not write the hydrated state back. Poll a few spaced
  // samples instead of sleeping: the counter must stay 0 once boot settled.
  await expect
    .poll(() => page.evaluate(() => window.__idbPuts), {
      message: 'hydration must not write to IndexedDB',
      timeout: 2000,
      intervals: [150, 250, 400],
    })
    .toBe(0)

  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Editado')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()

  await waitForPersisted(page, 'informes.config', (value) => value?.institution === 'Colegio Editado')
  expect(await page.evaluate(() => window.__idbPuts)).toBeGreaterThan(0)
})

test('a failed IndexedDB write shows one neutral toast and keeps the UI usable', async ({ page }) => {
  await seed(page, { config, reports })

  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function failingPut(...args) {
      if (this.transaction?.db?.name === 'informes') {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
  })

  await page.reload()
  await waitForHydrated(page)

  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Fallido')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()

  await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible()

  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await expect(page.getByPlaceholder('Colegio Ejemplo')).toHaveValue('Colegio Fallido')
})
