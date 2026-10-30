import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { openManagementMenu, readDataKey, report, seed, waitForPersisted } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const reports = [1, 2].map((n) =>
  report({
    label: `Informe ${n}`,
    subjects: SUBJECTS,
    students: [
      {
        name: 'Ana Gómez',
        scores: {
          'Matemáticas': n === 1 ? 4.5 : 4.5,
          'Ciencias': n === 1 ? 4.0 : 4.0,
        },
      },
      {
        name: 'Luis Pérez',
        scores: { 'Matemáticas': 3.5, 'Ciencias': 3.0 },
      },
    ],
  }),
)

function matrixBytes(aoa = [
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Matemáticas', 'M-Bajo', 'M-Básico', 'M-Alto', 'M-Superior'],
  ['Ciencias', 'C-Bajo', 'C-Básico', 'C-Alto', 'C-Superior'],
]) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Desempeños')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const matrixFile = (buffer) => ({
  name: 'matriz.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer,
})

const openFinalEditor = async (page) => {
  await page.getByRole('button', { name: 'Editar desempeños finales' }).first().click()
  await expect(page.getByRole('heading', { name: 'Editar informe final' })).toBeVisible()
}

const loadFinalMatrix = async (page, buffer) => {
  await page
    .locator('input[aria-label="Archivo de matriz del informe final"]')
    .setInputFiles(matrixFile(buffer))
}

test('the final report is read-only and opens the final editor', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })

  await expect(page.getByText('Informe académico final', { exact: false }).first()).toBeVisible()
  await expect(page.locator('textarea')).toHaveCount(0)

  await openFinalEditor(page)
  await expect(page).toHaveURL(/#\/editor-final$/)
  await expect(page.getByLabel('Desempeño final de Ana Gómez en Matemáticas')).toBeVisible()
})

test('saving final annotations updates the final report and survives a reload', async ({
  page,
}) => {
  await seed(page, { reports, tab: 'final' })
  await openFinalEditor(page)

  await page
    .getByLabel('Desempeño final de Ana Gómez en Matemáticas')
    .fill('Alto desempeño sostenido en el año')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(page).toHaveURL(/#\/final$/)
  await expect(page.getByText('Alto desempeño sostenido en el año').first()).toBeVisible()
  await waitForPersisted(
    page,
    'informes.finalPerformances',
    (value) => value?.['ANA GÓMEZ']?.['Matemáticas'] === 'Alto desempeño sostenido en el año',
  )

  // Final annotations never leak into period performances.
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances?.['Matemáticas']).toBeUndefined()

  await page.reload()
  await expect(page.getByText('Alto desempeño sostenido en el año').first()).toBeVisible()
})

test('saving without edits does not invent empty annotations', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })
  await openFinalEditor(page)

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page).toHaveURL(/#\/final$/)
  await waitForPersisted(
    page,
    'informes.finalPerformances',
    (value) => value && Object.keys(value).length === 0,
  )
})

test('leaving the final editor with changes asks before discarding', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })
  const before = await readDataKey(page, 'informes.finalPerformances')
  await openFinalEditor(page)

  await page.getByLabel('Desempeño final de Ana Gómez en Ciencias').fill('Texto descartado')
  await page.getByRole('button', { name: 'Volver' }).click()

  const dialog = page.getByRole('dialog', { name: 'Cambios sin guardar' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Seguir editando' }).click()
  await expect(page).toHaveURL(/#\/editor-final$/)

  await page.getByRole('button', { name: 'Volver' }).click()
  await dialog.getByRole('button', { name: 'Volver sin guardar' }).click()
  await expect(page).toHaveURL(/#\/final$/)
  expect(await readDataKey(page, 'informes.finalPerformances')).toEqual(before)

  await openFinalEditor(page)
  await expect(page.getByLabel('Desempeño final de Ana Gómez en Ciencias')).toHaveValue('')
})

test('the final matrix fills only empty annotations and is not persisted', async ({ page }) => {
  const withOwnText = [
    report({
      label: 'Informe 1',
      subjects: SUBJECTS,
      students: [
        {
          name: 'Ana',
          scores: { 'Matemáticas': 4.5, 'Ciencias': 4.0 },
          performances: { 'Matemáticas': 'Juicio propio' },
        },
      ],
    }),
  ]
  await seed(page, {
    reports: withOwnText,
    finalPerformances: { ANA: { 'Matemáticas': 'Juicio propio' } },
    tab: 'final',
  })
  await openFinalEditor(page)

  await loadFinalMatrix(page, matrixBytes())
  const status = page.getByRole('status').filter({ hasText: 'Matriz cargada' })
  await expect(status).toContainText('2 asignaturas detectadas')
  await expect(status).toContainText('1 casillero a completar')
  await expect(status).toContainText('1 con texto propio')

  await page.getByRole('button', { name: 'Aplicar al informe final' }).click()
  await expect(page.getByText('Matriz aplicada: 1 casillero completado.')).toBeVisible()
  await expect(page.getByLabel('Desempeño final de Ana en Matemáticas')).toHaveValue(
    'Juicio propio',
  )
  await expect(page.getByLabel('Desempeño final de Ana en Ciencias')).toHaveValue('C-Alto')

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.finalPerformances',
    (value) => value?.ANA?.['Ciencias'] === 'C-Alto',
  )

  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances?.['Ciencias'] ?? '').toBe('')
  expect(
    await page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix')),
  ).toBeNull()

  // Reopening shows the saved texts but not the matrix file.
  await openFinalEditor(page)
  await expect(page.getByRole('button', { name: 'Cargar matriz (.xlsx)' })).toBeVisible()
  await expect(page.getByText('Matriz cargada', { exact: false })).toHaveCount(0)
  await expect(page.getByLabel('Desempeño final de Ana en Ciencias')).toHaveValue('C-Alto')
})

test('an unedited final matrix template warns and arms nothing', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })
  await openFinalEditor(page)

  await loadFinalMatrix(
    page,
    matrixBytes([
      ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
      ['Matemáticas', '', '', '', ''],
    ]),
  )

  await expect(
    page.getByText(
      'La plantilla no tiene textos de desempeño: completa las celdas antes de cargarla.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Matriz cargada' })).toHaveCount(0)
})

test('the management menu no longer stages a global final matrix', async ({ page }) => {
  await seed(page, { reports })
  await openManagementMenu(page)

  const performances = page.getByRole('region', { name: 'Desempeños' })
  await expect(
    performances.getByRole('button', { name: 'Cargar matriz del informe final (excel)' }),
  ).toHaveCount(0)
  await expect(
    performances.getByRole('button', { name: 'Descargar plantilla de desempeños' }),
  ).toBeVisible()
  await expect(
    performances.getByRole('button', { name: 'Descargar ejemplo de desempeños' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Editar desempeños finales' }).click()
  await expect(page).toHaveURL(/#\/editor-final$/)
})
