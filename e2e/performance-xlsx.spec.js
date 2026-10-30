import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { completeFirstRun } from './helpers'

/**
 * Desempeño-matrix downloads from the management menu. Loading a matrix now
 * lives inside each editor: the period editor for a period (F4.1) and
 * #/editor-final for the final report (F5).
 */

const ACTIONS = {
  load: 'Cargar desempeños del próximo período (.xlsx)',
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

test('the main menu offers the next-period matrix actions and both downloads', async ({ page }) => {
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
