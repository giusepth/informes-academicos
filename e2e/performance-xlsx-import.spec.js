import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { completeFirstRun } from './helpers'

/**
 * Regression for the import routing: a single-sheet file is a normal report,
 * not a multi-period backup. With a matrix pending from the main menu, the
 * first imported report with grades must apply it right away instead of
 * taking the backup-restore path (which holds the pending payload).
 */

const PENDING_TOAST = 'Desempeños cargados: se aplicarán al primer informe que abras.'
const APPLIED_TOAST = 'Desempeños aplicados a Informe 1.'

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

/** Single report sheet: Ana has a grade and an empty desempeño cell. */
function singleReportBuffer() {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        'Estudiante',
        'Grado',
        'Docente',
        'Matemáticas',
        'Docente (Matemáticas)',
        'Desempeño (Matemáticas)',
      ],
      ['Ana', '5° A', 'Prof. Rivera', 4.5, 'Prof. Torres', ''],
    ]),
    'Informe 1',
  )
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

test('a pending matrix applies to a single-sheet import with grades', async ({ page }) => {
  await completeFirstRun(page)

  const sample = await download(page, 'Descargar ejemplo de desempeños')
  const samplePath = await sample.path()
  const matrix = await readMatrix(samplePath)

  await page.locator('input[aria-label="Archivo de desempeños"]').setInputFiles(samplePath)
  await expect(page.getByText(PENDING_TOAST, { exact: true })).toBeVisible()

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'informe.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: singleReportBuffer(),
  })

  // Normal report path, not a restore: the pending matrix applies at once.
  await expect(page.getByText(APPLIED_TOAST, { exact: true })).toBeVisible()
  await expect(page.getByText(/Backup restaurado/)).toHaveCount(0)
  await expect(
    page.locator('tr', { hasText: 'Matemáticas' }).first().locator('textarea'),
  ).toHaveValue(matrix['Matemáticas'].Alto)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('informes.pendingMatrix')))
    .toBeNull()
})
