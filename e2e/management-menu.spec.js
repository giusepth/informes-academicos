import { expect, test } from '@playwright/test'
import { report, seed } from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const reports = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [
      {
        name: 'Ana',
        scores: { 'Matemáticas': 4.5, 'Ciencias': 3.8 },
        performances: {},
      },
    ],
  }),
]

const openMenu = async (page) => {
  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
}

test('the management menu groups every action in the four semantic sections', async ({
  page,
}) => {
  await seed(page, { reports })
  await openMenu(page)

  const newWork = page.getByRole('region', { name: 'Nuevo trabajo' })
  const current = page.getByRole('region', { name: 'Trabajo actual' })
  const performances = page.getByRole('region', { name: 'Desempeños' })
  const backup = page.getByRole('region', { name: 'Respaldo y datos' })

  await expect(newWork).toBeVisible()
  await expect(current).toBeVisible()
  await expect(performances).toBeVisible()
  await expect(backup).toBeVisible()

  // Actions are grouped where the SDD says, not in one flat row.
  await expect(newWork.getByRole('button', { name: 'Crear manualmente' })).toBeVisible()
  await expect(newWork.getByRole('button', { name: 'Elegir archivo' })).toBeVisible()
  await expect(newWork.getByRole('button', { name: 'Nuevo periodo en blanco' })).toBeVisible()

  await expect(current.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()
  await expect(current.getByRole('button', { name: 'Informe 2 (final)' })).toBeVisible()
  await expect(current.getByRole('button', { name: 'Abrir boletín' })).toBeVisible()
  await expect(current.getByRole('button', { name: 'Editar período' })).toBeVisible()
  await expect(
    current.getByRole('button', { name: 'Editar desempeños finales' }),
  ).toBeVisible()
  await expect(current).toContainText('Estado del período activo')

  await expect(
    performances.getByRole('button', { name: 'Cargar matriz del informe final (excel)' }),
  ).toHaveCount(0)
  await expect(
    performances.getByRole('button', { name: 'Descargar plantilla de desempeños' }),
  ).toBeVisible()
  await expect(
    performances.getByRole('button', { name: 'Descargar ejemplo de desempeños' }),
  ).toBeVisible()

  await expect(backup.getByRole('button', { name: 'Exportar backup (.xlsx)' })).toBeVisible()
  await expect(backup.getByRole('button', { name: 'Limpiar informes' })).toBeVisible()
  // The destructive action is separated from the export, not in the header.
  await expect(page.locator('header').getByRole('button', { name: 'Limpiar informes' })).toHaveCount(0)
})

test('the menu keeps the section order as the logical tab order', async ({ page }) => {
  await seed(page, { reports })
  await openMenu(page)

  const headings = await page.locator('main h3').allTextContents()
  expect(headings).toEqual(['Nuevo trabajo', 'Trabajo actual', 'Desempeños', 'Respaldo y datos'])
})

test('editing the active period from the menu opens the period editor', async ({ page }) => {
  await seed(page, { reports })
  await openMenu(page)

  await page.getByRole('button', { name: 'Editar período' }).click()

  await expect(page).toHaveURL(/#\/editor$/)
  await expect(page.getByRole('heading', { name: 'Editar período' })).toBeVisible()
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toBeVisible()
})

test('editing the final report from the menu opens the final editor', async ({ page }) => {
  await seed(page, { reports })
  await openMenu(page)

  await page.getByRole('button', { name: 'Editar desempeños finales' }).click()

  await expect(page).toHaveURL(/#\/editor-final$/)
  await expect(page.getByRole('heading', { name: 'Editar informe final' })).toBeVisible()
  await expect(page.getByLabel('Desempeño final de Ana en Matemáticas')).toBeVisible()
})

test('the menu has no horizontal overflow on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await seed(page, { reports })
  await openMenu(page)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  for (const name of ['Nuevo trabajo', 'Trabajo actual', 'Desempeños', 'Respaldo y datos']) {
    await expect(page.getByRole('region', { name })).toBeVisible()
  }
})
