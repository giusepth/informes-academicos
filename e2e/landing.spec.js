import { expect, test } from '@playwright/test'
import { seed } from './helpers'

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

  test('navbar anchor "Qué hace" scrolls the features section into view', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' })).toBeVisible()

    await page.locator('a[href="#features"]').click()
    await expect(page.getByRole('heading', { level: 2, name: 'Qué hace, en concreto' })).toBeInViewport()
  })

  test('entering the tool persists for the tab: a reload skips the landing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
    await expect(page.getByText('Configuración inicial')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' })).toBeHidden()
    await expect(page.getByText('Configuración inicial')).toBeVisible()
  })

  test('a configured session goes straight to the tool, no landing', async ({ page }) => {
    await seed(page, { reports: [] })
    await expect(page.getByRole('heading', { level: 1, name: 'De la planilla de notas a los informes listos para imprimir.' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Configuración', exact: true })).toBeVisible()
  })
})
