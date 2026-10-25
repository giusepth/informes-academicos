import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { completeFirstRun, waitForHydrated, waitForPersisted } from './helpers'

/**
 * Issue #23: the main menu exposes the desempeño workbook actions and a
 * matrix loaded there waits (sessionStorage) for the first report. It is
 * applied once, only to empty cells, never overwrites written text and never
 * gets consumed before there are grades to band.
 */

const PENDING_TOAST = 'Desempeños cargados: se aplicarán al primer informe que abras.'
const APPLIED_TOAST = 'Desempeños aplicados a Informe 1.'
const RESTORE_TOAST = 'Backup restaurado: 2 informe(s) importados.'
const EMPTY_MATRIX_MESSAGE =
  'La plantilla no tiene textos de desempeño: completa las celdas antes de cargarla.'
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

const pendingRaw = (page) =>
  page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix'))

const holdRaw = (page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('informes.pendingHold')))

const mathBox = (page) =>
  page.locator('tr', { hasText: 'Matemáticas' }).first().locator('textarea')

async function createManualReport(page, { score } = {}) {
  await page.getByRole('button', { name: 'Crear manualmente', exact: true }).click()
  await page.getByPlaceholder('5° A').fill('5° A')
  await page.getByPlaceholder('Prof. Rivera').fill('Prof. Rivera')
  await page.locator('tbody tr').first().locator('input').first().fill('Ana')
  if (score !== undefined) {
    const scoreInput = page.locator('tbody tr').first().locator('input').nth(1)
    await scoreInput.fill(String(score))
    await page.keyboard.press('Enter')
  }
  await page.getByRole('button', { name: 'Generar informe', exact: true }).click()
}

/** Genuine backup (two report sheets): Ana has a grade and an empty cell. */
function backupBuffer() {
  const workbook = XLSX.utils.book_new()
  const sheet = (score) =>
    XLSX.utils.aoa_to_sheet([
      [
        'Estudiante',
        'Grado',
        'Docente',
        'Matemáticas',
        'Docente (Matemáticas)',
        'Desempeño (Matemáticas)',
      ],
      ['Ana', '5° A', 'Prof. Rivera', score, 'Prof. Torres', ''],
    ])
  XLSX.utils.book_append_sheet(workbook, sheet(4.5), 'Informe 1')
  XLSX.utils.book_append_sheet(workbook, sheet(4.0), 'Informe 2')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
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

test('loading the unedited template warns and arms no pending matrix', async ({ page }) => {
  await completeFirstRun(page)

  const template = await download(page, ACTIONS.template)
  const templatePath = await template.path()
  const workbook = XLSX.read(await fs.readFile(templatePath), { type: 'buffer' })
  expect(workbook.SheetNames).toEqual(['Desempeños', 'Instrucciones'])

  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles(templatePath)

  // All bands empty: the menu explains it instead of arming a payload.
  await expect(page.getByText(EMPTY_MATRIX_MESSAGE, { exact: true })).toBeVisible()
  await expect(page.getByText(PENDING_TOAST, { exact: true })).toHaveCount(0)
  await expect.poll(() => pendingRaw(page)).toBeNull()

  await createManualReport(page, { score: 4.5 })

  // Nothing pending: no applied toast, an empty cell, no placeholder text.
  await expect(mathBox(page)).toHaveValue('')
  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Describe aquí/i)).toHaveCount(0)
  await expect.poll(() => pendingRaw(page)).toBeNull()
})

test('a roster without grades does not consume the pending matrix', async ({ page }) => {
  await completeFirstRun(page)

  const sample = await download(page, ACTIONS.sample)
  const samplePath = await sample.path()
  const matrix = await readMatrix(samplePath)

  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles(samplePath)
  await expect(page.getByText(PENDING_TOAST, { exact: true })).toBeVisible()

  // Manual report with a student but no grade: nothing can be banded yet.
  await createManualReport(page)
  await expect(mathBox(page)).toHaveValue('')
  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toHaveCount(0)
  await expect.poll(() => pendingRaw(page)).not.toBeNull()

  // The score appears later: now the pending matrix applies exactly once.
  await page.getByRole('button', { name: 'Editar notas', exact: true }).click()
  await page.getByLabel('Nota de Matemáticas para Ana').fill('4.5')
  await page.keyboard.press('Enter')

  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toBeVisible()
  await expect(mathBox(page)).toHaveValue(matrix['Matemáticas'].Alto)
  await expect.poll(() => pendingRaw(page)).toBeNull()
})

