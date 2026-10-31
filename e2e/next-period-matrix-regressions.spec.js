import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import {
  SCALE,
  clearAllStorage,
  completeFirstRun,
  openManagementMenu,
  readDataKey,
  report,
  seed,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const NEXT_KEY = 'informes.nextPeriodMatrix'

const workbookBytes = (aoa, sheet = 'Desempeños') => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheet)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const MATRIX = workbookBytes([
  ['Asignatura', 'Bajo', 'Básico', 'Alto', 'Superior'],
  ['Matemáticas', 'M-Bajo', 'M-Básico', 'M-Alto', 'M-Superior'],
  ['Ciencias', 'C-Bajo', 'C-Básico', 'C-Alto', 'C-Superior'],
])

const MATRIX_FILE = {
  name: 'matriz.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: MATRIX,
}

const sessionKey = (page) => page.evaluate((key) => sessionStorage.getItem(key), NEXT_KEY)

const pendingStatus = (root) =>
  root.getByRole('status').filter({ hasText: 'Matriz del próximo período' })

test('a malformed replacement keeps the loaded matrix', async ({ page }) => {
  await page.goto('/')
  await waitForHydrated(page)
  const section = page.getByRole('region', { name: 'Desempeños antes de empezar' })
  const input = section.getByLabel('Archivo de matriz del próximo período')
  await input.setInputFiles(MATRIX_FILE)
  await expect(pendingStatus(section)).toContainText('2 asignaturas detectadas')
  const before = await sessionKey(page)

  await input.setInputFiles({
    name: 'roto.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('not an xlsx'),
  })

  await expect(section.getByRole('alert')).toBeVisible()
  await expect(pendingStatus(section)).toContainText('2 asignaturas detectadas')
  expect(await sessionKey(page)).toBe(before)
})

test('a first period without grades consumes the matrix without filling', async ({ page }) => {
  await page.goto('/')
  await waitForHydrated(page)
  await page
    .locator('input[aria-label="Archivo de matriz del próximo período"]')
    .setInputFiles(MATRIX_FILE)
  await page.getByRole('button', { name: 'Abrir la herramienta' }).first().click()
  await page.getByPlaceholder('Colegio Ejemplo').fill('Colegio Sin Notas')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()

  await page.getByRole('button', { name: 'Crear manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Carga manual del período' })).toBeVisible()
  await page.getByLabel('Nombre del estudiante 1').fill('Ana')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Cargar manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await page.getByRole('button', { name: 'Crear período' }).click()

  await expect(page.getByText(/Matriz del próximo período consumida/)).toBeVisible()
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 1)
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances?.Matemáticas ?? '').toBe('')
  await expect.poll(() => sessionKey(page)).toBeNull()

  // A later period never receives the consumed preload.
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()
  await page.getByPlaceholder('Nombre del estudiante').first().fill('Luis')
  await page.getByLabel('Nota de Luis en Matemáticas').fill('4.5')
  await page.getByRole('button', { name: 'Crear período' }).click()
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)
  const after = await readDataKey(page, 'informes.reports')
  expect(after[1].students[0].performances?.Matemáticas ?? '').toBe('')
})

