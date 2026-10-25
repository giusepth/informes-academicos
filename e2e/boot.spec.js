import { expect, test } from '@playwright/test'
import { completeFirstRun } from './helpers'

test('first run shows the setup modal and creates the config', async ({ page }) => {
  await completeFirstRun(page)
  await expect(page.getByText('Importar Excel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descargar plantilla', exact: true })).toBeVisible()
})

test('UI copy states the no-server privacy promise (RNF-01)', async ({ page }) => {
  await completeFirstRun(page)
  await expect(
    page.getByText('Nada se sube a un servidor.'),
  ).toBeVisible()
  await expect(
    page.getByText('Genera y exporta informes 100% en tu navegador.'),
  ).toBeVisible()
  await expect(page.getByText(/Generá y exportá/)).toHaveCount(0)
})
