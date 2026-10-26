import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { openManagementMenu, readDataKey, report, seed, waitForPersisted } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

function matrixBytes(aoa) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Desempeños')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const MATRIX_A = matrixBytes([
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Matemáticas', 'M-Bajo', 'M-Básico', 'M-Alto', 'M-Superior'],
  ['Ciencias', 'C-Bajo', 'C-Básico', 'C-Alto', 'C-Superior'],
])

const MATRIX_B = matrixBytes([
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Ciencias', '', 'B-Básico', '', ''],
])

const EMPTY_MATRIX = matrixBytes([
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Matemáticas', '', '', '', ''],
])

const HISTORY_MATRIX = matrixBytes([
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Historia', 'H-Bajo', 'H-Básico', 'H-Alto', 'H-Superior'],
])

const first = report({
  label: 'Informe 1',
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
  subjects: SUBJECTS,
  students: [{ name: 'Luis', scores: { Matemáticas: 4.0, Ciencias: 3.5 }, performances: {} }],
})

const loadPeriodMatrix = (page, buffer) =>
  page.locator('input[aria-label="Archivo de matriz del período"]').setInputFiles({
    name: 'matriz.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  })

test('a period matrix fills only empty cells and is not persisted', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await loadPeriodMatrix(page, MATRIX_A)
  const status = page.getByRole('status').filter({ hasText: 'Matriz cargada' })
  await expect(status).toContainText('2 asignaturas detectadas')
  await expect(status).toContainText('1 casillero a completar')
  await expect(status).toContainText('1 con texto propio')
  await expect(status).toContainText('0 sin nota')

  await page.getByRole('button', { name: 'Aplicar a este período' }).click()
  await expect(page.getByText('Matriz aplicada: 1 casillero completado.')).toBeVisible()
  await expect(page.getByLabel('Desempeño de Ana en Matemáticas')).toHaveValue('Juicio original')
  await expect(page.getByLabel('Desempeño de Ana en Ciencias')).toHaveValue('C-Básico')

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.Ciencias === 'C-Básico',
  )
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances).toEqual({
    Matemáticas: 'Juicio original',
    Ciencias: 'C-Básico',
  })
  expect(
    await page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix')),
  ).toBeNull()

  // Reopening the period shows the saved texts but not the matrix file.
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await expect(page.getByRole('button', { name: 'Cargar matriz (.xlsx)' })).toBeVisible()
  await expect(page.getByText('Matriz cargada', { exact: false })).toHaveCount(0)
  await expect(page.getByLabel('Desempeño de Ana en Ciencias')).toHaveValue('C-Básico')
})

test('cancelling discards the loaded matrix and its applied texts', async ({ page }) => {
  await seed(page, { reports: [first] })
  const before = await readDataKey(page, 'informes.reports')
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await loadPeriodMatrix(page, MATRIX_A)
  await page.getByRole('button', { name: 'Aplicar a este período' }).click()
  await expect(page.getByLabel('Desempeño de Ana en Ciencias')).toHaveValue('C-Básico')

  await page.getByRole('button', { name: 'Volver' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cambios sin guardar' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Volver sin guardar' }).click()

  expect(await readDataKey(page, 'informes.reports')).toEqual(before)
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await expect(page.getByRole('button', { name: 'Cargar matriz (.xlsx)' })).toBeVisible()
  await expect(page.getByLabel('Desempeño de Ana en Ciencias')).toHaveValue('')
})

test('each period keeps its own matrix and applied texts', async ({ page }) => {
  await seed(page, { reports: [first, second] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await loadPeriodMatrix(page, MATRIX_A)
  await page.getByRole('button', { name: 'Aplicar a este período' }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.Ciencias === 'C-Básico',
  )

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  // The first period's matrix is not carried into the second editor.
  await expect(page.getByRole('button', { name: 'Cargar matriz (.xlsx)' })).toBeVisible()
  await loadPeriodMatrix(page, MATRIX_B)
  await page.getByRole('button', { name: 'Aplicar a este período' }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[1]?.students?.[0]?.performances?.Ciencias === 'B-Básico',
  )

  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances).toEqual({
    Matemáticas: 'Juicio original',
    Ciencias: 'C-Básico',
  })
  expect(stored[1].students[0].performances).toEqual({
    Matemáticas: '',
    Ciencias: 'B-Básico',
  })
})

test('a matrix that does not match the period explains the mismatch', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await loadPeriodMatrix(page, HISTORY_MATRIX)
  const status = page.getByRole('status').filter({ hasText: 'Matriz cargada' })
  await expect(status).toContainText('0 casilleros a completar')
  await expect(status).toContainText('1 casillero sin coincidencia')

  await page.getByRole('button', { name: 'Aplicar a este período' }).click()
  await expect(
    page.getByText('La matriz no coincide con las asignaturas o bandas de este período.'),
  ).toBeVisible()
  await expect(page.getByLabel('Desempeño de Ana en Ciencias')).toHaveValue('')
})

test('replacing a matrix with the blank template clears the previous one', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await loadPeriodMatrix(page, MATRIX_A)
  await expect(page.getByRole('status').filter({ hasText: 'Matriz cargada' })).toBeVisible()

  await loadPeriodMatrix(page, EMPTY_MATRIX)
  await expect(page.getByText('La plantilla no tiene textos de desempeño', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cargar matriz (.xlsx)' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Matriz cargada' })).toHaveCount(0)
})

test('live counts and apply include an uncommitted score draft', async ({ page }) => {
  const noGrades = report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [{ name: 'Ana', scores: { Matemáticas: null, Ciencias: null }, performances: {} }],
  })
  await seed(page, { reports: [noGrades] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await loadPeriodMatrix(page, MATRIX_A)
  const status = page.getByRole('status').filter({ hasText: 'Matriz cargada' })
  await expect(status).toContainText('2 sin nota')

  // Do not blur: the count must use the draft score immediately.
  await page.getByLabel('Nota de Ana en Matemáticas').fill('4.5')
  await expect(status).toContainText('1 casillero a completar')
  await expect(status).toContainText('1 sin nota')

  await page.getByRole('button', { name: 'Aplicar a este período' }).click()
  await expect(page.getByLabel('Desempeño de Ana en Matemáticas')).toHaveValue('M-Alto')
  await expect(page.getByLabel('Desempeño de Ana en Ciencias')).toHaveValue('')
})

test('a matrix without grades stays loaded and explains why it cannot fill', async ({ page }) => {
  const noGrades = report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [{ name: 'Ana', scores: { Matemáticas: null, Ciencias: null }, performances: {} }],
  })
  await seed(page, { reports: [noGrades] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await loadPeriodMatrix(page, MATRIX_A)
  const status = page.getByRole('status').filter({ hasText: 'Matriz cargada' })
  await expect(status).toContainText('0 casilleros a completar')
  await expect(status).toContainText('2 sin nota')

  await page.getByRole('button', { name: 'Aplicar a este período' }).click()
  await expect(page.getByText('Todavía no hay notas para aplicar la matriz.')).toBeVisible()
  await expect(page.getByLabel('Desempeño de Ana en Ciencias')).toHaveValue('')
  await expect(status).toBeVisible()

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(page, 'informes.reports', (value) => value?.[0]?.students?.length === 1)
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances).toEqual({ Matemáticas: '', Ciencias: '' })
})
