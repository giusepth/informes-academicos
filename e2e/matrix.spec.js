import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { report, seed } from './helpers'

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

test('the final matrix applies only to empty annotations and keeps saved judgments', async ({
  page,
}) => {
  await seed(page, {
    reports,
    tab: 'final',
    // Ana already has a final judgment saved for Matemáticas: must survive.
    finalPerformances: { ANA: { 'Matemáticas': 'Ya anotado final.' } },
  })

  await page.getByRole('button', { name: 'Editar desempeños finales' }).first().click()
  await page.locator('input[aria-label="Archivo de matriz del informe final"]').setInputFiles({
    name: 'matriz.xlsx',
    mimeType: 'application/octet-stream',
    buffer: MATRIX,
  })
  await page.getByRole('button', { name: 'Aplicar al informe final' }).click()

  await expect(page.getByText('Matriz aplicada: 3 casilleros completados.')).toBeVisible()

  const box = (name) => page.getByLabel(`Desempeño final de ${name}`)
  // Ana: Matemáticas keeps the teacher's text; Ciencias fills from the band.
  await expect(box('Ana en Matemáticas')).toHaveValue('Ya anotado final.')
  await expect(box('Ana en Ciencias')).toHaveValue('AltoC.')
  // Luis: final mean for Matemáticas = mean(3.2, 3.4) = 3.3 → Básico.
  await expect(box('Luis en Matemáticas')).toHaveValue('Básico.')
  await expect(box('Luis en Ciencias')).toHaveValue('BajoC.')

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page).toHaveURL(/#\/final$/)
  await expect(page.locator('tr', { hasText: 'Ciencias' }).first()).toContainText('AltoC.')
  await page.getByRole('button', { name: 'Luis' }).first().click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('Básico.')
  await expect(page.locator('tr', { hasText: 'Ciencias' }).first()).toContainText('BajoC.')
})
