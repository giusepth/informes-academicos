import { expect, test } from '@playwright/test'
import {
  heldWriterLocks,
  openManagementMenu,
  readDataKey,
  report,
  seed,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const READ_ONLY_BANNER =
  'Solo lectura: otra pestaña está editando los informes. Esta pestaña se activará cuando esa pestaña se cierre.'

const reports = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [
      {
        name: 'Ana',
        scores: { 'Matemáticas': 4.5, 'Ciencias': 4.2 },
        performances: { 'Matemáticas': 'Inicial' },
      },
      { name: 'Luis', scores: { 'Matemáticas': 3.5, 'Ciencias': 3.8 }, performances: {} },
    ],
  }),
]

const openTool = async (context) => {
  const page = await context.newPage()
  await page.goto('/')
  await waitForHydrated(page)
  return page
}

const banner = (page) => page.getByRole('status').filter({ hasText: READ_ONLY_BANNER })

const editPeriod = (page) => page.getByRole('button', { name: 'Editar período' })

test('the first tab is always the writer and shows no banner', async ({ page }) => {
  await seed(page, { reports })

  await expect(banner(page)).toHaveCount(0)
  await openManagementMenu(page)
  await expect(editPeriod(page)).toBeEnabled()
})

test('a second tab opens read-only with a banner and no editing affordances', async ({
  page,
  context,
}) => {
  await seed(page, { reports })
  const second = await openTool(context)

  await expect(banner(second)).toBeVisible()
  await expect(second.locator('input[aria-label^="Nota de"]')).toHaveCount(0)
  await expect(second.locator('.report-sheet textarea')).toHaveCount(0)

  // Exports and read-only navigation stay available.
  await expect(second.getByRole('button', { name: 'Imprimir' })).toBeEnabled()
  await expect(second.getByRole('button', { name: 'Vista previa' })).toBeEnabled()
  await expect(second.getByRole('button', { name: 'Generar ZIP (todos)' })).toBeEnabled()
  await expect(second.getByRole('button', { name: 'Informe 1', exact: true })).toBeEnabled()

  // Mutation actions live in the menu; there they stay disabled for a reader.
  await openManagementMenu(second)
  await expect(editPeriod(second)).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Nuevo periodo en blanco' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Elegir archivo' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Crear manualmente' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Editar desempeños finales' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Limpiar informes' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Exportar backup (.xlsx)' })).toBeEnabled()

  // The writer keeps editing and never sees the banner.
  await expect(banner(page)).toHaveCount(0)
  await second.close()
})

test('keyboard and scripted edits are rejected in the read-only tab', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()

  const idbBefore = await readDataKey(second, 'informes.reports')
  await openManagementMenu(second)
  await expect(editPeriod(second)).toBeDisabled()

  // No editable field exists anywhere in the reader, so a stray keystroke
  // cannot produce a queued write.
  await expect(second.locator('input:not([type="file"]), textarea')).toHaveCount(0)
  await second.keyboard.type('INTENTO')
  await second.waitForTimeout(250)
  expect(await readDataKey(second, 'informes.reports')).toEqual(idbBefore)

  const stored = await readDataKey(second, 'informes.reports')
  expect(stored).toHaveLength(1)
  expect(stored[0].students[0].performances).toEqual({ 'Matemáticas': 'Inicial' })
  await second.close()
})

test('clearing reports drops session copies in another tab', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()
  await second.evaluate(() =>
    sessionStorage.setItem(
      'informes.finalPerformances',
      JSON.stringify({ ANA: { 'Matemáticas': 'Final ajeno.' } }),
    ),
  )

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await page
    .getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()

  await expect
    .poll(() => second.evaluate(() => sessionStorage.getItem('informes.finalPerformances')))
    .toBeNull()
  await expect(second.getByRole('button', { name: 'Informe 1', exact: true })).toHaveCount(0)
})

