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

/**
 * Seeds sessionStorage through an init script so the app boots straight into
 * the given state: config + period reports (+ optional final annotations).
 */
export async function seed(page, { config, reports, selected = null, tab = 'period', finalPerformances }) {
  const state = {
    config: config ?? {
      institution: 'Colegio Ejemplo',
      period: '',
      scale: SCALE,
      logo: null,
    },
    reports,
    activeReport: reports[0]?.id ?? null,
    selected,
    tab,
    finalPerformances,
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
  }, state)
  await page.goto('/')
}

/** Completes the first-run setup modal so real-usage flows can proceed. */
export async function completeFirstRun(page, institution = 'Colegio de Prueba') {
  await page.goto('/')
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
