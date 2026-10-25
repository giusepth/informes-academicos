import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { completeFirstRun, waitForHydrated, waitForPersisted } from './helpers'

/**
 * Issue #23: the main menu exposes the desempeño workbook actions and a
 * matrix loaded there waits (sessionStorage) for the first report. It is
 * applied once, only to empty cells, and never overwrites written text.
 */

const PENDING_TOAST = 'Desempeños cargados: se aplicarán al primer informe que abras.'
const ACTIONS = {
  load: 'Cargar desempeños (excel)',
  template: 'Descargar plantilla de desempeños',
  sample: 'Descargar ejemplo de desempeños',
}

async function download(page, name) {
  const [downloadEvent] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name, exact: true }).click(),
  ])
  return downloadEvent
}

async function readMatrix(path) {
  const workbook = XLSX.read(await fs.readFile(path), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
  return Object.fromEntries(
    rows.map((row) => [
      row.Asignatura,
      { Bajo: row.Bajo, 'Básico': row['Básico'], Alto: row.Alto, Superior: row.Superior },
    ]),
  )
}

test('the main menu offers the three desempeño actions and downloads both files', async ({
  page,
}) => {
  await completeFirstRun(page)

  for (const name of Object.values(ACTIONS)) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  }

  const template = await download(page, ACTIONS.template)
  expect(template.suggestedFilename()).toBe('plantilla-desempenos.xlsx')
  const templatePath = await template.path()
  expect(templatePath).toBeTruthy()
  expect((await fs.stat(templatePath)).size).toBeGreaterThan(0)

  const sample = await download(page, ACTIONS.sample)
  expect(sample.suggestedFilename()).toBe('ejemplo-desempenos.xlsx')
  const samplePath = await sample.path()
  expect(samplePath).toBeTruthy()
  expect((await fs.stat(samplePath)).size).toBeGreaterThan(0)
})

test('a pending matrix survives reload, fills the first report and never overwrites text', async ({
  page,
}) => {
  await completeFirstRun(page)

  const sample = await download(page, ACTIONS.sample)
  const samplePath = await sample.path()
  const matrix = await readMatrix(samplePath)
  const expectedAlto = matrix['Matemáticas'].Alto
  expect(Object.keys(matrix)).toEqual([
    'Matemáticas',
    'Ciencias Naturales',
    'Lengua',
    'Sociales',
  ])
  expect(expectedAlto.length).toBeGreaterThan(0)

  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles(samplePath)
  await expect(page.getByText(PENDING_TOAST, { exact: true })).toBeVisible()

  // Pending payload is kept in sessionStorage, so a reload before the first
  // report does not lose the uploaded matrix.
  await expect
    .poll(async () =>
      page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix')),
    )
    .not.toBeNull()
  await page.reload()
  await waitForHydrated(page)

  await expect(page.getByRole('button', { name: ACTIONS.load, exact: true })).toBeVisible()
  const pending = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('informes.pendingMatrix')),
  )
  expect(pending['Matemáticas'].Alto).toBe(expectedAlto)

  // First report, created by hand: grade, teacher, subject, student, score.
  await page.getByRole('button', { name: 'Crear manualmente', exact: true }).click()
  await page.getByPlaceholder('5° A').fill('5° A')
  await page.getByPlaceholder('Prof. Rivera').fill('Prof. Rivera')
  await page.locator('tbody tr').first().locator('input').first().fill('Ana')
  const scoreInput = page.locator('tbody tr').first().locator('input').nth(1)
  await scoreInput.fill('4.5')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Generar informe', exact: true }).click()

  // 4.5 falls in Alto: the sample text is pre-loaded automatically.
  await expect(page.getByText('Desempeños aplicados a Informe 1.', { exact: true })).toBeVisible()
  const mathBox = page.locator('tr', { hasText: 'Matemáticas' }).first().locator('textarea')
  await expect(mathBox).toHaveValue(expectedAlto)

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.['Matemáticas'] === expectedAlto,
  )

  // A teacher-written judgment survives later matrix payloads untouched.
  const ownText = 'Texto propio de la docente.'
  await mathBox.fill(ownText)
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.['Matemáticas'] === ownText,
  )

  await page.evaluate(() => {
    sessionStorage.setItem(
      'informes.pendingMatrix',
      JSON.stringify({
        'Matemáticas': {
          Bajo: 'NUEVO BAJO',
          'Básico': 'NUEVO BÁSICO',
          Alto: 'NUEVO ALTO',
          Superior: 'NUEVO SUPERIOR',
        },
      }),
    )
  })
  await page.reload()
  await waitForHydrated(page)

  await expect(page.getByText('Desempeños aplicados a Informe 1.', { exact: true })).toBeVisible()
  await expect(mathBox).toHaveValue(ownText)
})
