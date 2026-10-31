import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { openManagementMenu, seed } from './helpers'

/**
 * Guided manual entry (S8): students + subjects first, a confirmation stop,
 * the desempeños question BEFORE grades, and the destination choice after an
 * Excel of per-student texts.
 */

const performancesBytes = (aoa) => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Desempeños')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const AOA = [
  ['Estudiante', 'Asignatura', 'Desempeño'],
  ['Ana Gómez', 'Matemáticas', 'Resuelve con autonomía.'],
  ['Luis Pérez', 'Matemáticas', 'Requiere acompañamiento.'],
]

const startWizard = async (page) => {
  await seed(page, { reports: [] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Crear manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Carga manual del período' })).toBeVisible()
  await page.getByText('Cargar una lista de estudiantes').click()
  await page.getByLabel('Lista de estudiantes para pegar').fill('Ana Gómez\nLuis Pérez')
  await page.getByRole('button', { name: 'Cargar lista' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText(/Se han cargado 2 estudiantes y 1 asignatura/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Quieres cargar los desempeños?' })).toBeVisible()
}

test('manual path: confirmation stop, desempeños question, then the editor', async ({ page }) => {
  await startWizard(page)
  await page.getByRole('button', { name: 'Cargar manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await expect(page.getByLabel('Nota de Ana Gómez en Matemáticas')).toBeVisible()
  await expect(page.getByLabel('Nombre del estudiante 1')).toHaveValue('Ana Gómez')
})

test('excel path: preview of loaded desempeños and the editor destination', async ({ page }) => {
  await startWizard(page)
  await page.getByLabel('Archivo de desempeños').setInputFiles({
    name: 'desempenos.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: performancesBytes(AOA),
  })
  await expect(page.getByRole('heading', { name: 'Desempeños cargados' })).toBeVisible()
  await expect(page.getByText(/2 textos cargados en 2 estudiantes/)).toBeVisible()
  await page.getByRole('button', { name: 'Ir al menú de edición' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await expect(page.getByLabel('Desempeño de Ana Gómez en Matemáticas')).toHaveValue(
    'Resuelve con autonomía.',
  )
})

test('excel path: reports destination persists the period with performances', async ({ page }) => {
  await startWizard(page)
  await page.getByLabel('Archivo de desempeños').setInputFiles({
    name: 'desempenos.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: performancesBytes(AOA),
  })
  await expect(page.getByRole('heading', { name: 'Desempeños cargados' })).toBeVisible()
  await page.getByRole('button', { name: 'Ir a la vista de informes' }).click()
  await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible()
  await expect(page.getByText(/Informe 1 creado con 2 estudiantes/)).toBeVisible()
})
