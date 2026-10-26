import { expect, test } from '@playwright/test'
import {
  openManagementMenu,
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
        scores: { 'Matemáticas': 4.5, 'Ciencias': 3.8 },
        performances: {},
      },
    ],
  }),
]

async function openBlankEditor(page) {
  await seed(page, { reports })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()
  await expect(page).toHaveURL(/#\/editor$/)
}

test('a blank period is edited in the editor and keeps each period isolated', async ({ page }) => {
  await openBlankEditor(page)

  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  const mathInput = page.getByLabel('Nota de Ana en Matemáticas')
  await mathInput.fill('3.5')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
  await expect(page.locator('input, textarea')).toHaveCount(0)

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.5')
})

test('a student can be added by hand in the editor', async ({ page }) => {
  await openBlankEditor(page)

  await page.getByRole('button', { name: 'Agregar estudiante' }).click()
  const nameInputs = page.getByPlaceholder('Nombre del estudiante')
  await nameInputs.last().fill('Bruno')
  await page.getByLabel('Nota de Bruno en Matemáticas').fill('4.0')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await page.getByRole('button', { name: /Bruno/ }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.0')
})

test('a blank period keeps a manual score across period switches (AC3)', async ({ page }) => {
  await openBlankEditor(page)

  await page.getByLabel('Nota de Ana en Matemáticas').fill('3.5')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.5')

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
})

test('manual scores survive a reload', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByLabel('Nota de Ana en Matemáticas').fill('3.5')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await waitForPersisted(page, 'informes.reports', (value) =>
    JSON.stringify(value).includes('3.5'),
  )

  await page.reload()
  await waitForHydrated(page)

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
})

test('the default period view is read-only and never shows editor controls', async ({ page }) => {
  await seed(page, { reports })

  await expect(page.locator('input, textarea')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Editar notas' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Nombre del estudiante')).toHaveCount(0)

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await expect(page).toHaveURL(/#\/editor$/)
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toBeVisible()
})
