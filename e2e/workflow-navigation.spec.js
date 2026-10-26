import { expect, test } from '@playwright/test'
import { readDataKey, report, seed, waitForHydrated } from './helpers'

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

test('browser back from the final report returns to the editable period view', async ({ page }) => {
  await seed(page, { reports })
  await page.goto('/#/boletin')
  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()

  await page.getByRole('button', { name: 'Informe 2 (final)' }).click()
  await expect(page).toHaveURL(/#\/final$/)

  await page.goBack()
  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar notas' }).click()
  await expect(page.locator('input[aria-label^="Nota de"]').first()).toBeVisible()
})

test('a direct boletín route is editable even when the stored tab is final', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })
  await page.goto('/#/boletin')

  await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 2 (final)' })).not.toHaveClass(
    /bg-slate-900/,
  )
})

test('the final route never offers period-editing actions', async ({ page }) => {
  await seed(page, { reports })
  await page.goto('/#/final')

  await expect(page.getByRole('button', { name: 'Informe 2 (final)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nuevo periodo en blanco' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Editar notas' })).toHaveCount(0)
})

test('opening hash routes does not rewrite stored reports', async ({ page }) => {
  await seed(page, { reports })
  await waitForHydrated(page)

  const before = JSON.stringify(await readDataKey(page, 'informes.reports'))
  await page.goto('/#/gestion')
  await page.goto('/#/final')
  const after = JSON.stringify(await readDataKey(page, 'informes.reports'))

  expect(after).toBe(before)
})

test('the management menu never exposes a dead edit-notes control', async ({ page }) => {
  await seed(page, { reports })
  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await expect(page).toHaveURL(/#\/gestion$/)

  await expect(page.getByRole('button', { name: 'Editar notas' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Nombre del estudiante')).toHaveCount(0)
})

test('a blank period created from the management menu opens score entry', async ({ page }) => {
  await seed(page, { reports })
  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('button', { name: 'Terminar edición' })).toBeVisible()
  await expect(page.locator('input[aria-label^="Nota de"]').first()).toBeVisible()
})
