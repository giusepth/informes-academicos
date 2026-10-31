import { expect, test } from '@playwright/test'
import {
  openManagementMenu,
  readDataKey,
  report,
  seed,
  waitForHydrated,
  waitForPersisted,
} from './helpers'

const SUBJECTS = ['Matemáticas', 'Ciencias']

const first = report({
  label: 'Informe 1',
  grade: '5° A',
  subjects: SUBJECTS,
  students: [
    {
      name: 'Ana',
      scores: { Matemáticas: 4.5, Ciencias: 3.8 },
      performances: { Matemáticas: 'Juicio original' },
    },
  ],
})

const second = report({
  label: 'Informe 2',
  grade: '6° B',
  subjects: SUBJECTS,
  students: [{ name: 'Luis', scores: { Matemáticas: 2.0, Ciencias: 2.5 }, performances: {} }],
})


test('a blank period is edited in the editor and saved as a new period', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Nuevo periodo en blanco' }).click()

  await expect(page).toHaveURL(/#\/editor$/)
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()
  await expect(page.getByLabel('Grado / Curso')).toHaveValue('5° A')
  await expect(page.getByRole('button', { name: 'Crear período' })).toBeVisible()

  // The copy keeps the structure, not the scores or judgments.
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('')
  await expect(page.getByLabel('Desempeño de Ana en Matemáticas')).toHaveValue('')

  await page.getByRole('button', { name: 'Agregar estudiante' }).click()
  await page.getByPlaceholder('Nombre del estudiante').last().fill('Bruno')
  await page.getByLabel('Nota de Ana en Matemáticas').fill('3,5')
  await page.getByLabel('Desempeño de Ana en Matemáticas').fill('Progresa con apoyo')
  await page.getByLabel('Nota de Bruno en Ciencias').fill('4.0')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('button', { name: 'Informe 2', exact: true })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('3.5')
  await expect(page.getByText('Progresa con apoyo').first()).toBeVisible()
  await expect(page.locator('input, textarea')).toHaveCount(0)

  await waitForPersisted(page, 'informes.reports', (value) => value?.length === 2)
  const stored = await readDataKey(page, 'informes.reports')
  expect(stored[1].students.map((student) => student.name)).toEqual(['Ana', 'Bruno'])
  expect(stored[1].students[0].scores.Matemáticas).toBe(3.5)
  expect(stored[1].students[0].performances.Matemáticas).toBe('Progresa con apoyo')
  const ids = stored.flatMap((entry) => entry.students.map((student) => student.id))
  expect(new Set(ids).size).toBe(ids.length)

  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.5')
  await expect(page.getByText('Juicio original').first()).toBeVisible()
})

test('editing a period preserves its identity and leaves other periods intact', async ({
  page,
}) => {
  await seed(page, { reports: [first, second] })
  const before = await readDataKey(page, 'informes.reports')
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await expect(page).toHaveURL(/#\/editor$/)
  await expect(page.getByRole('heading', { name: 'Editar período' })).toBeVisible()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('5.0')
  await page.getByLabel('Desempeño de Ana en Ciencias').fill('Cierre del período')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('5.0')
  await expect(page.getByText('Cierre del período').first()).toBeVisible()
  await expect(page.locator('input, textarea')).toHaveCount(0)

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.scores?.Matemáticas === 5,
  )
  const after = await readDataKey(page, 'informes.reports')
  expect(after[0].id).toBe(before[0].id)
  expect(after[0].students[0].id).toBe(before[0].students[0].id)
  expect(after[1]).toEqual(before[1])

  await page.getByRole('button', { name: 'Informe 2', exact: true }).click()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('2.0')
})

