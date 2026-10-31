import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ManualEntryWizard from './ManualEntryWizard'

const render = () =>
  renderToStaticMarkup(
    <ManualEntryWizard
      onOpenEditor={() => {}}
      onSaveAndOpenReports={() => {}}
      onCancel={() => {}}
    />,
  )

describe('ManualEntryWizard step 1', () => {
  it('loads students and subjects before asking about desempeños', () => {
    const markup = render()
    expect(markup).toContain('Carga manual del período')
    expect(markup).toContain('aria-label="Lista de estudiantes para pegar"')
    expect(markup).toContain('aria-label="Asignatura sugerida: Ciencias Naturales"')
    expect(markup).toContain('Continuar')
    expect(markup).toContain('Cancelar')
    expect(markup).not.toContain('¿Quieres cargar los desempeños?')
  })
})
