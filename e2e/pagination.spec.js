import { expect, test } from '@playwright/test'
import { readZipDownload, report, seed } from './helpers'

const LONG_TEXT = 'El estudiante demuestra una comprensión sólida, participa con constancia '
  + 'en clase y sostiene el criterio a lo largo del periodo. Se recomienda '
  + 'continuar profundizando la lectura y los ejercicios de aplicación diaria '
  + 'para consolidar el avance. '.repeat(4)

const SUBJECTS = Array.from({ length: 16 }, (_, i) => `Asignatura ${i + 1}`)

const students = [
  { name: 'Ana Gómez' },
  { name: 'Luis Pérez' },
].map((student) => {
  const scores = {}
  const performances = {}
  for (const subject of SUBJECTS) {
    scores[subject] = 4.5
    performances[subject] = LONG_TEXT
  }
  return { ...student, scores, performances }
})

const oversized = report({ label: 'Informe 1', subjects: SUBJECTS, students })

test('paginated export: a tall sheet produces multiple A4 PDF pages', async ({ page }) => {
  await seed(page, { reports: [oversized] })

  // The on-screen sheet must be taller than one A4 page (794px wide sheet ->
  // A4 height ≈ 1123px at print scale). If this fails, pagination cannot
  // even start.
  const sheetHeight = await page.evaluate(
    () => document.querySelector('.report-sheet')?.getBoundingClientRect().height ?? 0,
  )
  expect(sheetHeight, 'sheet should exceed one A4 page').toBeGreaterThan(1123)

  // Export ZIP and inspect the first PDF's real page count.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Generar ZIP (todos)' }).click()
  await expect(
    page.getByText(/ZIP generado con \d+ informes./),
  ).toBeVisible({ timeout: 30_000 })

  const { files, pdfName, pdfPages } = await readZipDownload(await downloadPromise)
  expect(files.length).toBeGreaterThan(0)
  expect(pdfName).toBeTruthy()
  expect(pdfPages, `${pdfName} should span multiple A4 pages`).toBeGreaterThan(1)
})
