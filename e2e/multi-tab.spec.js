import { expect, test } from '@playwright/test'
import { readDataKey, report, seed, waitForHydrated, waitForPersisted } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

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

const createBlankPeriodInSecondTab = async (context) => {
  const second = await openTool(context)
  await second.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()
  await expect(second.getByRole('button', { name: 'Informe 2', exact: true })).toBeVisible()
  await waitForPersisted(
    second,
    'informes.reports',
    (value) => Array.isArray(value) && value.length === 2,
  )
  return second
}

test('a period created in a second tab converges into the already-open tab', async ({ page, context }) => {
  await seed(page, { reports })
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()

  const second = await createBlankPeriodInSecondTab(context)

  // No reload: the BroadcastChannel message makes the first tab re-read the
  // three IndexedDB keys and render the new period.
  await expect(page.getByRole('button', { name: 'Informe 2', exact: true })).toBeVisible()
  await second.close()
})

test('an edit from the first tab after convergence keeps both reports', async ({ page, context }) => {
  await seed(page, { reports })
  const second = await createBlankPeriodInSecondTab(context)

  // The first tab was stale when Informe 2 appeared; after converging it
  // edits its own report. The persisted array must still hold both periods.
  await expect(page.getByRole('button', { name: 'Informe 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await page
    .locator('tr', { hasText: 'Matemáticas' })
    .first()
    .locator('textarea')
    .fill('Editado en la pestaña abierta')

  await waitForPersisted(
    page,
    'informes.reports',
    (value) =>
      Array.isArray(value) &&
      value.length === 2 &&
      value[0].students.some(
        (student) => student.performances?.['Matemáticas'] === 'Editado en la pestaña abierta',
      ),
  )

  const stored = await readDataKey(page, 'informes.reports')
  expect(stored).toHaveLength(2)
  expect(stored.map((entry) => entry.label)).toEqual(['Informe 1', 'Informe 2'])
  await second.close()
})
