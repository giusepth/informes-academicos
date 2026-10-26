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

const storedScore = (value, label, student, subject) =>
  value
    ?.find((entry) => entry.label === label)
    ?.students?.find((entry) => entry.name === student)?.scores?.[subject]

async function openEditor(page) {
  await seed(page, { reports })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await expect(page).toHaveURL(/#\/editor$/)
}

test('a decimal comma typed by keyboard is committed and stored as 0.5', async ({ page }) => {
  await openEditor(page)

  const input = page.getByLabel('Nota de Ana en Matemáticas')
  await input.fill('')
  await input.click()
  await page.keyboard.type('0,5')
  await expect(input).toHaveValue('0,5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => storedScore(value, 'Informe 1', 'Ana', 'Matemáticas') === 0.5,
  )
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('0.5')
})

test('manual score entry clamps to the configured range', async ({ page }) => {
  await openEditor(page)
  const input = page.getByLabel('Nota de Ana en Matemáticas')
  const save = () => page.getByRole('button', { name: 'Guardar cambios' }).click()

  await input.fill('6')
  await save()
  await waitForPersisted(page, 'informes.reports', (value) =>
    storedScore(value, 'Informe 1', 'Ana', 'Matemáticas') === 5,
  )

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('-1')
  await save()
  await waitForPersisted(page, 'informes.reports', (value) =>
    storedScore(value, 'Informe 1', 'Ana', 'Matemáticas') === 0,
  )

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('')
  await save()
  await waitForPersisted(page, 'informes.reports', (value) =>
    storedScore(value, 'Informe 1', 'Ana', 'Matemáticas') === null,
  )
})

test('period and final views never render editor inputs in capture or preview', async ({
  page,
}) => {
  await seed(page, { reports })
  await expect(page.locator('input, textarea')).toHaveCount(0)

  await page.getByRole('button', { name: 'Vista previa' }).click()
  await expect(page.getByRole('heading', { name: 'Vista previa del informe' })).toBeVisible()
  await expect(page.locator('div.fixed.inset-0.z-40 input, div.fixed.inset-0.z-40 textarea')).toHaveCount(0)
  await expect(page.locator('.capture-layer input, .capture-layer textarea')).toHaveCount(0)
})

test('a manual score survives switching periods', async ({ page }) => {
  await seed(page, { reports })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('3.5')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.5')
  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
})

test('an unsaved new student is discarded when leaving the editor', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Agregar estudiante' }).click()
  await page.getByPlaceholder('Nombre del estudiante').last().fill('Car')

  await page.getByRole('button', { name: 'Volver' }).click()
  await page
    .getByRole('dialog', { name: 'Cambios sin guardar' })
    .getByRole('button', { name: 'Volver sin guardar' })
    .click()

  await expect(page).toHaveURL(/#\/gestion$/)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await expect(page.getByPlaceholder('Nombre del estudiante')).toHaveCount(1)
})
