import { expect, test } from '@playwright/test'
import { completeFirstRun, report, seed } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const reports = [1, 2].map((n) =>
  report({
    label: `Informe ${n}`,
    subjects: SUBJECTS,
    teachers: { 'Matemáticas': 'Prof. Torres' },
    students: [
      {
        name: 'Ana Gómez',
        scores: { 'Matemáticas': n + 3, 'Ciencias': 4.0 },
        performances: { 'Matemáticas': `Desempeño tipo ${n}` },
      },
      { name: 'Luis Pérez', scores: { 'Matemáticas': 3.5, 'Ciencias': null }, performances: {} },
    ],
  }),
)

test('full backup round trip: export, wipe session, import again', async ({ page }) => {
  await seed(page, { reports })

  // Stand-in for the real "next day": the teacher downloads the backup and
  // the session dies. The file is the transfer medium.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar backup (.xlsx)' }).click()
  const backupPath = await (await download).path()

  // "Next day" simulation: wipe the session ahead of every navigation.
  // Init scripts run in registration order, so this clear runs AFTER the
  // seeding script on the next goto, guaranteeing a day-1 state.
  await page.addInitScript(() => sessionStorage.clear())
  await page.goto('/')
  await completeFirstRun(page)
  await expect(page.getByText('Importar Excel (.xlsx)')).toBeVisible()

  const fileInput = page.locator('input[type=file]')
  await fileInput.setInputFiles(backupPath)

  // The whole multi-period session comes back in one shot.
  await expect(page.getByText('Backup restaurado: 2 informe(s) importados.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Informe 3 (final)' })).toBeVisible()

  // Data fidelity across periods and performanaces. Sheets render subject
  // rows for the selected student; her identity lives above the table.
  await page.getByRole('button', { name: 'Informe 2' }).click()
  await expect(
    page.locator('tr', { hasText: 'Matemáticas' }).first(),
  ).toContainText('Desempeño tipo 2')
})
