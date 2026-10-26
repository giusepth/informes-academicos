import { expect, test } from '@playwright/test'
import { SCALE, openManagementMenu, report, waitForHydrated } from './helpers'

const config = {
  institution: 'Colegio Session',
  period: '2027',
  scaleType: 'decimal',
  scale: SCALE,
  logo: null,
}

const reportA = report({
  label: 'Informe A',
  subjects: ['Matemáticas'],
  students: [{ name: 'Ana', scores: { Matemáticas: 4.5 } }],
})

const reportB = report({
  label: 'Informe B',
  subjects: ['Ciencias'],
  students: [{ name: 'Luis', scores: { Ciencias: 3.5 } }],
})

async function openSessionTab(context, ownReport) {
  const page = await context.newPage()
  await page.addInitScript(
    (state) => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined })
      sessionStorage.setItem('informes.config', JSON.stringify(state.config))
      sessionStorage.setItem('informes.reports', JSON.stringify([state.ownReport]))
      sessionStorage.setItem('informes.finalPerformances', JSON.stringify({ OWN: { X: 'Y' } }))
      sessionStorage.setItem('informes.entered', 'true')
    },
    { config, ownReport },
  )
  await page.goto('/')
  await waitForHydrated(page)
  return page
}

test('clearing in one session-mode tab keeps the other tab data', async ({ context }) => {
  const a = await openSessionTab(context, reportA)
  const b = await openSessionTab(context, reportB)
  await expect(b.getByRole('button', { name: 'Informe B', exact: true })).toBeVisible()

  await openManagementMenu(a)
  await a.getByRole('button', { name: 'Limpiar informes' }).click()
  await a
    .getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()
  await expect(a.getByText('Importar Excel (.xlsx)')).toBeVisible()

  await b.waitForTimeout(1500)
  expect(
    await b.evaluate(() => ({
      reports: sessionStorage.getItem('informes.reports'),
      finals: sessionStorage.getItem('informes.finalPerformances'),
    })),
  ).not.toEqual({ reports: null, finals: null })

  await b.reload()
  await waitForHydrated(b)
  await expect(b.getByRole('button', { name: 'Informe B', exact: true })).toBeVisible()
})