test('backup restore applies the preload only to the first restored report', async ({ page }) => {
  const reports = [1, 2].map((n) =>
    report({
      label: `Informe ${n}`,
      subjects: ['Matemáticas', 'Ciencias'],
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
  await seed(page, { reports })
  await openManagementMenu(page)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar backup (.xlsx)' }).click()
  const backupPath = await (await download).path()

  await clearAllStorage(page)
  await completeFirstRun(page)
  await page.getByLabel('Archivo de matriz del próximo período').setInputFiles(MATRIX_FILE)
  await expect(pendingStatus(page.getByRole('region', { name: 'Desempeños' }))).toContainText(
    '2 asignaturas detectadas',
  )

  await page
    .locator('section[aria-labelledby="menu-new-work"] input[type=file]')
    .setInputFiles(backupPath)
  await expect(page.getByText(/Backup restaurado: 2 informe\(s\) importados/)).toBeVisible()
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)

  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[0].students[0].performances).toEqual({
    'Matemáticas': 'Desempeño tipo 1',
    'Ciencias': 'C-Alto',
  })
  expect(stored[0].students[1].performances).toEqual({
    'Matemáticas': 'M-Básico',
    'Ciencias': '',
  })
  expect(stored[1].students[0].performances).toEqual({
    'Matemáticas': 'Desempeño tipo 2',
    'Ciencias': '',
  })
  await expect.poll(() => sessionKey(page)).toBeNull()
})

test('the read-only menu disables the preload but keeps the downloads', async ({
  page,
  context,
}) => {
  await completeFirstRun(page)
  const second = await context.newPage()
  await second.goto('/#/gestion')
  await waitForHydrated(second)
  await expect(second.getByRole('status').filter({ hasText: 'Solo lectura' })).toBeVisible()

  const performances = second.getByRole('region', { name: 'Desempeños' })
  await expect(
    performances.getByRole('button', { name: 'Cargar desempeños del próximo período (.xlsx)' }),
  ).toBeDisabled()
  await expect(performances.getByLabel('Archivo de matriz del próximo período')).toBeDisabled()
  await expect(
    performances.getByRole('button', { name: 'Descargar plantilla de desempeños' }),
  ).toBeEnabled()
  await expect(
    performances.getByRole('button', { name: 'Descargar ejemplo de desempeños' }),
  ).toBeEnabled()
  await second.close()
})

test('the session-fallback clear drops the pending matrix', async ({ page }) => {
  await page.addInitScript(
    (state) => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined })
      sessionStorage.setItem('informes.config', JSON.stringify(state.config))
      sessionStorage.setItem('informes.reports', JSON.stringify(state.reports))
      sessionStorage.setItem('informes.entered', 'true')
      sessionStorage.setItem(
        'informes.nextPeriodMatrix',
        JSON.stringify({ 'Matemáticas': { Alto: 'Vieja' } }),
      )
    },
    {
      config: { institution: 'Sesión', period: '', scaleType: 'decimal', scale: SCALE, logo: null },
      reports: [
        report({
          label: 'Informe 1',
          subjects: ['Matemáticas'],
          students: [{ name: 'Ana', scores: { 'Matemáticas': 4.5 } }],
        }),
      ],
    },
  )
  await page.goto('/')
  await waitForHydrated(page)
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Limpiar informes' }).click()
  await page
    .getByRole('dialog', { name: 'Limpiar informes' })
    .getByRole('button', { name: 'Limpiar informes' })
    .click()

  await expect(page.getByText('Informes eliminados. La configuración se conservó.')).toBeVisible()
  await expect.poll(() => sessionKey(page)).toBeNull()
})

test('the pending matrix survives a reload of the landing', async ({ page }) => {
  await page.goto('/')
  await waitForHydrated(page)
  const section = page.getByRole('region', { name: 'Desempeños antes de empezar' })
  await section.getByLabel('Archivo de matriz del próximo período').setInputFiles(MATRIX_FILE)
  await expect(pendingStatus(section)).toContainText('2 asignaturas detectadas')

  await page.reload()
  await waitForHydrated(page)
  await expect(
    pendingStatus(page.getByRole('region', { name: 'Desempeños antes de empezar' })),
  ).toContainText('2 asignaturas detectadas')
  await expect(page.getByRole('button', { name: 'Reemplazar archivo' })).toBeVisible()
})

const CENTESIMAL = [
  { key: 'bajo', label: 'Bajo', min: 1, max: 59, tone: 'red' },
  { key: 'basico', label: 'Básico', min: 60, max: 79, tone: 'amber' },
  { key: 'alto', label: 'Alto', min: 80, max: 89, tone: 'blue' },
  { key: 'superior', label: 'Superior', min: 90, max: 100, tone: 'emerald' },
]

test('the centesimal scale selects the band for the first period', async ({ page }) => {
  await seed(page, {
    config: {
      institution: 'Centesimal',
      period: '',
      scaleType: 'centesimal',
      scale: CENTESIMAL,
      logo: null,
    },
    reports: [],
  })
  await openManagementMenu(page)
  await page.getByLabel('Archivo de matriz del próximo período').setInputFiles(MATRIX_FILE)

  await page.getByRole('button', { name: 'Crear manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Carga manual del período' })).toBeVisible()
  await page.getByLabel('Nombre del estudiante 1').fill('Ana')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Cargar manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('85')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.performances?.['Matemáticas'] === 'M-Alto',
  )
  await expect.poll(() => sessionKey(page)).toBeNull()
})
