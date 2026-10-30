import { expect, test } from '@playwright/test'
import {
  SCALE,
  openManagementMenu,
  readDataKey,
  report,
  seed,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const reports = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [
      {
        name: 'Ana',
        scores: { Matemáticas: 4.5, Ciencias: 3.8 },
        performances: { Matemáticas: 'Buen desempeño.' },
      },
    ],
  }),
]

const config = {
  institution: 'Colegio Conservado',
  period: '2026',
  scaleType: 'decimal',
  scale: SCALE,
  logo: null,
}

const clearDialog = (page) => page.getByRole('dialog', { name: 'Limpiar informes' })

test('the dialog traps focus and returns it to the trigger', async ({ page }) => {
  await seed(page, { config, reports })
  await openManagementMenu(page)
  const trigger = page.getByRole('button', { name: 'Limpiar informes' })

  await trigger.click()
  await expect(clearDialog(page).getByRole('button', { name: 'Cancelar' })).toBeFocused()

  await clearDialog(page).getByRole('button', { name: 'Limpiar informes' }).focus()
  await page.keyboard.press('Tab')
  await expect(clearDialog(page).getByRole('button', { name: 'Cerrar' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(clearDialog(page)).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('cancelling the clear dialog changes nothing', async ({ page }) => {
  await seed(page, {
    config,
    reports,
    finalPerformances: { ANA: { Matemáticas: 'Anotación final.' } },
  })

  const beforeReports = await readDataKey(page, 'informes.reports')
  const beforeFinals = await readDataKey(page, 'informes.finalPerformances')

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await expect(clearDialog(page)).toBeVisible()
  await expect(clearDialog(page)).toContainText('Se conservan la institución, el período lectivo, la escala y el escudo.')
  await clearDialog(page).getByRole('button', { name: 'Cancelar' }).click()

  await expect(clearDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
  expect(await readDataKey(page, 'informes.reports')).toEqual(beforeReports)
  expect(await readDataKey(page, 'informes.finalPerformances')).toEqual(beforeFinals)
})

test('confirming clears reports and finals but keeps the configuration', async ({ page }) => {
  await seed(page, {
    config,
    reports,
    finalPerformances: { ANA: { Matemáticas: 'Anotación final.' } },
  })
  await page.evaluate(() =>
    sessionStorage.setItem(
      'informes.nextPeriodMatrix',
      JSON.stringify({ Matemáticas: { Alto: 'Texto alto.' } }),
    ),
  )
  await page.reload()
  await waitForHydrated(page)

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await clearDialog(page).getByRole('button', { name: 'Limpiar informes' }).click()

  await expect(page.getByText('Informes eliminados. La configuración se conservó.')).toBeVisible()
  await expect(page.getByText('Importar Excel (.xlsx)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toHaveCount(0)

  await waitForPersisted(page, 'informes.reports', (value) => Array.isArray(value) && value.length === 0)
  await waitForPersisted(
    page,
    'informes.finalPerformances',
    (value) => value && Object.keys(value).length === 0,
  )
  expect(await readDataKey(page, 'informes.config')).toMatchObject({
    institution: 'Colegio Conservado',
    period: '2026',
  })
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('informes.nextPeriodMatrix')))
    .toBeNull()
})

test('cleared data stays cleared after a reload and the configuration survives', async ({ page }) => {
  await seed(page, { config, reports, finalPerformances: { ANA: { Ciencias: 'Final.' } } })

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await clearDialog(page).getByRole('button', { name: 'Limpiar informes' }).click()
  await waitForPersisted(page, 'informes.reports', (value) => Array.isArray(value) && value.length === 0)

  await page.reload()
  await waitForHydrated(page)

  await expect(page.getByText('Importar Excel (.xlsx)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await expect(page.getByPlaceholder('Colegio Ejemplo')).toHaveValue('Colegio Conservado')
})
