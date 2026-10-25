import { expect, test } from '@playwright/test'
import {
  SCALE,
  completeFirstRun,
  readDataKey,
  seed,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const GRANTED = 'Almacenamiento protegido en este navegador.'
const DENIED =
  'El navegador puede liberar espacio; exporta el backup (.xlsx) para conservar el trabajo.'
const SAVE_ERROR_TOAST =
  'No se pudo guardar en este navegador; exporta el backup (.xlsx) para no perder datos.'

const openSettings = (page) =>
  page.getByRole('button', { name: 'Configuración', exact: true }).click()

const stubPersistCounter = (page, { granted = true } = {}) =>
  page.addInitScript(
    ({ grantedValue }) => {
      window.__persistCalls = 0
      Object.defineProperty(navigator.storage, 'persist', {
        configurable: true,
        value: () => {
          window.__persistCalls += 1
          return Promise.resolve(grantedValue)
        },
      })
    },
    { grantedValue: granted },
  )

test('requests persistence once per page load, only after the first successful write', async ({
  page,
}) => {
  await stubPersistCounter(page)

  await completeFirstRun(page)
  await waitForPersisted(
    page,
    'informes.config',
    (value) => value?.institution === 'Colegio de Prueba',
  )
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1)

  await openSettings(page)
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Segundo Guardado')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await waitForPersisted(
    page,
    'informes.config',
    (value) => value?.institution === 'Colegio Segundo Guardado',
  )
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1)

  await page.reload()
  await waitForHydrated(page)
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0)

  await openSettings(page)
  await expect(page.getByText(GRANTED)).toHaveCount(0)
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Tercer Guardado')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await waitForPersisted(
    page,
    'informes.config',
    (value) => value?.institution === 'Colegio Tercer Guardado',
  )
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1)
})

test('a failed IndexedDB write does not request persistence and the next write requests once', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__failPuts = false
    window.__persistCalls = 0
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function failingPut(...args) {
      if (window.__failPuts && this.transaction?.db?.name === 'informes') {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
    Object.defineProperty(navigator.storage, 'persist', {
      configurable: true,
      value: () => {
        window.__persistCalls += 1
        return Promise.resolve(true)
      },
    })
  })

  await seed(page, {
    config: { institution: 'Colegio Original', period: '', scale: SCALE, logo: null },
    reports: [],
  })

  await page.evaluate(() => {
    window.__failPuts = true
  })

  await openSettings(page)
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Fallido')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()

  await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible()
  await expect
    .poll(() => readDataKey(page, 'informes.config'))
    .toMatchObject({ institution: 'Colegio Original' })
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0)

  await page.evaluate(() => {
    window.__failPuts = false
  })
  await openSettings(page)
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Recuperado')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await waitForPersisted(
    page,
    'informes.config',
    (value) => value?.institution === 'Colegio Recuperado',
  )
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1)
})

test('session mode never requests persistence and never shows a status line', async ({ page }) => {
  await page.addInitScript(() => {
    window.__persistCalls = 0
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator.storage, 'persist', {
      configurable: true,
      value: () => {
        window.__persistCalls += 1
        return Promise.resolve(true)
      },
    })
  })

  await page.goto('/')
  await waitForHydrated(page)
  await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
  await expect(page.getByRole('heading', { name: 'Configuración inicial' })).toBeVisible()
  await expect(page.getByText(GRANTED)).toHaveCount(0)
  await expect(page.getByText(DENIED)).toHaveCount(0)

  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Sesión')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByText('Importar Excel')).toBeVisible()
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0)

  await openSettings(page)
  await expect(page.getByText(GRANTED)).toHaveCount(0)
  await expect(page.getByText(DENIED)).toHaveCount(0)
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0)
})

test('the granted line is visible at 1280x720 and fully inside the scrollable body', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await stubPersistCounter(page)

  await completeFirstRun(page)
  await waitForPersisted(page, 'informes.config')
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1)

  await openSettings(page)
  const line = page.getByText(GRANTED)
  await expect(line).toBeVisible()
  await expect(line).toBeInViewport({ ratio: 1 })

  const geometry = await line.evaluate((element) => {
    const scroller = element.closest('.overflow-y-auto')
    if (!scroller) return null
    const lineRect = element.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    return {
      lineTop: lineRect.top,
      lineBottom: lineRect.bottom,
      scrollerTop: scrollerRect.top,
      scrollerBottom: scrollerRect.bottom,
      scrollTop: scroller.scrollTop,
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
    }
  })

  console.log('[persistence-regression-d]', JSON.stringify(geometry))

  expect(geometry).not.toBeNull()
  expect(geometry.scrollTop).toBe(0)
  expect(geometry.lineTop).toBeGreaterThanOrEqual(geometry.scrollerTop - 0.5)
  expect(geometry.lineBottom).toBeLessThanOrEqual(geometry.scrollerBottom + 0.5)
})

test('resolving a pending persist while settings is open shifts the save button under 1px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.addInitScript(() => {
    window.__persistCalls = 0
    Object.defineProperty(navigator.storage, 'persist', {
      configurable: true,
      value: () => {
        window.__persistCalls += 1
        return new Promise((resolve) => {
          window.__resolvePersist = resolve
        })
      },
    })
  })

  await completeFirstRun(page)
  await waitForPersisted(page, 'informes.config')
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1)
  await expect
    .poll(() => page.evaluate(() => typeof window.__resolvePersist))
    .toBe('function')

  await openSettings(page)
  const saveButton = page.getByRole('button', { name: 'Guardar configuración' })
  await expect(saveButton).toBeVisible()
  await expect(page.getByText(GRANTED)).toHaveCount(0)
  const before = await saveButton.boundingBox()

  await page.evaluate(() => window.__resolvePersist(true))
  await expect(page.getByText(GRANTED)).toBeVisible()
  const after = await saveButton.boundingBox()

  const shift = Math.abs(after.y - before.y)
  console.log('[persistence-regression-e]', JSON.stringify({ before, after, shift }))

  expect(shift).toBeLessThan(1)
})
