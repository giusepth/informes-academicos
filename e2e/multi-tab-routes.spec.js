import { expect, test } from '@playwright/test'
import {
  heldWriterLocks,
  openManagementMenu,
  report,
  seed,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const READ_ONLY_BANNER =
  'Solo lectura: otra pestaña está editando los informes. Esta pestaña se activará cuando esa pestaña se cierre.'

const MULTI_TAB_ADVISORY_TOAST =
  'Otra pestaña también está editando: revisa los cambios antes de seguir.'

const LANDING_HEADING =
  'De la planilla de notas a los informes listos para imprimir.'

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
    ],
  }),
]

const banner = (page) => page.getByRole('status').filter({ hasText: READ_ONLY_BANNER })

const landingHeading = (page) =>
  page.getByRole('heading', { level: 1, name: LANDING_HEADING })

const editPeriod = (page) => page.getByRole('button', { name: 'Editar período' })

test('contact first never takes the writer lock from the tool tab', async ({ context }) => {
  const setup = await context.newPage()
  await seed(setup, { reports })
  await setup.close()

  const contact = await context.newPage()
  await contact.goto('/#/contacto')
  await expect(contact.getByRole('heading', { level: 1, name: 'Escríbenos' })).toBeVisible()
  await expect.poll(() => heldWriterLocks(contact)).toBe(0)

  const tool = await context.newPage()
  await tool.goto('/')
  await waitForHydrated(tool)
  await expect(banner(tool)).toHaveCount(0)
  await openManagementMenu(tool)
  await expect(editPeriod(tool)).toBeEnabled()
  await expect.poll(() => heldWriterLocks(tool)).toBe(1)

  // Closing the contact tab must not affect the tool's lock.
  await contact.close()
  await expect(banner(tool)).toHaveCount(0)
  await expect(editPeriod(tool)).toBeEnabled()
  expect(await heldWriterLocks(tool)).toBe(1)

  await tool.close()
})

test('landing tabs acquire the lock only after entering the tool', async ({ page, context }) => {
  await page.goto('/')
  const second = await context.newPage()
  await second.goto('/')

  await expect(landingHeading(page)).toBeVisible()
  await expect(landingHeading(second)).toBeVisible()
  expect(await heldWriterLocks(page)).toBe(0)
  expect(await heldWriterLocks(second)).toBe(0)

  // Only tab B enters the tool: it becomes the writer.
  await second.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
  await expect(second.getByRole('heading', { name: 'Configuración inicial' })).toBeVisible()
  await expect.poll(() => heldWriterLocks(second)).toBe(1)

  // Tab A stays on the landing, with no read-only banner. The origin holds
  // exactly tab B's lock (Web Locks queries are origin-wide).
  await expect(landingHeading(page)).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
  expect(await heldWriterLocks(page)).toBe(1)

  // Closing the writer leaves the origin with zero locks while A is still on
  // the landing: that proves A never acquired one.
  await second.close()
  await expect(landingHeading(page)).toBeVisible()
  await expect.poll(() => heldWriterLocks(page)).toBe(0)

  await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
  await expect(page.getByRole('heading', { name: 'Configuración inicial' })).toBeVisible()
  await expect.poll(() => heldWriterLocks(page)).toBe(1)
})

test('without Web Locks both tabs edit and a remote change shows the advisory', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'locks', {
      configurable: true,
      get: () => undefined,
    })
  })

  await seed(page, { reports })
  const second = await context.newPage()
  await second.goto('/')
  await waitForHydrated(second)

  await openManagementMenu(page)
  await expect(editPeriod(page)).toBeEnabled()
  await expect(banner(page)).toHaveCount(0)
  await expect(banner(second)).toHaveCount(0)

  await editPeriod(page).click()
  await page.getByLabel('Desempeño de Ana en Matemáticas').fill('Cambio remoto sin bloqueo')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) =>
      value[0].students[0].performances?.['Matemáticas'] === 'Cambio remoto sin bloqueo',
  )

  // Both tabs stay editable; the only notice is the advisory toast.
  await expect(second.getByText(MULTI_TAB_ADVISORY_TOAST)).toBeVisible()
  await expect(banner(second)).toHaveCount(0)
  await openManagementMenu(second)
  await expect(editPeriod(second)).toBeEnabled()

  await second.close()
})