test('removing a subject drops its scores and performances from that period only', async ({
  page,
}) => {
  await seed(page, { reports: [first, second] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByRole('button', { name: 'Quitar Ciencias' }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.subjects?.length === 1,
  )
  const after = await readDataKey(page, 'informes.reports')
  expect(after[0].subjects).toEqual(['Matemáticas'])
  expect(after[0].students[0].scores).toEqual({ Matemáticas: 4.5 })
  expect(after[0].students[0].performances).toEqual({ Matemáticas: 'Juicio original' })
  expect(after[1].subjects).toEqual(SUBJECTS)
  expect(after[1].students[0].scores).toEqual({ Matemáticas: 2, Ciencias: 2.5 })
})

test('renaming a subject keeps its scores and performances', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  const firstSubject = page.getByLabel('Nombre de asignatura 1')
  // A transient duplicate must be blocked, but never discard the row data.
  await firstSubject.fill('Ciencias')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert')).toContainText('No repitas el nombre')

  // Saving trims surrounding spaces instead of orphaning the stored keys.
  await firstSubject.fill('  Matemática  ')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.subjects?.[0] === 'Matemática',
  )
  const after = await readDataKey(page, 'informes.reports')
  expect(after[0].subjects).toEqual(['Matemática', 'Ciencias'])
  expect(after[0].students[0].scores).toEqual({ Matemática: 4.5, Ciencias: 3.8 })
  expect(after[0].students[0].performances).toEqual({ Matemática: 'Juicio original', Ciencias: '' })
})

test('a direct editor route without intent redirects to management', async ({ page }) => {
  await seed(page, { reports: [first] })
  await page.goto('/#/editor')

  await expect(page).toHaveURL(/#\/gestion$/)
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
})

test('a clean editor left through history does not keep a stale intent', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.goBack()
  await expect(page).toHaveURL(/#\/gestion$/)

  await page.goto('/#/editor')
  await expect(page).toHaveURL(/#\/gestion$/)
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()
})

test('reloading the editor restores the edit intent but starts a fresh draft', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByLabel('Nota de Ana en Matemáticas').fill('1.0')
  await page.reload()

  await expect(page).toHaveURL(/#\/editor$/)
  await expect(page.getByRole('heading', { name: 'Editar período' })).toBeVisible()
  // Only the intent is persisted: the uncommitted draft is gone.
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('4.5')

  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page).toHaveURL(/#\/gestion$/)
  await expect(page.getByRole('dialog', { name: 'Cambios sin guardar' })).toHaveCount(0)
})

test('a remote report refresh keeps the open draft and its unsaved state', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByLabel('Grado / Curso').fill('5° B')
  await page.getByLabel('Nota de Ana en Matemáticas').fill('1.0')

  // Simulate another tab committing and announcing the change while this
  // editor is open. The local draft must survive the remote snapshot.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('informes', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite')
        const store = tx.objectStore('kv')
        const get = store.get('informes.reports')
        get.onsuccess = () => {
          const reports = get.result
          reports[0].students[0].scores['Matemáticas'] = 1.0
          reports[0].students[0].performances['Matemáticas'] = 'Cambio remoto'
          store.put(reports, 'informes.reports')
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }

    const channel = new BroadcastChannel('informes.tab-sync')
    channel.postMessage({
      type: 'informes:data-changed',
      source: 'another-tab',
      reason: 'data',
    })
    channel.close()
  })
  await page.waitForTimeout(500)

  await expect(page.getByLabel('Grado / Curso')).toHaveValue('5° B')
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('1.0')

  await page.getByRole('button', { name: 'Volver' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cambios sin guardar' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Volver sin guardar' }).click()

  // Discarding reveals the resynced snapshot: this proves the remote change
  // actually reached React state, not just IndexedDB.
  await page.getByRole('button', { name: 'Informe 1', exact: true }).click()
  await expect(page.getByText('Cambio remoto').first()).toBeVisible()
})

test('blank names cannot silently delete a subject or a student with data', async ({ page }) => {
  await seed(page, { reports: [first] })
  const before = await readDataKey(page, 'informes.reports')
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByLabel('Nombre de asignatura 1').fill('   ')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert')).toContainText('Completa o quita las asignaturas')

  await page.getByLabel('Nombre de asignatura 1').fill('Matemáticas')
  await page.getByRole('button', { name: 'Agregar estudiante' }).click()
  await page.getByPlaceholder('Nombre del estudiante').last().fill('Luis')
  await page.getByPlaceholder('Nombre del estudiante').first().fill('   ')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Completa el nombre de los estudiantes con notas o desempeños',
  )

  expect(await readDataKey(page, 'informes.reports')).toEqual(before)
})

