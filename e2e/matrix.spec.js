import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { openManagementMenu, report, seed } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

function matrixBytes(aoa) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Desempeños')
  return XLSX.write(wb, { type: 'buffer' })
}

const MATRIX = matrixBytes([
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Matemáticas', 'Bajo.', 'Básico.', 'Alto.', 'Sup.'],
  ['Ciencias', 'BajoC.', 'BásicoC.', 'AltoC.', 'SupC.'],
])

const reports = [1, 2].map((n) =>
  report({
    label: `Informe ${n}`,
    subjects: SUBJECTS,
    teachers: { 'Matemáticas': 'Prof. Torres' },
    students: [
      {
        name: 'Ana',
        scores: { 'Matemáticas': 5, 'Ciencias': 4.0 },
        performances: { 'Matemáticas': 'Ya anotado.', 'Ciencias': '' },
      },
      { name: 'Luis', scores: { 'Matemáticas': n + 2.2, 'Ciencias': 2.0 }, performances: {} },
    ],
  }),
)

test('the matrix applies to the final report and never rewrites saved judgments', async ({ page }) => {
  await seed(page, {
    reports,
    tab: 'final',
    // Ana already has a final judgment saved for Matemáticas: must survive.
    finalPerformances: { ANA: { 'Matemáticas': 'Ya anotado final.' } },
  })

  await openManagementMenu(page)
  await page.locator('input[aria-label="Archivo de matriz del informe final"]').setInputFiles({
    name: 'matriz.xlsx',
    mimeType: 'application/octet-stream',
    buffer: MATRIX,
  })
  await page.getByRole('button', { name: 'Aplicar al informe final' }).click()

  await expect(page.getByText('Matriz aplicada al informe final (solo casilleros vacíos).')).toBeVisible()

  const box = (name) => page.locator('tr', { hasText: name }).first().locator('textarea')
  const select = (name) => page.getByRole('button', { name: name }).first()

  const aMath = box('Matemáticas')
  await expect(aMath).toHaveValue('Ya anotado final.')
  await expect(box('Ciencias')).toHaveValue('AltoC.')

  await select('Luis').click()
  // Final mean for Luis Matemáticas = mean(3.2, 3.4) = 3.3 → Básico.
  await expect(box('Matemáticas')).toHaveValue('Básico.')
  await expect(box('Ciencias')).toHaveValue('BajoC.')
})