test('closing the writer promotes the read-only tab with fresh data', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()

  // The writer edits right before closing: promotion must re-read IndexedDB,
  // not keep the stale snapshot the reader hydrated with.
  await openManagementMenu(page)
  await editPeriod(page).click()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('4.7')
  await page.getByLabel('Desempeño de Ana en Matemáticas').fill('Editado en la pestaña A')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) =>
      value[0].students[0].performances?.['Matemáticas'] === 'Editado en la pestaña A',
  )

  await page.close()

  await expect(banner(second)).toHaveCount(0, { timeout: 3000 })
  await openManagementMenu(second)
  await expect(editPeriod(second)).toBeEnabled()
  await editPeriod(second).click()
  await expect(second.getByLabel('Desempeño de Ana en Matemáticas')).toHaveValue(
    'Editado en la pestaña A',
  )
  await expect(second.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('4.7')

  // Editing is fully available after promotion.
  await second.getByLabel('Nota de Ana en Matemáticas').fill('4.8')
  await second.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    second,
    'informes.reports',
    (value) => value[0].students[0].scores?.['Matemáticas'] === 4.8,
  )

  await second.close()
})

test('promotion remounts the final editor with fresh annotations', async ({ page, context }) => {
  await seed(page, { reports, tab: 'final' })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()
  await second.goto('/#/final')

  // The reader opens the final editor and sees a disabled draft.
  await second.getByRole('button', { name: 'Editar desempeños finales' }).first().click()
  await expect(second.getByLabel('Desempeño final de Ana en Matemáticas')).toBeDisabled()

  // The writer saves an annotation right before closing.
  await page.getByRole('button', { name: 'Editar desempeños finales' }).first().click()
  await page.getByLabel('Desempeño final de Ana en Matemáticas').fill('Anotación nueva')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.finalPerformances',
    (value) => value?.ANA?.['Matemáticas'] === 'Anotación nueva',
  )

  await page.close()

  // Promotion re-reads IndexedDB and remounts the draft with the new value.
  await expect(banner(second)).toHaveCount(0, { timeout: 3000 })
  await expect(second.getByLabel('Desempeño final de Ana en Matemáticas')).toHaveValue(
    'Anotación nueva',
  )
  await expect(second.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()

  await second.close()
})

test('promotion re-reads IndexedDB even without BroadcastChannel', async ({ page, context }) => {
  await seed(page, { reports })

  const second = await context.newPage()
  await second.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', {
      configurable: true,
      value: undefined,
    })
  })
  await second.goto('/')
  await waitForHydrated(second)
  await expect(banner(second)).toBeVisible()

  await openManagementMenu(page)
  await editPeriod(page).click()
  await page.getByLabel('Desempeño de Ana en Matemáticas').fill('Editado sin canal')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value[0].students[0].performances?.['Matemáticas'] === 'Editado sin canal',
  )

  await page.close()

  // No channel announcement can reach the reader: only promotion's own
  // re-read can bring the writer's fresh value into this tab.
  await expect(banner(second)).toHaveCount(0, { timeout: 3000 })
  await openManagementMenu(second)
  await editPeriod(second).click()
  await expect(second.getByLabel('Desempeño de Ana en Matemáticas')).toHaveValue(
    'Editado sin canal',
  )

  await second.close()
})

test('exactly one writer: a third tab stays read-only until the promoted tab closes', async ({
  page,
  context,
}) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()
  expect(await heldWriterLocks(page)).toBe(1)

  await page.close()
  await expect(banner(second)).toHaveCount(0, { timeout: 3000 })
  expect(await heldWriterLocks(second)).toBe(1)

  const third = await openTool(context)
  await expect(banner(third)).toBeVisible()
  await openManagementMenu(third)
  await expect(editPeriod(third)).toBeDisabled()
  await expect(banner(second)).toHaveCount(0)
  expect(await heldWriterLocks(third)).toBe(1)

  await second.close()
  await expect(banner(third)).toHaveCount(0, { timeout: 3000 })
  await expect(editPeriod(third)).toBeEnabled()
  expect(await heldWriterLocks(third)).toBe(1)

  await third.close()
})

test('a read-only tab can still export the backup', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()

  await openManagementMenu(second)
  const downloadPromise = second.waitForEvent('download')
  await second.getByRole('button', { name: 'Exportar backup (.xlsx)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^informes-backup-\d{4}-\d{2}-\d{2}\.xlsx$/)

  await second.close()
})
