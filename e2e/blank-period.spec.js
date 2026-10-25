import { expect, test } from '@playwright/test'
import { report, seed, waitForHydrated, waitForPersisted } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const reports = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [
      {
        name: 'Ana',
        scores: { 'Matemáticas': 4.5, 'Ciencias': 3.8 },
        performances: {},
      },
    ],
  }),
]

test('a blank period opens manual score entry and keeps each period isolated', async ({ page }) => {
  await seed(page, { reports })

  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()

  await expect(page.getByRole('button', { name: 'Terminar edición' })).toBeVisible()
  const mathInput = page.locator('input[aria-label^="Nota de Matemáticas"]')
  await expect(mathInput).toBeVisible()

  await mathInput.fill('3.5')
  await page.getByRole('button', { name: 'Terminar edición' }).click()

  // Back to the static sheet: the entered score displays verbatim and no
  // score inputs remain.
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
  await expect(page.locator('input[aria-label^="Nota de"]')).toHaveCount(0)

  // The original period is untouched.
  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.5')
})

test('a student can be added by hand in the blank period', async ({ page }) => {
  await seed(page, { reports })
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()

  const nameInput = page.getByPlaceholder('Nombre del estudiante')
  await nameInput.fill('Bruno')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()

  await expect(page.getByRole('button', { name: /Bruno/ })).toBeVisible()
  await expect(nameInput).toHaveValue('')
  await expect(page.locator('input[aria-label="Nota de Matemáticas para Bruno"]')).toBeVisible()
})

test('a blank period keeps a manual score across period switches (AC3)', async ({ page }) => {
  await seed(page, { reports })
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()

  await page.getByPlaceholder('Nombre del estudiante').fill('Bruno')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  await page.locator('input[aria-label="Nota de Matemáticas para Bruno"]').fill('3.5')
  await page.keyboard.press('Enter')

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await expect(page.locator('input[aria-label^="Nota de"]')).toHaveCount(0)
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.5')

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
})

test('manual scores survive a reload', async ({ page }) => {
  await seed(page, { reports })
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()
  await page.locator('input[aria-label^="Nota de Matemáticas"]').fill('3.5')
  await page.keyboard.press('Enter')

  await waitForPersisted(page, 'informes.reports', (value) =>
    JSON.stringify(value).includes('3.5'),
  )

  await page.reload()
  await waitForHydrated(page)

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
})

test('the default period view never shows score inputs', async ({ page }) => {
  await seed(page, { reports })

  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await expect(page.locator('input[aria-label^="Nota de"]')).toHaveCount(0)
})
