import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import {
  openManagementMenu,
  readDataKey,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const NEXT_KEY = 'informes.nextPeriodMatrix'
const EMPTY_MATRIX_MESSAGE =
  'La plantilla no tiene textos de desempeño: completa las celdas antes de cargarla.'

function workbookBytes(aoa) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Desempeños')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const MATRIX = workbookBytes([
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Matemáticas', 'M-Bajo', 'M-Básico', 'M-Alto', 'M-Superior'],
  ['Ciencias', 'C-Bajo', 'C-Básico', 'C-Alto', 'C-Superior'],
])

const fileFor = (buffer) => ({
  name: 'matriz.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer,
})

const periodWorkbook = (name, ownText = null) =>
  XLSX.write(
    (() => {
      const workbook = XLSX.utils.book_new()
      const header = ['Estudiante', 'Grado', 'Docente', 'Matemáticas', 'Ciencias']
      if (ownText !== null) header.push('Desempeño (Matemáticas)')
      const row = [name, '5° A', 'Prof. Rivera', 4.5, 4.0]
      if (ownText !== null) row.push(ownText)
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, row]), 'Informe')
      return workbook
    })(),
    { type: 'buffer', bookType: 'xlsx' },
  )

const download = async (page, name) => {
  const [event] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name, exact: true }).click(),
  ])
  return event
}

const enterTool = async (page, institution = 'Colegio Matriz') => {
  await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
  await page.getByPlaceholder('Colegio Ejemplo').fill(institution)
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
}

const loadLandingMatrix = async (page, buffer = MATRIX) => {
  await page
    .locator('input[aria-label="Archivo de matriz del próximo período"]')
    .setInputFiles(fileFor(buffer))
}

const pendingStatus = (root) =>
  root.getByRole('status').filter({ hasText: 'Matriz del próximo período' })

test('the landing offers the next-period matrix actions and state', async ({ page }) => {
  await page.goto('/')
  await waitForHydrated(page)

  const section = page.getByRole('region', { name: 'Desempeños antes de empezar' })
  await expect(section).toBeVisible()
  await expect(
    section.getByRole('button', { name: 'Cargar desempeños del próximo período (.xlsx)' }),
  ).toBeVisible()
  await expect(
    section.getByRole('button', { name: 'Descargar plantilla de desempeños' }),
  ).toBeVisible()
  await expect(
    section.getByRole('button', { name: 'Descargar ejemplo de desempeños' }),
  ).toBeVisible()

  const template = await download(page, 'Descargar plantilla de desempeños')
  expect(template.suggestedFilename()).toBe('plantilla-desempenos.xlsx')
  const templatePath = await template.path()
  expect((await fs.stat(templatePath)).size).toBeGreaterThan(0)
  const sample = await download(page, 'Descargar ejemplo de desempeños')
  expect(sample.suggestedFilename()).toBe('ejemplo-desempenos.xlsx')
  expect((await fs.stat(await sample.path())).size).toBeGreaterThan(0)

  // An unedited template is rejected and arms nothing.
  await section
    .locator('input[aria-label="Archivo de matriz del próximo período"]')
    .setInputFiles(templatePath)
  await expect(section.getByText(EMPTY_MATRIX_MESSAGE, { exact: true })).toBeVisible()
  await expect(pendingStatus(section)).toHaveCount(0)
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), NEXT_KEY)).toBeNull()

  // A real matrix shows the detected subjects and the single-use promise.
  await loadLandingMatrix(page)
  await expect(pendingStatus(section)).toContainText('2 asignaturas detectadas')
  await expect(
    section.getByText(
      'Se aplicará al primer período que crees, solo a celdas vacías y cuando existan notas.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(section.getByRole('button', { name: 'Reemplazar archivo' })).toBeVisible()
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), NEXT_KEY)).not.toBeNull()

  await section.getByRole('button', { name: 'Quitar matriz' }).click()
  await expect(pendingStatus(section)).toHaveCount(0)
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), NEXT_KEY)).toBeNull()
})

test('a landing matrix applies once to the first manually created period', async ({ page }) => {
  await page.goto('/')
  await waitForHydrated(page)
  await loadLandingMatrix(page)
  await enterTool(page)

  // The pending payload is visible in the menu through the shared component.
  const menuPerformances = page.getByRole('region', { name: 'Desempeños' })
  await expect(pendingStatus(menuPerformances)).toContainText('2 asignaturas detectadas')

  await page.getByRole('button', { name: 'Crear manualmente' }).click()
  await page.getByLabel('Nombre de asignatura 1').fill('Matemáticas')
  await page.getByRole('button', { name: 'Agregar asignatura' }).click()
  await page.getByLabel('Nombre de asignatura 2').fill('Ciencias')
  await page.getByPlaceholder('Nombre del estudiante').first().fill('Ana')
  await page.getByLabel('Nota de Ana en Matemáticas').fill('4.5')
  await page.getByLabel('Nota de Ana en Ciencias').fill('4.0')
  await page.getByLabel('Desempeño de Ana en Matemáticas').fill('Texto propio')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.['Ciencias'] === 'C-Alto',
  )
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances).toEqual({
    'Matemáticas': 'Texto propio',
    'Ciencias': 'C-Alto',
  })
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), NEXT_KEY))
    .toBeNull()

  // The next period is never touched by the consumed matrix.
  await openManagementMenu(page)
  await expect(pendingStatus(page.getByRole('region', { name: 'Desempeños' }))).toHaveCount(0)
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()
  await page.getByPlaceholder('Nombre del estudiante').first().fill('Luis')
  await page.getByLabel('Nota de Luis en Matemáticas').fill('3.0')
  await page.getByRole('button', { name: 'Crear período' }).click()
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)

  const after = await readDataKey(page, 'informes.reports')
  expect(after[1].students[0].performances?.['Matemáticas'] ?? '').toBe('')
})

test('a landing matrix fills only empty cells of the first imported period', async ({ page }) => {
  await page.goto('/')
  await waitForHydrated(page)
  await loadLandingMatrix(page)
  await enterTool(page)

  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(fileFor(periodWorkbook('Ana', 'Juicio propio')))
  await expect(page.getByText(/Informe 1 cargado/)).toBeVisible()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.['Ciencias'] === 'C-Alto',
  )

  const first = await readDataKey(page, 'informes.reports')
  expect(first[0].students[0].performances).toEqual({
    'Matemáticas': 'Juicio propio',
    'Ciencias': 'C-Alto',
  })

  // A later period import must not receive the already consumed matrix.
  await openManagementMenu(page)
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(fileFor(periodWorkbook('Luis')))
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)
  const second = await readDataKey(page, 'informes.reports')
  expect(second[1].students[0].performances?.['Matemáticas'] ?? '').toBe('')
  expect(second[1].students[0].performances?.['Ciencias'] ?? '').toBe('')
})

test('the old pendingMatrix key is ignored', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'informes.pendingMatrix',
      JSON.stringify({ 'Matemáticas': { Alto: 'Legado' } }),
    )
  })
  await page.goto('/')
  await waitForHydrated(page)

  await expect(pendingStatus(page)).toHaveCount(0)
  await enterTool(page)
  await expect(pendingStatus(page.getByRole('region', { name: 'Desempeños' }))).toHaveCount(0)
})
