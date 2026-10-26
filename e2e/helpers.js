import fs from 'node:fs/promises'
import JSZip from 'jszip'
import { expect } from '@playwright/test'

/**
 * Default qualitative scale (mirrors DEFAULT_SCALE in calculations.js).
 * Kept literal on purpose: the E2E suite locks the persisted contract.
 */
export const SCALE = [
  { key: 'bajo', label: 'Bajo', min: 0.0, max: 2.9, tone: 'red' },
  { key: 'basico', label: 'Básico', min: 3.0, max: 3.9, tone: 'amber' },
  { key: 'alto', label: 'Alto', min: 4.0, max: 4.5, tone: 'blue' },
  { key: 'superior', label: 'Superior', min: 4.6, max: 5.0, tone: 'emerald' },
]

const DEFAULT_CONFIG = {
  institution: 'Colegio Ejemplo',
  period: '',
  scale: SCALE,
  logo: null,
}

export function report({ label, grade = '5° A', teacher = 'Prof. Rivera', subjects, teachers = {}, students }) {
  return {
    id: `r_${Math.random().toString(36).slice(2, 10)}`,
    grade,
    teacher,
    label,
    subjects,
    teachers,
    students: students.map((student) => ({
      id: `s_${Math.random().toString(36).slice(2, 10)}`,
      performances: {},
      ...student,
    })),
  }
}

export async function waitForHydrated(page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true')
}

export async function readDataKey(page, key) {
  return page.evaluate(async (dataKey) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('informes', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('kv')) {
          request.result.createObjectStore('kv')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB open blocked'))
    })

    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly')
        const request = tx.objectStore('kv').get(dataKey)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }, key)
}

/** Number of writer locks currently held for this origin. */
export async function heldWriterLocks(page) {
  return page.evaluate(async () => {
    const { held } = await navigator.locks.query()
    return held.filter((lock) => lock.name === 'informes.writer').length
  })
}

export async function waitForPersisted(
  page,
  key,
  predicate = (value) => value !== undefined,
  timeout = 10_000,
) {
  await expect
    .poll(async () => predicate(await readDataKey(page, key)), {
      timeout,
      message: `waiting for IndexedDB key ${key}`,
    })
    .toBe(true)
}

/**
 * Seeds report data in IndexedDB and view state in sessionStorage, then
 * reloads so the app hydrates from the persisted state. Promises are never
 * awaited inside an init script: the IDB write runs in the page context only
 * after `data-hydrated` is set.
 */
export async function seed(page, { config, reports, selected = null, tab = 'period', finalPerformances }) {
  const state = {
    config: config ?? DEFAULT_CONFIG,
    reports,
    finalPerformances: finalPerformances ?? {},
  }
  const view = {
    activeReport: reports[0]?.id ?? null,
    selected,
    tab,
  }

  await page.addInitScript((s) => {
    if (s.activeReport) sessionStorage.setItem('informes.activeReport', JSON.stringify(s.activeReport))
    if (s.selected) sessionStorage.setItem('informes.selected', JSON.stringify(s.selected))
    sessionStorage.setItem('informes.tab', JSON.stringify(s.tab))
  }, view)

  await page.goto('/')
  await waitForHydrated(page)

  await page.evaluate(async (seeded) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('informes', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('kv')) {
          request.result.createObjectStore('kv')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB open blocked'))
    })

    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite')
        const store = tx.objectStore('kv')
        store.put(seeded.config, 'informes.config')
        store.put(seeded.reports, 'informes.reports')
        store.put(seeded.finalPerformances, 'informes.finalPerformances')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }, state)

  await page.reload()
  await waitForHydrated(page)
}

/**
 * Seeds the pre-IndexedDB sessionStorage contract (all keys) so the migration
 * spec can boot an old-build session.
 */
export async function seedLegacy(page, {
  config,
  reports = [],
  selected = null,
  tab = 'period',
  finalPerformances,
  legacyReport,
} = {}) {
  const state = {
    config: config ?? DEFAULT_CONFIG,
    reports,
    activeReport: reports[0]?.id ?? null,
    selected,
    tab,
    finalPerformances,
    legacyReport,
  }

  await page.addInitScript((s) => {
    sessionStorage.setItem('informes.config', JSON.stringify(s.config))
    sessionStorage.setItem('informes.reports', JSON.stringify(s.reports))
    if (s.activeReport) sessionStorage.setItem('informes.activeReport', JSON.stringify(s.activeReport))
    if (s.selected) sessionStorage.setItem('informes.selected', JSON.stringify(s.selected))
    sessionStorage.setItem('informes.tab', JSON.stringify(s.tab))
    if (s.finalPerformances) {
      sessionStorage.setItem('informes.finalPerformances', JSON.stringify(s.finalPerformances))
    }
    if (s.legacyReport) sessionStorage.setItem('informes.report', JSON.stringify(s.legacyReport))
  }, state)

  await page.goto('/')
  await waitForHydrated(page)
}

export async function clearAllStorage(page) {
  await page.goto('/favicon.svg')
  await page.evaluate(() => new Promise((resolve, reject) => {
    sessionStorage.clear()
    const request = indexedDB.deleteDatabase('informes')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB deleteDatabase blocked'))
  }))
  await page.goto('/')
  await waitForHydrated(page)
}

/** Completes the first-run setup modal so real-usage flows can proceed.
 * From the landing (first visit) the CTA opens the tool, which then shows
 * the initial setup; already-entered tabs go straight to the modal. */
/** Opens #/gestion from the current report view. */
export async function openManagementMenu(page) {
  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
}

/** Opens the management menu and confirms the destructive clear dialog. */
export async function clearAllReports(page) {
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await page
    .getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()
}

export async function completeFirstRun(page, institution = 'Colegio de Prueba') {
  await page.goto('/')
  await waitForHydrated(page)
  const landingCta = page.getByRole('button', { name: 'Abrir la herramienta' })
  if (await landingCta.count()) {
    await landingCta.first().click()
  }
  await expect(page.getByRole('heading', { name: 'Configuración inicial' })).toBeVisible()
  await page.getByPlaceholder('Colegio Ejemplo').fill(institution)
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
}

/** Reads a downloaded .zip and returns { files, pdfName, pdfPages }. */
export async function readZipDownload(download) {
  const path = await download.path()
  const zip = await JSZip.loadAsync(await fs.readFile(path))
  const files = Object.keys(zip.files).filter((name) => !zip.files[name].dir)

  const pdfName = files.find((name) => name.endsWith('.pdf') && !name.includes('__MACOSX'))
  let pdfPages = null
  if (pdfName) {
    // jsPDF writes page objects uncompressed; counting "/Type /Page" objects
    // (excluding "/Pages") is a reliable page count proxy.
    const raw = await zip.files[pdfName].async('string')
    pdfPages = (raw.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
  }
  return { files, pdfName, pdfPages }
}