test('browser back after leaving the editor reaches the previous screens', async ({ page }) => {
  await seed(page, { reports: [first] })
  await page.goto('/#/boletin')
  await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible()

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('4.6')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page).toHaveURL(/#\/boletin$/)

  await page.goBack()
  await expect(page).toHaveURL(/#\/gestion$/)
  await page.goBack()
  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible()
})

test('browser back with a dirty editor asks before discarding', async ({ page }) => {
  await seed(page, { reports: [first] })
  const before = await readDataKey(page, 'informes.reports')
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('1.0')

  await page.goBack()
  const dialog = page.getByRole('dialog', { name: 'Cambios sin guardar' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Volver sin guardar' }).click()

  await expect(page).toHaveURL(/#\/gestion$/)
  expect(await readDataKey(page, 'informes.reports')).toEqual(before)
})

test('a remote clear keeps a dirty editor and saves the draft as a new period', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await page.getByLabel('Grado / Curso').fill('6° C')

  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('informes', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite')
        tx.objectStore('kv').put([], 'informes.reports')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }

    const channel = new BroadcastChannel('informes.tab-sync')
    channel.postMessage({
      type: 'informes:data-changed',
      source: 'another-tab',
      reason: 'data',
    })
    channel.close()
  })

  await expect(page.getByRole('dialog', { name: 'Cambios sin guardar' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Cambios sin guardar' })
    .getByRole('button', { name: 'Seguir editando' })
    .click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.length === 1 && value[0]?.grade === '6° C',
  )
})

test('promotion remounts an open editor from the fresh report', async ({ page, context }) => {
  await seed(page, { reports: [first] })

  const second = await context.newPage()
  await second.addInitScript((reportId) => {
    sessionStorage.setItem(
      'informes.editor',
      JSON.stringify({ mode: 'edit', reportId }),
    )
    sessionStorage.setItem('informes.activeReport', JSON.stringify(reportId))
  }, first.id)
  await second.goto('/#/editor')
  await waitForHydrated(second)
  await expect(second.getByRole('heading', { name: 'Editar período' })).toBeVisible()
  await expect(second.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('4.5')

  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  await page.getByLabel('Nota de Ana en Matemáticas').fill('4.9')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await waitForPersisted(
    page,
    'informes.reports',
    (value) => value?.[0]?.students?.[0]?.scores?.Matemáticas === 4.9,
  )
  await page.close()

  await expect(second.getByRole('heading', { name: 'Editar período' })).toBeVisible()
  await expect(second.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('4.9')
  await second.close()
})

test('leaving with unsaved changes asks first and can keep editing', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()
  const before = await readDataKey(page, 'informes.reports')

  await page.getByLabel('Nota de Ana en Matemáticas').fill('1.0')
  await page.getByRole('button', { name: 'Volver' }).click()

  const dialog = page.getByRole('dialog', { name: 'Cambios sin guardar' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Seguir editando' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Nota de Ana en Matemáticas')).toHaveValue('1')

  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByRole('dialog', { name: 'Cambios sin guardar' })
    .getByRole('button', { name: 'Volver sin guardar' })
    .click()

  await expect(page).toHaveURL(/#\/gestion$/)
  expect(await readDataKey(page, 'informes.reports')).toEqual(before)
})

test('leaving without changes does not ask for confirmation', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page).toHaveURL(/#\/gestion$/)
  await expect(page.getByRole('dialog', { name: 'Cambios sin guardar' })).toHaveCount(0)
})

test('the editor can create the first report from an empty session', async ({ page }) => {
  await seed(page, { reports: [] })
  await expect(page.getByRole('heading', { name: 'Gestión de informes' })).toBeVisible()

  await page.getByRole('button', { name: 'Crear manualmente' }).click()
  await expect(page).toHaveURL(/#\/editor$/)
  // Guided manual entry (S8): students first, then the desempeños stop.
  await expect(page.getByRole('heading', { name: 'Carga manual del período' })).toBeVisible()
  await page.getByLabel('Nombre del estudiante 1').fill('Ana')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Cargar manualmente' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo período' })).toBeVisible()

  await page.getByLabel('Nota de Ana en Matemáticas').fill('4.0')
  await page.getByRole('button', { name: 'Crear período' }).click()

  await expect(page).toHaveURL(/#\/boletin$/)
  await expect(page.getByRole('button', { name: 'Informe 1', exact: true })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Matemáticas' }).first()).toContainText('4.0')
})

test('the editor validates subjects and students before saving', async ({ page }) => {
  await seed(page, { reports: [first] })
  await openManagementMenu(page)
  await page.getByRole('button', { name: 'Editar período' }).click()

  await page.getByPlaceholder('Nombre del estudiante').fill('')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert')).toContainText('al menos un estudiante')
  await expect(page).toHaveURL(/#\/editor$/)
})
