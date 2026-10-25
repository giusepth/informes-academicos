import { expect, test } from '@playwright/test'

// The contact page lives behind the '#/contacto' hash route: reachable from
// the landing footer and directly by URL, regardless of the landing gate.

test.describe('Contacto', () => {
  test('the hash route opens the contact form directly', async ({ page }) => {
    await page.goto('/#/contacto')
    await expect(page.getByRole('heading', { level: 1, name: 'Escríbenos' })).toBeVisible()
    await expect(page.getByLabel('Nombre')).toBeVisible()
    await expect(page.getByLabel('Institución')).toBeVisible()
    await expect(page.getByLabel('Rol')).toBeVisible()
    await expect(page.getByLabel('Correo')).toBeVisible()
    await expect(page.getByLabel('Mensaje')).toBeVisible()
  })

  test('a valid submit composes the mailto and shows the success panel', async ({ page }) => {
    await page.goto('/#/contacto')
    await page.getByLabel('Nombre').fill('Ana García')
    await page.getByLabel('Rol').selectOption('Rector')
    await page.getByLabel('Correo').fill('ana@colegio.edu')
    await page.getByLabel('Mensaje').fill('Queremos el informe con firma digital.')
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()

    await expect(page.getByText('Se abrió tu correo')).toBeVisible()
    const href = await page.locator('#mailto-target').getAttribute('href')
    expect(href.startsWith('mailto:giusepthrivera@gmail.com?')).toBeTruthy()
    expect(href).toContain('Ana%20Garc%C3%ADa')
  })

  test('an empty submit lists the errors and never composes mail', async ({ page }) => {
    await page.goto('/#/contacto')
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()

    const summary = page.getByRole('alert')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('Nombre')
    await expect(page.getByText('Se abrió tu correo')).toBeHidden()
    await expect(page.locator('#mailto-target')).toHaveCount(0)
  })

  test('the landing footer links to the contact form', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'formulario de contacto' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Escríbenos' })).toBeVisible()
  })
})

test.describe('Contacto — audit regressions', () => {
  test('footer opens contact at the top on a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('link', { name: 'formulario de contacto' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Escríbenos' })).toBeInViewport()
    await expect(page).toHaveURL(/#\/contacto$/)
  })

  test('valid submit encodes the whole body, single-line headers only', async ({ page }) => {
    await page.goto('/#/contacto')
    await page.getByLabel('Nombre').fill('Ana & <b>')
    await page.getByLabel('Institución').fill('Colegio & Cía')
    await page.getByLabel('Rol').selectOption('Rector')
    await page.getByLabel('Correo').fill('ana@colegio.edu')
    await page.getByLabel('Mensaje').fill('Hola & adiós\nSegunda línea ?x=1 #frag')
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mensaje listo' })).toBeVisible()
    const href = await page.locator('#mailto-target').getAttribute('href')
    expect(href).toBeTruthy()
    expect(href).not.toMatch(/[\r\n]/)
    const query = href.split('?')[1]
    const params = Object.fromEntries(
      query.split('&').map((part) => {
        const [key, value] = part.split('=')
        return [key, decodeURIComponent(value)]
      }),
    )
    expect(params.subject).toBe('Contacto web — Ana & <b>')
    expect(params.body).toBe(
      ['Institución: Colegio & Cía', 'Rol: Rector', 'Correo: ana@colegio.edu', '', 'Hola & adiós', 'Segunda línea ?x=1 #frag'].join('\n'),
    )
    expect(href).toContain('%0A')
    expect(href).toContain('%26')
  })

  test('clipboard failure leaves the composed message selectable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => undefined })
    })
    await page.goto('/#/contacto')
    await page.getByLabel('Nombre').fill('Ana García')
    await page.getByLabel('Correo').fill('ana@colegio.edu')
    await page.getByLabel('Mensaje').fill('Queremos el informe con firma digital.')
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await page.getByRole('heading', { level: 1, name: 'Mensaje listo' }).waitFor()
    await page.getByRole('button', { name: 'Copiar mensaje' }).click()
    await expect(page.locator('[data-copy-fallback]')).toBeVisible()
    await expect(page.locator('[data-copy-fallback]')).toContainText('Queremos el informe con firma digital.')
  })
})
