import { expect, test } from '@playwright/test'
import { report, seed } from './helpers'

const reports = [
  report({
    label: 'Informe 1',
    subjects: ['Matemáticas'],
    students: [{ name: 'Ana', scores: { Matemáticas: 4.5 }, performances: {} }],
  }),
]

test('the management menu is reachable from a report and returns to the boletín', async ({
  page,
}) => {
  await seed(page, { reports })

  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await expect(page).toHaveURL(/#\/gestion$/)
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/#\/gestion$/)
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
})

test('a hash route can be opened directly without changing the data', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })

  await page.goto('/#/gestion')
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()

  await page.goto('/#/final')
  await expect(page.getByRole('button', { name: 'Informe 2 (final)' })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.50')
})

test('an unknown hash falls back to a safe screen', async ({ page }) => {
  await seed(page, { reports })
  await page.goto('/#/no-existe')

  await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible()
})
