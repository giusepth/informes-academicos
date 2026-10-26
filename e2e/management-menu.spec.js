import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { readDataKey, report, seed } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const reports = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [
      {
        name: 'Ana',
        scores: { Matemáticas: 4.5, Ciencias: 3.8 },
        performances: {},
      },
    ],
  }),
]

function matrixBytes() {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
      ['Matemáticas', 'Bajo.', 'Básico.', 'Alto.', 'Sup.'],
      ['Ciencias', 'BajoC.', 'BásicoC.', 'AltoC.', 'SupC.'],
    ]),
    'Desempeños',
  )
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const openMenu = async (page) => {
  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
}

test('the management menu groups every action in the four semantic sections', async ({
  page,
}) => {
  await seed(page, { reports })
  await openMenu(page)

  const newWork = page.getByRole('region', { name: 'Nuevo trabajo' })
  const current = page.getByRole('region', { name: 'Trabajo actual' })
  const performances = page.getByRole('region', { name: 'Desempeños' })
  const backup = page.getByRole('region', { name: 'Respaldo y datos' })

  await expect(newWork).toBeVisible()
  await expect(current).toBeVisible()
  await expect(performances).toBeVisible()
  await expect(backup).toBeVisible()

  // Actions are grouped where the SDD says, not in one flat row.
  await expect(newWork.getByRole('button', { name: 'Crear manualmente' })).toBeVisible()
  await expect(newWork.getByRole('button', { name: 'Elegir archivo' })).toBeVisible()
  await expect(newWork.getByRole('button', { name: 'Nuevo periodo en blanco' })).toBeVisible()

  await expect(current.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()
  await expect(current.getByRole('button', { name: 'Informe 2 (final)' })).toBeVisible()
  await expect(current.getByRole('button', { name: 'Abrir boletín' })).toBeVisible()
  await expect(current.getByRole('button', { name: 'Editar período' })).toBeVisible()
  await expect(current).toContainText('Estado del período activo')

  await expect(
    performances.getByRole('button', { name: 'Cargar desempeños (excel)' }),
  ).toBeVisible()
  await expect(
    performances.getByRole('button', { name: 'Descargar plantilla de desempeños' }),
  ).toBeVisible()
  await expect(
    performances.getByRole('button', { name: 'Descargar ejemplo de desempeños' }),
  ).toBeVisible()

  await expect(backup.getByRole('button', { name: 'Exportar backup (.xlsx)' })).toBeVisible()
  await expect(backup.getByRole('button', { name: 'Limpiar informes' })).toBeVisible()
  // The destructive action is separated from the export, not in the header.
  await expect(page.locator('header').getByRole('button', { name: 'Limpiar informes' })).toHaveCount(0)
})

test('the menu keeps the section order as the logical tab order', async ({ page }) => {
  await seed(page, { reports })
  await openMenu(page)

  const headings = await page.locator('main h3').allTextContents()
  expect(headings).toEqual(['Nuevo trabajo', 'Trabajo actual', 'Desempeños', 'Respaldo y datos'])
})

test('editing the active period from the menu opens score entry on it', async ({ page }) => {
  await seed(page, { reports })
  await openMenu(page)

  await page.getByRole('button', { name: 'Editar período' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('button', { name: 'Terminar edición' })).toBeVisible()
  await expect(page.locator('input[aria-label^="Nota de"]').first()).toBeVisible()
})

test('a pending matrix shows its status and can be replaced or removed', async ({ page }) => {
  await seed(page, { reports })
  await openMenu(page)

  const file = {
    name: 'matriz.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: matrixBytes(),
  }
  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles(file)

  const status = page.getByRole('status').filter({ hasText: 'Matriz pendiente' })
  await expect(status).toContainText('2 asignaturas detectadas')
  await expect(page.getByRole('button', { name: 'Reemplazar archivo' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Aplicar al informe final' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Quitar matriz' }).click()

  await expect(status).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cargar desempeños (excel)' })).toBeVisible()
  expect(
    await page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix')),
  ).toBeNull()
})

test('the pending matrix waits in the menu and fills the first report on open', async ({
  page,
}) => {
  await seed(page, { reports })
  await openMenu(page)

  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles({
    name: 'matriz.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: matrixBytes(),
  })

  // Still on the menu: loading the matrix must not mutate the current report.
  await expect(page.getByText('Matriz pendiente: 2 asignaturas detectadas.')).toBeVisible()
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances?.['Matemáticas']).toBeUndefined()

  await page.getByRole('button', { name: 'Abrir boletín' }).click()

  await expect(page.getByText('Desempeños aplicados a Informe 1.')).toBeVisible()
  const math = page.locator('tr', { hasText: 'Matemáticas' }).first().locator('textarea')
  await expect(math).toHaveValue('Alto.')
  expect(
    await page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix')),
  ).toBeNull()
})

test('the menu has no horizontal overflow on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await seed(page, { reports })
  await openMenu(page)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  for (const name of ['Nuevo trabajo', 'Trabajo actual', 'Desempeños', 'Respaldo y datos']) {
    await expect(page.getByRole('region', { name })).toBeVisible()
  }
})
