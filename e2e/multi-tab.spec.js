import { expect, test } from '@playwright/test'
import {
  heldWriterLocks,
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

const mathPerformance = (page) =>
  page.locator('tr', { hasText: 'Matemáticas' }).first().locator('textarea')

test('the first tab is always the writer and shows no banner', async ({ page }) => {
  await seed(page, { reports })

  await expect(page.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
})

test('a second tab opens read-only with a banner and no editing affordances', async ({
  page,
  context,
}) => {
  await seed(page, { reports })
  const second = await openTool(context)

  await expect(banner(second)).toBeVisible()
  await expect(second.getByRole('button', { name: 'Editar notas' })).toHaveCount(0)
  await expect(second.locator('input[aria-label^="Nota de"]')).toHaveCount(0)
  await expect(second.getByRole('button', { name: 'Nuevo periodo en blanco' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Importar Excel (periodo)' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Cargar desempeños (excel)' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Nuevo informe' })).toBeDisabled()

  const performances = second.locator('.report-sheet textarea')
  await expect(performances.first()).toBeVisible()
  await expect(performances.first()).toHaveAttribute('readonly', '')
  await expect(performances.first()).not.toBeEditable()

  // Exports and read-only navigation stay available.
  await expect(second.getByRole('button', { name: 'Imprimir' })).toBeEnabled()
  await expect(second.getByRole('button', { name: 'Vista previa' })).toBeEnabled()
  await expect(second.getByRole('button', { name: 'Generar ZIP (todos)' })).toBeEnabled()
  await expect(second.getByRole('button', { name: 'Exportar backup (.xlsx)' })).toBeEnabled()
  await expect(second.getByRole('button', { name: 'Informe 1', exact: true })).toBeEnabled()

  // The writer keeps editing and never sees the banner.
  await expect(banner(page)).toHaveCount(0)
  await second.close()
})

test('keyboard and scripted edits are rejected in the read-only tab', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()

  const textarea = mathPerformance(second)
  await expect(textarea).toHaveAttribute('readonly', '')
  const before = await textarea.inputValue()
  const idbBefore = await readDataKey(second, 'informes.reports')
  await textarea.click()
  await second.keyboard.type('INTENTO')
  expect(await textarea.inputValue()).toBe(before)
  // Let any accidental queued write settle before comparing the committed
  // snapshot: a read-only tab must produce no new write at all.
  await second.waitForTimeout(250)
  expect(await readDataKey(second, 'informes.reports')).toEqual(idbBefore)

  await second.evaluate(() => {
    const target = document.querySelector('.report-sheet textarea')
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    ).set
    setter.call(target, 'Intento por JS')
    target.dispatchEvent(new Event('input', { bubbles: true }))
  })

  await waitForPersisted(
    second,
    'informes.reports',
    (value) => value[0].students[0].performances?.['Matemáticas'] === 'Inicial',
  )

  const stored = await readDataKey(second, 'informes.reports')
  expect(stored).toHaveLength(1)
  expect(stored[0].students[0].performances).toEqual({ 'Matemáticas': 'Inicial' })
  await second.close()
})

test('closing the writer promotes the read-only tab with fresh data', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()

  // The writer edits right before closing: promotion must re-read IndexedDB,
  // not keep the stale snapshot the reader hydrated with.
  await mathPerformance(page).fill('Editado en la pestaña A')
  await waitForPersisted(
    page,
    'informes.reports',
    (value) =>
      value[0].students[0].performances?.['Matemáticas'] === 'Editado en la pestaña A',
  )

  await page.close()

  await expect(banner(second)).toHaveCount(0, { timeout: 3000 })
  await expect(second.getByRole('button', { name: 'Editar notas' })).toBeVisible()

  const promoted = mathPerformance(second)
  await expect(promoted).toHaveValue('Editado en la pestaña A')
  await expect(promoted).not.toHaveAttribute('readonly', '')

  // Editing is fully available after promotion.
  await second.getByRole('button', { name: 'Editar notas' }).click()
  const scoreInput = second.locator('input[aria-label="Nota de Matemáticas para Ana"]')
  await expect(scoreInput).toBeVisible()
  await scoreInput.fill('4.7')
  await second.keyboard.press('Enter')
  await waitForPersisted(
    second,
    'informes.reports',
    (value) => value[0].students[0].scores?.['Matemáticas'] === 4.7,
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
  await expect(third.getByRole('button', { name: 'Editar notas' })).toHaveCount(0)
  await expect(banner(second)).toHaveCount(0)
  expect(await heldWriterLocks(third)).toBe(1)

  await second.close()
  await expect(banner(third)).toHaveCount(0, { timeout: 3000 })
  await expect(third.getByRole('button', { name: 'Editar notas' })).toBeVisible()
  expect(await heldWriterLocks(third)).toBe(1)

  await third.close()
})

test('a read-only tab can still export the backup', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await openTool(context)
  await expect(banner(second)).toBeVisible()

  const downloadPromise = second.waitForEvent('download')
  await second.getByRole('button', { name: 'Exportar backup (.xlsx)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^informes-backup-\d{4}-\d{2}-\d{2}\.xlsx$/)

  await second.close()
})
