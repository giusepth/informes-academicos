import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { openManagementMenu, readDataKey, report, seed, waitForPersisted } from './helpers'

const SUBJECTS = ['Matemáticas']

const oneReport = [
  report({
    label: 'Informe 1',
    subjects: SUBJECTS,
    students: [{ name: 'Ana', scores: { Matemáticas: 4.5 }, performances: {} }],
  }),
]

const twoReports = [
  oneReport[0],
  report({
    label: 'Informe 2',
    subjects: SUBJECTS,
    students: [{ name: 'Ana', scores: { Matemáticas: 4.0 }, performances: {} }],
  }),
]

const reportSheet = (name = 'Luis') => [
  ['Estudiante', 'Grado', 'Docente', 'Matemáticas'],
  [name, '5° A', 'Prof. X', 3.0],
  ['Marta', '5° A', 'Prof. X', 4.0],
]

const xlsxBytes = (sheets) => {
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const singleSheet = () => xlsxBytes([['Hoja1', reportSheet()]])

const multiSheetWithNotes = () =>
  xlsxBytes([
    ['Informe 3', reportSheet()],
    ['Notas', [['Notas internas'], ['sin estudiantes']]],
  ])

const fullBackup = () =>
  xlsxBytes([
    ['Informe 1', reportSheet('Luis')],
    ['Informe 2', reportSheet('Ana')],
  ])

const file = (buffer) => ({
  name: 'periodo.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer,
})

const importFile = async (page, buffer) => {
  const newWork = page.getByRole('region', { name: 'Nuevo trabajo' })
  await newWork.locator('input[type=file]').setInputFiles(file(buffer))
}

test('a period imported from the menu keeps student ids and isolated scores', async ({ page }) => {
  await seed(page, { reports: oneReport })
  await openManagementMenu(page)
  await importFile(page, singleSheet())

  // Imported workbooks enter the guided flow instead of jumping to reports.
  await expect(page.getByText(/Se han cargado 2 estudiantes y 1 asignatura/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Cargar manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await page.getByRole('button', { name: 'Crear período' }).click()
  await expect(page.getByText(/Informe 2 creado con 2 estudiantes/)).toBeVisible()
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)

  const stored = await readDataKey(page, 'informes.reports')
  expect(
    stored[1].students.every((student) => typeof student.id === 'string' && student.id.length > 0),
  ).toBe(true)

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await page.getByLabel('Nota de Marta en Matemáticas').fill('1.0')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await waitForPersisted(
    page,
    'informes.reports',
    (value) =>
      value?.[1]?.students?.some(
        (student) => student.name === 'Marta' && student.scores?.Matemáticas === 1,
      ),
  )
  const after = await readDataKey(page, 'informes.reports')
  expect(after[1].students.find((student) => student.name === 'Luis').scores.Matemáticas).toBe(3)
})

test('a period workbook with a stray sheet appends instead of replacing existing reports', async ({
  page,
}) => {
  await seed(page, { reports: twoReports })
  await openManagementMenu(page)
  await importFile(page, multiSheetWithNotes())

  await expect(page.getByText(/Se han cargado 2 estudiantes y 1 asignatura/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Omitir por ahora' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await page.getByRole('button', { name: 'Crear período' }).click()
  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 3)

  const stored = await readDataKey(page, 'informes.reports')
  expect(stored.map((entry) => entry.label)).toEqual(['Informe 1', 'Informe 2', 'Informe 3'])
  expect(stored[0].students[0].name).toBe('Ana')
})

test('a full backup is not silently restored over existing reports', async ({ page }) => {
  await seed(page, { reports: twoReports })
  await openManagementMenu(page)
  await importFile(page, fullBackup())

  await expect(page.getByRole('alert')).toContainText('parece un backup completo')
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored).toHaveLength(2)
  expect(stored.map((entry) => entry.label)).toEqual(['Informe 1', 'Informe 2'])
})
