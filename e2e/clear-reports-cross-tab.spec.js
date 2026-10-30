import { expect, test } from '@playwright/test'
import {
  SCALE,
  openManagementMenu,
  report,
  seed,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const config = {
  institution: 'Colegio Probe',
  period: '2027',
  scaleType: 'decimal',
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

const openTool = async (context) => {
  const page = await context.newPage()
  await page.goto('/')
  await waitForHydrated(page)
  return page
}

test('a clear removes legacy session copies from another tab', async ({ page, context }) => {
  await seed(page, { config, reports })
  const second = await openTool(context)
  await second.evaluate(
    (state) => {
      sessionStorage.setItem('informes.config', JSON.stringify(state.config))
      sessionStorage.setItem('informes.reports', JSON.stringify(state.reports))
      sessionStorage.setItem('informes.finalPerformances', JSON.stringify({ ANA: { Matemáticas: 'Final.' } }))
      sessionStorage.setItem('informes.report', JSON.stringify({ grade: '4° B', students: [] }))
      sessionStorage.setItem('informes.entered', JSON.stringify(true))
    },
    { config, reports },
  )

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await page
    .getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()
  await waitForPersisted(page, 'informes.reports', (value) => Array.isArray(value) && value.length === 0)

  await expect
    .poll(() =>
      second.evaluate(() => ({
        reports: sessionStorage.getItem('informes.reports'),
        finals: sessionStorage.getItem('informes.finalPerformances'),
        legacy: sessionStorage.getItem('informes.report'),
      })),
    )
    .toEqual({ reports: null, finals: null, legacy: null })

  await second.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined })
  })
  await second.reload()
  await waitForHydrated(second)

  await expect(second.getByText('Importar Excel (.xlsx)')).toBeVisible()
  await expect(second.getByRole('button', { name: 'Informe 1', exact: true })).toHaveCount(0)
})

test('without BroadcastChannel a clear still drops session copies in another tab', async ({
  page,
  context,
}) => {
  await seed(page, { config, reports })
  const second = await context.newPage()
  await second.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { configurable: true, get: () => undefined })
  })
  await second.goto('/')
  await waitForHydrated(second)
  await second.evaluate(() => {
    sessionStorage.setItem('informes.reports', JSON.stringify([{ id: 'stale' }]))
    sessionStorage.setItem(
      'informes.finalPerformances',
      JSON.stringify({ ANA: { 'Matemáticas': 'Final ajeno.' } }),
    )
  })
  await second.reload()
  await waitForHydrated(second)
  await expect(second.getByRole('status').filter({ hasText: 'Solo lectura' })).toBeVisible()

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await page
    .getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()
  await page.close()

  await expect(second.getByRole('status').filter({ hasText: 'Solo lectura' })).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect
    .poll(() => second.evaluate(() => sessionStorage.getItem('informes.reports')))
    .toBeNull()
  await expect
    .poll(() => second.evaluate(() => sessionStorage.getItem('informes.finalPerformances')))
    .toBeNull()
  await expect(second.getByText('Importar Excel (.xlsx)')).toBeVisible()
  await second.close()
})
