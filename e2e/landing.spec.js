import { expect, test } from '@playwright/test'
import { seed, waitForHydrated } from './helpers'

// The landing only faces first-time visitors: a fresh tab opens it, the CTA
// enters the tool, and a configured session never sees it.

test.describe('Landing', () => {
  test('fresh session sees the landing and the CTA opens the initial setup', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' })).toBeVisible()

    const open = page.getByRole('button', { name: 'Abrir la herramienta' })
    await expect(open).toHaveCount(3)

    await expect(page.getByText('Servicio de desarrollo a medida')).toBeVisible()
    await expect(page.getByRole('link', { name: 'giusepthrivera@gmail.com' })).toBeVisible()

    await open.first().click()
    await expect(page.getByText('Configuración inicial')).toBeVisible()
  })

  test('privacy copy reflects browser-persistent data', async ({ page }) => {
    await page.goto('/')
    const privacy = page.locator('#datos')
    await expect(privacy).toContainText(/se guardan? en este navegador/i)
    await expect(privacy).not.toContainText(/se borra|muere al cerrar/i)
  })

  test('navbar anchor "Qué hace" scrolls the features section into view', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' })).toBeVisible()

    await page.locator('a[href="#features"]').click()
    await expect(page.getByRole('heading', { level: 2, name: 'Qué hace, en concreto' })).toBeInViewport()
  })

  test('register stamp renders on the original sheet and the manual download link is offered', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-stamp]')).toBeAttached()
    await expect(page.locator('[data-stamp]')).toBeVisible()
    await expect(page.getByText('hecho para cierres de período sin sobresaltos.')).toBeVisible()
    await expect(page.locator('a[download][href="/manual-de-uso.md"]')).toBeVisible()
  })

  test('entering the tool persists for the tab: a reload skips the landing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
    await expect(page.getByText('Configuración inicial')).toBeVisible()

    await page.reload()
    await waitForHydrated(page)
    await expect(page.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' })).toBeHidden()
    await expect(page.getByText('Configuración inicial')).toBeVisible()
  })

  test('a configured session goes straight to the tool, no landing', async ({ page }) => {
    await seed(page, { reports: [] })
    await waitForHydrated(page)
    await expect(page.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Configuración', exact: true })).toBeVisible()
  })

  test('a new tab with IDB config skips the landing', async ({ page, context }) => {
    await seed(page, { reports: [] })

    const second = await context.newPage()
    await second.goto('/')
    await waitForHydrated(second)

    await expect(
      second.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' }),
    ).toBeHidden()
    await expect(second.getByRole('button', { name: 'Configuración', exact: true })).toBeVisible()
    await second.close()
  })
})

test('narrow phones: anchors clear the sticky navbar (360px)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const [label, id] of [['Cómo funciona', 'pasos'], ['Qué hace', 'features'], ['Datos', 'datos'], ['Para quién', 'quien']]) {
    await page.locator(`nav a[href="#${id}"]`).click()
    await expect(page.locator(`nav a[href="#${id}"]`)).toHaveAttribute('aria-current', 'location')
    const header = await page.locator('header').boundingBox()
    const section = await page.locator(`#${id}`).boundingBox()
    expect(section.y, `${label} heading hidden under navbar`).toBeGreaterThanOrEqual(header.y + header.height - 1)
  }
})

test('tablet: every anchor is visible, clickable and becomes active', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/')
  for (const id of ['pasos', 'features', 'datos', 'quien']) {
    const link = page.locator(`nav a[href="#${id}"]`)
    await expect(link).toBeInViewport()
    await link.click()
    await expect(link).toHaveAttribute('aria-current', 'location')
  }
})

test('last intersecting section wins the active underline at 1440x980', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 })
  await page.goto('/')
  await page.locator('nav a[href="#quien"]').click()
  await expect(page.locator('nav a[href="#quien"]')).toHaveAttribute('aria-current', 'location')
})

test('manual download serves the public asset', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('a[download][href="/manual-de-uso.md"]')).toBeVisible()
  const res = await request.get('/manual-de-uso.md')
  expect(res.ok()).toBeTruthy()
  const body = await res.text()
  expect(body).not.toMatch(/https?:\/\/|api[_-]?key|BEGIN [A-Z ]*PRIVATE/i)
})
