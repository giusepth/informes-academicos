import { expect, test } from '@playwright/test'
import { openManagementMenu, report, seed, waitForPersisted } from './helpers'

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

const mathCell = (page) =>
  page.locator('tr', { hasText: 'Matemáticas' }).first().locator('td').nth(1)

const mathInput = (page, student = 'Ana') =>
  page.locator(`input[aria-label="Nota de Matemáticas para ${student}"]`)

const storedScore = (value, label, student, subject) =>
  value
    ?.find((entry) => entry.label === label)
    ?.students?.find((entry) => entry.name === student)?.scores?.[subject]

async function openBlankPeriod(page) {
  await seed(page, { reports })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()
}

test('a decimal comma typed by keyboard is committed and stored as 0.5', async ({ page }) => {
  await openBlankPeriod(page)

  const input = mathInput(page)
  await input.click()
  await page.keyboard.type('0,5')
  await expect(input).toHaveValue('0,5')

  await page.getByRole('button', { name: 'Terminar edición' }).click()

  await expect(mathCell(page)).toHaveText('0.5')
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => storedScore(value, 'Informe 2', 'Ana', 'Matemáticas') === 0.5,
  )
})

test('manual score entry clamps to the configured range', async ({ page }) => {
  await openBlankPeriod(page)

  const enter = () => page.getByRole('button', { name: 'Editar notas' }).click()
  const exit = () => page.getByRole('button', { name: 'Terminar edición' }).click()

  await mathInput(page).fill('6')
  await exit()
  await expect(mathCell(page)).toHaveText('5.0')

  await enter()
  await mathInput(page).fill('-1')
  await exit()
  await expect(mathCell(page)).toHaveText('0.0')

  await enter()
  await mathInput(page).fill('')
  await exit()
  await expect(mathCell(page)).toHaveText('—')

  await enter()
  await mathInput(page).fill('0')
  await exit()
  await expect(mathCell(page)).toHaveText('0.0')
})

test('a manual score survives switching periods and edit mode closes on navigation', async ({
  page,
}) => {
  await openBlankPeriod(page)

  await page.getByPlaceholder('Nombre del estudiante').fill('Bruno')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  await mathInput(page, 'Bruno').fill('3.5')
  await page.keyboard.press('Enter')

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await expect(page.locator('input[aria-label^="Nota de"]')).toHaveCount(0)
  await expect(mathCell(page)).toHaveText('4.5')

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await expect(page.locator('input[aria-label^="Nota de"]')).toHaveCount(0)
  await expect(mathCell(page)).toHaveText('3.5')
})

test('capture, final report and preview never render score inputs', async ({ page }) => {
  await seed(page, { reports })
  await page.getByRole('button', { name: 'Editar notas' }).click()

  await expect(page.locator('input[aria-label^="Nota de"]')).toHaveCount(2)
  await expect(page.locator('.capture-layer input')).toHaveCount(0)

  await page.getByRole('button', { name: 'Informe 2 (final)' }).click()
  await expect(page.getByRole('button', { name: 'Editar notas' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Terminar edición' })).toHaveCount(0)
  await expect(page.locator('input[aria-label^="Nota de"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await page.getByRole('button', { name: 'Vista previa' }).click()

  const preview = page.locator('div.fixed.inset-0.z-40')
  await expect(page.getByRole('heading', { name: 'Vista previa del informe' })).toBeVisible()
  await expect(preview.locator('input')).toHaveCount(0)
  await expect(page.locator('.capture-layer input')).toHaveCount(0)
})

test('the add-student draft does not leak across periods', async ({ page }) => {
  await openBlankPeriod(page)

  const nameInput = page.getByPlaceholder('Nombre del estudiante')
  await nameInput.fill('Car')

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await page.getByRole('button', { name: 'Editar notas' }).click()

  await expect(page.getByPlaceholder('Nombre del estudiante')).toHaveValue('')
})