test('restoring a backup keeps its summary and leaves the pending matrix waiting', async ({
  page,
}) => {
  await completeFirstRun(page)

  const sample = await download(page, ACTIONS.sample)
  const samplePath = await sample.path()
  const matrix = await readMatrix(samplePath)

  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles(samplePath)
  await expect(page.getByText(PENDING_TOAST, { exact: true })).toBeVisible()
  await expect.poll(() => pendingRaw(page)).not.toBeNull()

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'informes-backup.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: backupBuffer(),
  })

  // The restore summary wins: no applied toast and the cell stays empty.
  await expect(page.getByText(RESTORE_TOAST, { exact: true })).toBeVisible()
  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toHaveCount(0)
  await expect(mathBox(page)).toHaveValue('')
  await expect.poll(() => pendingRaw(page)).not.toBeNull()
  await expect.poll(() => holdRaw(page)).toBe('restored')

  // A later score edit releases the hold: the matrix applies then.
  await page.getByRole('button', { name: 'Editar notas', exact: true }).click()
  await page.getByLabel('Nota de Matemáticas para Ana').fill('4.6')
  await page.keyboard.press('Enter')

  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toBeVisible()
  await expect(mathBox(page)).toHaveValue(matrix['Matemáticas'].Superior)
  await expect.poll(() => holdRaw(page)).toBeNull()
})

test('a restored backup keeps the hold across reload until a score edit', async ({ page }) => {
  await completeFirstRun(page)

  const sample = await download(page, ACTIONS.sample)
  const samplePath = await sample.path()
  const matrix = await readMatrix(samplePath)

  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles(samplePath)
  await expect(page.getByText(PENDING_TOAST, { exact: true })).toBeVisible()

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'informes-backup.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: backupBuffer(),
  })
  await expect(page.getByText(RESTORE_TOAST, { exact: true })).toBeVisible()
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)

  // The hold is part of the tab session, not only an in-memory ref.
  await expect.poll(() => holdRaw(page)).toBe('restored')
  await page.reload()
  await waitForHydrated(page)

  // Nothing applies by itself: no toast, empty cell, pending payload intact.
  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toHaveCount(0)
  await expect(mathBox(page)).toHaveValue('')
  await expect.poll(() => pendingRaw(page)).not.toBeNull()
  await expect.poll(() => holdRaw(page)).toBe('restored')

  // Scoring releases the hold and the matrix fills the empty cell.
  await page.getByRole('button', { name: 'Editar notas', exact: true }).click()
  await page.getByLabel('Nota de Matemáticas para Ana').fill('4.6')
  await page.keyboard.press('Enter')

  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toBeVisible()
  await expect(mathBox(page)).toHaveValue(matrix['Matemáticas'].Superior)
  await expect.poll(() => pendingRaw(page)).toBeNull()
  await expect.poll(() => holdRaw(page)).toBeNull()
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
  await expect.poll(() => pendingRaw(page)).not.toBeNull()
  await page.reload()
  await waitForHydrated(page)

  await expect(page.getByRole('button', { name: ACTIONS.load, exact: true })).toBeVisible()
  const pending = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('informes.pendingMatrix')),
  )
  expect(pending['Matemáticas'].Alto).toBe(expectedAlto)

  // First report, created by hand: grade, teacher, subject, student, score.
  await createManualReport(page, { score: 4.5 })

  // 4.5 falls in Alto: the sample text is pre-loaded automatically.
  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toBeVisible()
  const box = mathBox(page)
  await expect(box).toHaveValue(expectedAlto)

  // The payload is consumed exactly once and cleared from sessionStorage.
  await expect.poll(() => pendingRaw(page)).toBeNull()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.['Matemáticas'] === expectedAlto,
  )

  // A reload without a pending payload shows no duplicate applied toast.
  await page.reload()
  await waitForHydrated(page)
  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toHaveCount(0)
  await expect(box).toHaveValue(expectedAlto)

  // A teacher-written judgment survives later matrix payloads untouched.
  const ownText = 'Texto propio de la docente.'
  await box.fill(ownText)
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.['Matemáticas'] === ownText,
  )

  // The only cell already has text: the new payload has nothing to fill, so it
  // stays pending instead of being consumed (and never overwrites).
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

  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toHaveCount(0)
  await expect(box).toHaveValue(ownText)
  await expect.poll(() => pendingRaw(page)).not.toBeNull()
})
