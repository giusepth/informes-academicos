import { expect, test } from '@playwright/test'
import { openManagementMenu, report, seed } from './helpers'

/**
 * Interaction contract (remodel spec §6): every control reacts. This pins the
 * primary CTA hover swap to the triplicado palette so a future restyle cannot
 * silently ship a button with no reaction.
 */

const FORM_BLUE_LIFT = 'rgb(79, 123, 180)' // #4f7bb4

const reports = [
  report({
    label: 'Informe 1',
    subjects: ['Matemáticas'],
    students: [{ name: 'Ana', scores: { 'Matemáticas': 4.5 } }],
  }),
]

test('primary buttons react on hover with the form-blue lift', async ({ page }) => {
  await seed(page, { reports })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await expect(page.getByRole('heading', { name: 'Editar período' })).toBeVisible()

  const save = page.getByRole('button', { name: 'Guardar cambios' })
  await expect(save).toHaveCSS('transition-duration', '0.15s')
  await save.hover()
  await expect(save).toHaveCSS('background-color', FORM_BLUE_LIFT)
})
