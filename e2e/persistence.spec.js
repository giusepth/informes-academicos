import { expect, test } from '@playwright/test'
import { completeFirstRun, waitForHydrated, waitForPersisted } from './helpers'

const stubPersist = (page, { granted = true, supported = true } = {}) =>
  page.addInitScript(
    ({ grantedValue, isSupported }) => {
      window.__persistCalls = 0
      if (!isSupported) {
        Object.defineProperty(navigator.storage, 'persist', {
          configurable: true,
          value: undefined,
        })
        return
      }
      Object.defineProperty(navigator.storage, 'persist', {
        configurable: true,
        value: () => {
          window.__persistCalls += 1
          return Promise.resolve(grantedValue)
        },
      })
    },
    { grantedValue: granted, isSupported: supported },
  )

const openSettings = (page) =>
  page.getByRole('button', { name: 'Configuración', exact: true }).click()

test('requests persistence once after the first successful write and shows the protected line', async ({
  page,
}) => {
  await stubPersist(page, { granted: true })

  await page.goto('/')
  await waitForHydrated(page)
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0)

  await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
  await expect(page.getByRole('heading', { name: 'Configuración inicial' })).toBeVisible()
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio de Prueba')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()

  await waitForPersisted(page, 'informes.config', (value) => value?.institution === 'Colegio de Prueba')
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1)

  await openSettings(page)
  await expect(page.getByText('Almacenamiento protegido en este navegador.')).toBeVisible()
  expect(await page.evaluate(() => window.__persistCalls)).toBe(1)
})

test('a denied request shows the backup advice without an error toast', async ({ page }) => {
  await stubPersist(page, { granted: false })

  await completeFirstRun(page)
  await waitForPersisted(page, 'informes.config')
  await openSettings(page)

  await expect(
    page.getByText(
      'El navegador puede liberar espacio; exporta el backup (.xlsx) para conservar el trabajo.',
    ),
  ).toBeVisible()
  await expect(page.getByText('No se pudo guardar')).toHaveCount(0)
})

test('without the Storage API the app works and shows no persistence line', async ({ page }) => {
  await stubPersist(page, { supported: false })

  await completeFirstRun(page)
  await expect(page.getByText('Importar Excel')).toBeVisible()
  await openSettings(page)

  await expect(page.getByText('Almacenamiento protegido en este navegador.')).toHaveCount(0)
  await expect(page.getByText('El navegador puede liberar espacio')).toHaveCount(0)
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0)
})
