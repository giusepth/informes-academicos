import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { completeFirstRun, waitForHydrated } from './helpers'

/**
 * The menu exposes the shared matrix-file actions. Period matrices are loaded
 * inside each period editor (F4.1); this global payload is only for the final
 * report until F5 moves it to #/editor-final.
 */

const EMPTY_MATRIX_MESSAGE =
  'La plantilla no tiene textos de desempeño: completa las celdas antes de cargarla.'
const FINAL_TOAST = 'Matriz del informe final cargada. Aplícala cuando quieras.'
const ACTIONS = {
  load: 'Cargar matriz del informe final (excel)',
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

const pendingRaw = (page) =>
  page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix'))

const finalStatus = (page) =>
  page.locator('div[role="status"]').filter({ hasText: 'asignaturas detectadas' })

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

test('loading the unedited template warns and arms no final matrix', async ({ page }) => {
  await completeFirstRun(page)

  const template = await download(page, ACTIONS.template)
  const templatePath = await template.path()
  const workbook = XLSX.read(await fs.readFile(templatePath), { type: 'buffer' })
  expect(workbook.SheetNames).toEqual(['Desempeños', 'Instrucciones'])

  await page
    .locator('input[aria-label="Archivo de matriz del informe final"]')
    .setInputFiles(templatePath)

  await expect(page.getByText(EMPTY_MATRIX_MESSAGE, { exact: true })).toBeVisible()
  await expect(page.getByText(FINAL_TOAST, { exact: true })).toHaveCount(0)
  await expect.poll(() => pendingRaw(page)).toBeNull()
  await expect(finalStatus(page)).toHaveCount(0)
})

test('a final matrix stays staged across a reload and can be removed', async ({ page }) => {
  await completeFirstRun(page)

  const sample = await download(page, ACTIONS.sample)
  const samplePath = await sample.path()
  await page
    .locator('input[aria-label="Archivo de matriz del informe final"]')
    .setInputFiles(samplePath)

  await expect(page.getByText(FINAL_TOAST, { exact: true })).toBeVisible()
  await expect(finalStatus(page)).toContainText('asignaturas detectadas')
  expect(await pendingRaw(page)).not.toBeNull()

  await page.reload()
  await waitForHydrated(page)
  await expect(finalStatus(page)).toContainText('asignaturas detectadas')

  await page.getByRole('button', { name: 'Quitar matriz' }).click()
  await expect(finalStatus(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: ACTIONS.load, exact: true })).toBeVisible()
  await expect.poll(() => pendingRaw(page)).toBeNull()
})
