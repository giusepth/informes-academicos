import { expect, test } from '@playwright/test'
import { report, seed } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

// Centesimal seed: Ana 95 (Superior), Luis 82 (Alto). Bands: 1-59 / 60-79 /
// 80-89 / 90-100 per DEFAULT_SCALES.centesimal; entered scores display
// verbatim (95, not 95.0).
const centesimalConfig = {
  institution: 'Colegio Centesimal',
  period: '',
  scaleType: 'centesimal',
  scale: [
    { key: 'bajo', label: 'Bajo', min: 1, max: 59, tone: 'red' },
    { key: 'basico', label: 'Básico', min: 60, max: 79, tone: 'amber' },
    { key: 'alto', label: 'Alto', min: 80, max: 89, tone: 'blue' },
    { key: 'superior', label: 'Superior', min: 90, max: 100, tone: 'emerald' },
  ],
  logo: null,
}

const centesimalReports = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    teachers: {},
    students: [
      { name: 'Ana', scores: { 'Matemáticas': 95, 'Ciencias': 90 } },
      { name: 'Luis', scores: { 'Matemáticas': 82, 'Ciencias': 63 } },
    ],
  }),
]

test('the setup flow asks for the scale and re-seeds the band ranges', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Configuración inicial' })).toBeVisible()

  // Choose the centesimal scale BEFORE saving: bands re-seed with 1–100
  // ranges so the teacher sees meaningful defaults.
  await page.getByRole('button', { name: 'Centesimal (1 a 100)' }).click()
  await expect(page.getByLabel('Máximo de Superior')).toHaveValue('100')

  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Centesimal')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()

  // Reopening the settings confirms the centesimal bands persisted.
  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await expect(page.getByLabel('Máximo de Superior')).toHaveValue('100')
  await expect(page.getByLabel('Mínimo de Bajo')).toHaveValue('1')
})

test('a centesimal session displays scores verbatim and bands per range', async ({ page }) => {
  await seed(page, { config: centesimalConfig, reports: centesimalReports })

  const matRow = page.locator('tr', { hasText: 'Matemáticas' }).first()
  await expect(matRow).toContainText('95') // verbatim, no forced decimal
  await expect(matRow).toContainText('Superior')

  // Ana's Ciencias (90) also lands in the 90–100 band; the subject row
  // carries entered scores back verbatim.
  const sciRow = page.locator('tr', { hasText: 'Ciencias' }).first()
  await expect(sciRow).toContainText('90')
  await expect(sciRow).toContainText('Superior')

  // Switch to Luis: 82 → Alto on the 80–89 band.
  await page.getByRole('button', { name: 'Luis' }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('82')
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('Alto')

  // The general average still shows two decimals for ranking justification.
  await expect(page.getByText('92.50')).toBeVisible()
})
