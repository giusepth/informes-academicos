import { expect, test } from '@playwright/test'
import { openManagementMenu, report, seed, waitForHydrated } from './helpers'

const BG = 'rgb(244, 248, 252)' // #f4f8fc
const BORDER = 'rgb(141, 164, 194)' // #8da4c2
const FOCUS = 'rgb(62, 111, 168)' // #3e6fa8
const HOVER = 'rgb(237, 244, 251)' // #edf4fb
const MUTED_BORDER = 'rgb(226, 232, 240)' // slate-200

const reports = [
  report({
    label: 'Informe 1',
    subjects: ['Matemáticas', 'Ciencias'],
    students: [{ name: 'Ana', scores: { 'Matemáticas': 4.5, 'Ciencias': 4.0 } }],
  }),
]

const openPeriodEditor = async (page) => {
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await expect(page.getByRole('heading', { name: 'Editar período' })).toBeVisible()
}

test('inputs and textareas use the editable form treatment', async ({ page }) => {
  await seed(page, { reports })
  await openPeriodEditor(page)

  for (const field of [
    page.getByLabel('Nombre de asignatura 1'),
    page.getByLabel('Nota de Ana en Matemáticas'),
    page.getByLabel('Desempeño de Ana en Matemáticas'),
  ]) {
    await expect(field).toHaveCSS('background-color', BG)
    await expect(field).toHaveCSS('border-top-color', BORDER)
  }
})

test('focus strengthens the border and shows the ring', async ({ page }) => {
  await seed(page, { reports })
  await openPeriodEditor(page)

  const input = page.getByLabel('Nota de Ana en Matemáticas')
  await input.focus()
  await expect(input).toHaveCSS('border-top-color', FOCUS)
  await expect(input).toHaveCSS('box-shadow', /62, 111, 168/)
})

test('hover changes the background without moving the field', async ({ page }) => {
  await seed(page, { reports })
  await openPeriodEditor(page)

  const input = page.getByLabel('Nota de Ana en Matemáticas')
  const before = await input.boundingBox()
  await input.hover()
  await expect(input).toHaveCSS('background-color', HOVER)
  const after = await input.boundingBox()
  expect(after).toEqual(before)
})

test('read-only editor fields keep the report surface', async ({ page, context }) => {
  await seed(page, { reports })
  const reader = await context.newPage()
  await reader.goto('/#/editor-final')
  await waitForHydrated(reader)

  const area = reader.getByLabel('Desempeño final de Ana en Matemáticas')
  await expect(area).toBeDisabled()
  await expect(area).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(area).toHaveCSS('border-top-color', MUTED_BORDER)
  await reader.close()
})

test('editor fields keep accessible names and no page overflow at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await seed(page, { reports })
  await openPeriodEditor(page)

  await expect(page.getByLabel('Nombre del estudiante 1')).toBeVisible()
  await expect(page.getByLabel('Nombre de asignatura 1')).toBeVisible()
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toBeVisible()

  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(await overflow()).toBeLessThanOrEqual(0)

  await page.goto('/#/editor-final')
  await expect(page.getByRole('heading', { name: 'Editar informe final' })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})

test('read-only period editor fields keep the paper surface on hover', async ({
  page,
  context,
}) => {
  await seed(page, { reports })
  const reader = await context.newPage()
  await reader.addInitScript((id) => {
    sessionStorage.setItem('informes.editor', JSON.stringify({ mode: 'edit', reportId: id }))
  }, reports[0].id)
  await reader.goto('/#/editor')
  await waitForHydrated(reader)

  await expect(reader.getByRole('heading', { name: 'Editar período' })).toBeVisible()
  const name = reader.getByLabel('Nombre del estudiante 1')
  await expect(name).toBeDisabled()
  await expect(name).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(name).toHaveCSS('border-top-color', MUTED_BORDER)

  await name.hover({ force: true })
  await expect(name).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await reader.close()
})

test('many subjects and students scroll inside the table without page overflow', async ({
  page,
}) => {
  const wide = [
    report({
      label: 'Informe ancho',
      subjects: [
        'Matemáticas',
        'Ciencias',
        'Sociales',
        'Inglés',
        'Arte',
        'Música',
        'Ética',
        'Religión',
      ],
      students: [
        { name: 'Ana María de los Ángeles', scores: {} },
        { name: 'Bruno', scores: {} },
        { name: 'Carla', scores: {} },
        { name: 'Damián', scores: {} },
        { name: 'Elena', scores: {} },
        { name: 'Facundo', scores: {} },
      ],
    }),
  ]
  await page.setViewportSize({ width: 360, height: 800 })
  await seed(page, { reports: wide })
  await openPeriodEditor(page)

  const overflow = () =>
    page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - window.innerWidth,
      body: document.body.scrollWidth - window.innerWidth,
    }))
  expect(await overflow()).toEqual({ doc: 0, body: 0 })

  await page.goto('/#/editor-final')
  await expect(page.getByRole('heading', { name: 'Editar informe final' })).toBeVisible()
  expect(await overflow()).toEqual({ doc: 0, body: 0 })
})

test('configuration fields share the editable treatment', async ({ page }) => {
  await page.goto('/')
  await waitForHydrated(page)
  await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
  await expect(page.getByRole('heading', { name: 'Configuración inicial' })).toBeVisible()

  const input = page.getByPlaceholder('Colegio Ejemplo')
  // The first-run modal autofocuses this field: blur it to read the resting state.
  await input.evaluate((el) => el.blur())
  await expect(input).toHaveCSS('background-color', BG)
  await expect(input).toHaveCSS('border-top-color', BORDER)
})
