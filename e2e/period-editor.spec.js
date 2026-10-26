import { expect, test } from '@playwright/test'
import {
  openManagementMenu,
  readDataKey,
  report,
  seed,
  waitForPersisted,
} from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const first = report({
  label: 'Informe 1',
  grade: '5° A',
  subjects: SUBJECTS,
  students: [
    {
      name: 'Ana',
      scores: { Matemáticas: 4.5, Ciencias: 3.8 },
      performances: { Matemáticas: 'Juicio original' },
    },
  ],
})

const second = report({
  label: 'Informe 2',
  grade: '6° B',
  subjects: SUBJECTS,
  students: [{ name: 'Luis', scores: { Matemáticas: 2.0, Ciencias: 2.5 }, performances: {} }],
})


test('a blank period is edited in the editor and saved as a new period', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()

  await expect(page).toHaveURL(/#\/editor$/)
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await expect(page.getByLabel('Grado / Curso')).toHaveValue('5° A')
  await expect(page.getByRole('button', { name: 'Crear período' })).toBeVisible()

  // The copy keeps the structure, not the scores or judgments.
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('')
  await expect(page.getByLabel('Desempeño de Ana en Matemáticas')).toHaveValue('')

  await page.getByRole('button', { name: 'Agregar estudiante' }).click()
  await page.getByPlaceholder('Nombre del estudiante').last().fill('Bruno')
  await page.getByLabel('Nota de Ana en Matemáticas').fill('3,5')
  await page.getByLabel('Desempeño de Ana en Matemáticas').fill('Progresa con apoyo')
  await page.getByLabel('Nota de Bruno en Ciencias').fill('4.0')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('button', { name: 'Informe 2', exact: true })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
  await expect(page.getByText('Progresa con apoyo').first()).toBeVisible()
  await expect(page.locator('input, textarea')).toHaveCount(0)

  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[1].students.map((student) => student.name)).toEqual(['Ana', 'Bruno'])
  expect(stored[1].students[0].scores.Matemáticas).toBe(3.5)
  expect(stored[1].students[0].performances.Matemáticas).toBe('Progresa con apoyo')
  const ids = stored.flatMap((entry) => entry.students.map((student) => student.id))
  expect(new Set(ids).size).toBe(ids.length)

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.5')
  await expect(page.getByText('Juicio original').first()).toBeVisible()
})

test('editing a period preserves its identity and leaves other periods intact', async ({
  page,
}) => {
  await seed(page, { reports: [first, second] })
  const before = await readDataKey(page, 'informes.reports')
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await expect(page).toHaveURL(/#\/editor$/)
  await expect(page.getByRole('heading', { name: 'Editar período' })).toBeVisible()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('5.0')
  await page.getByLabel('Desempeño de Ana en Ciencias').fill('Cierre del período')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('5.0')
  await expect(page.getByText('Cierre del período').first()).toBeVisible()
  await expect(page.locator('input, textarea')).toHaveCount(0)

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.scores?.Matemáticas === 5,
  )
  const after = await readDataKey(page, 'informes.reports')
  expect(after[0].id).toBe(before[0].id)
  expect(after[0].students[0].id).toBe(before[0].students[0].id)
  expect(after[1]).toEqual(before[1])

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('2.0')
})

test('removing a subject drops its scores and performances from that period only', async ({
  page,
}) => {
  await seed(page, { reports: [first, second] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByRole('button', { name: 'Quitar Ciencias' }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.subjects?.length === 1,
  )
  const after = await readDataKey(page, 'informes.reports')
  expect(after[0].subjects).toEqual(['Matemáticas'])
  expect(after[0].students[0].scores).toEqual({ Matemáticas: 4.5 })
  expect(after[0].students[0].performances).toEqual({ Matemáticas: 'Juicio original' })
  expect(after[1].subjects).toEqual(SUBJECTS)
  expect(after[1].students[0].scores).toEqual({ Matemáticas: 2, Ciencias: 2.5 })
})

test('leaving with unsaved changes asks first and can keep editing', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  const before = await readDataKey(page, 'informes.reports')

  await page.getByLabel('Nota de Ana en Matemáticas').fill('1.0')
  await page.getByRole('button', { name: 'Volver' }).click()

  const dialog = page.getByRole('dialog', { name: 'Cambios sin guardar' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Seguir editando' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('1')

  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByRole('dialog', { name: 'Cambios sin guardar' })
    .getByRole('button', { name: 'Volver sin guardar' })
    .click()

  await expect(page).toHaveURL(/#\/gestion$/)
  expect(await readDataKey(page, 'informes.reports')).toEqual(before)
})

test('leaving without changes does not ask for confirmation', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page).toHaveURL(/#\/gestion$/)
  await expect(page.getByRole('dialog', { name: 'Cambios sin guardar' })).toHaveCount(0)
})

test('the editor can create the first report from an empty session', async ({ page }) => {
  await seed(page, { reports: [] })
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()

  await page.getByRole('button', { name: 'Crear manualmente' }).click()
  await expect(page).toHaveURL(/#\/editor$/)
  await page.getByPlaceholder('Nombre del estudiante').first().fill('Ana')
  await page.getByLabel('Nota de Ana en Matemáticas').fill('4.0')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.0')
})

test('the editor validates subjects and students before saving', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByPlaceholder('Nombre del estudiante').fill('')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert')).toContainText('al menos un estudiante')
  await expect(page).toHaveURL(/#\/editor$/)
})
