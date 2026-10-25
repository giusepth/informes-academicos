import { expect, test } from '@playwright/test'
import { readDataKey, report, SCALE, seedLegacy } from './helpers'

const MIGRATION_FAILED_TOAST =
  'No se pudo importar el trabajo a este navegador: se muestra la copia de esta pestaña.'

const config = {
  institution: 'Colegio Legacy',
  period: '',
  scale: SCALE,
  logo: null,
}

const reports = [
  report({
    label: 'Informe 1',
    subjects: ['Matemáticas'],
    students: [{ name: 'Ana', scores: { Matemáticas: 4.5 } }],
  }),
]

test('a failed IndexedDB import keeps the session copy and stays in session mode', async ({ page }) => {
  // The audit's deterministic quota failure: every put against the app
  // database throws, so migrateLegacy's setMany rejects as a batch.
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function failingPut(...args) {
      if (this.transaction?.db?.name === 'informes') {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
  })

  await seedLegacy(page, { config, reports })

  // The app must not boot as an empty IndexedDB: the legacy session copy is
  // rendered and the failure is explained.
  await expect(page.getByText(MIGRATION_FAILED_TOAST)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()
  await expect(page.getByText('Colegio Legacy').first()).toBeVisible()

  // This page life persists to sessionStorage; IndexedDB keeps nothing.
  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Solo Sesión')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()

  const sessionConfig = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('informes.config')),
  )
  expect(sessionConfig.institution).toBe('Colegio Solo Sesión')

  await expect.poll(() => readDataKey(page, 'informes.config')).toBeUndefined()
  await expect.poll(() => readDataKey(page, 'informes.reports')).toBeUndefined()
})
