import { expect, test } from '@playwright/test'
import { report, seed } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']
const TEACHERS = { 'Matemáticas': 'Prof. Torres', 'Ciencias': 'Prof. Suárez' }

// Ana: Matemáticas = mean(4.5, 4.8, [null], 4.9) = 4.7333 → "4.73";
// Ciencias = mean(4.2, 4.4, 4.6, 4.8) = 4.5 → "4.50".
// Luis: Matemáticas = mean(3.2, 3.6, 3.4, 3.8) = 3.5 → "3.50".
const SCORES = {
  Ana: {
    'Informe 1': { 'Matemáticas': 4.5, 'Ciencias': 4.2 },
    'Informe 2': { 'Matemáticas': 4.8, 'Ciencias': 4.4 },
    'Informe 3': { 'Matemáticas': null, 'Ciencias': 4.6 },
    'Informe 4': { 'Matemáticas': 4.9, 'Ciencias': 4.8 },
  },
  Luis: {
    'Informe 1': { 'Matemáticas': 3.2, 'Ciencias': 2.9 },
    'Informe 2': { 'Matemáticas': 3.6, 'Ciencias': 2.9 },
    'Informe 3': { 'Matemáticas': 3.4, 'Ciencias': 2.95 },
    'Informe 4': { 'Matemáticas': 3.8, 'Ciencias': 3.0 },
  },
}

const reports = [1, 2, 3, 4].map((n) =>
  report({
    label: `Informe ${n}`,
    subjects: SUBJECTS,
    teachers: TEACHERS,
    students: Object.entries(SCORES).map(([name, perPeriod]) => ({
      name,
      scores: perPeriod[`Informe ${n}`],
    })),
  }),
)

test('the final report tab is auto-numbered after the loaded periods', async ({ page }) => {
  await seed(page, { reports })
  await expect(page.getByRole('button', { name: 'Informe 5 (final)' })).toBeVisible()
})

test('the final report averages per subject across periods', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })

  // The sheet renders twice by design (on-screen + off-screen capture mirror
  // for PDF export), so headings/rows are matched against the first instance.
  await expect(
    page.getByText('Informe académico final', { exact: false }).first(),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 5 (final)' })).toHaveClass(/bg-slate-900/)

  const matRow = page.locator('tr', { hasText: 'Matemáticas' }).first()
  await expect(matRow).toContainText('4.73') // raw mean of the 3 present periods
  await expect(matRow).toContainText('Superior')
  await expect(matRow).toContainText('Docente: Prof. Torres')

  // The absent Matemáticas cell in Informe 3 renders as a dash, not a zero.
  await expect(page.locator('tr', { hasText: 'Ciencias' }).first()).toContainText('4.50')

  // Selected student keeps their identity on the final sheet (ranked first).
  await expect(page.getByText('Estudiante:', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Firma del Rector').first()).toBeVisible()
})

test('switching back to a period tab keeps the period layout intact', async ({ page }) => {
  await seed(page, { reports, tab: 'final' })
  await page.getByRole('button', { name: 'Informe 2' }).click()

  await expect(page.getByText('Informe académico', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Desempeño').first()).toBeVisible()
  // Period sheets are read-only: editing lives in the period editor.
  await expect(page.locator('textarea')).toHaveCount(0)
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.8')
})

test('final-sheet performances are read-only and editing moves to the final editor', async ({
  page,
}) => {
  await seed(page, { reports, tab: 'final' })

  // Final annotations are no longer edited over the report: the sheet has no
  // fields, and the editor is the only place that mutates them (F5/R4).
  await expect(page.locator('textarea')).toHaveCount(0)

  await page.getByRole('button', { name: 'Editar desempeños finales' }).first().click()
  await expect(page).toHaveURL(/#\/editor-final$/)
  await expect(page.getByRole('heading', { name: 'Editar informe final' })).toBeVisible()
  await expect(page.getByLabel('Desempeño final de Ana en Matemáticas')).toBeVisible()
})
