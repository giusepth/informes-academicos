import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PeriodEditor from './PeriodEditor'

const Initial = {
  grade: '5° A',
  teacher: 'Prof. Rivera',
  subjects: ['Matemáticas'],
  students: [
    { id: 's1', name: 'Ana Gómez', scores: { 'Matemáticas': 4.5 }, performances: { 'Matemáticas': '' } },
  ],
}

const render = (mode = 'create', initial = Initial) =>
  renderToStaticMarkup(
    <PeriodEditor mode={mode} initial={initial} onSave={() => {}} onCancel={() => {}} />,
  )

describe('PeriodEditor density controls', () => {
  it('keeps the full grid as the default view (skills and desempeños visible)', () => {
    const markup = render()
    expect(markup).toContain('Desempeño de Ana Gómez en Matemáticas')
    expect(markup).toContain('value="4.5"')
  })

  it('shows the roster count and the compact view toggle', () => {
    const markup = render()
    expect(markup).toContain('Estudiantes (1)')
    expect(markup).toContain('Vista compacta')
  })
})

describe('PeriodEditor assisted manual entry', () => {
  it('offers common subject suggestions not already used', () => {
    const markup = render()
    expect(markup).toContain('aria-label="Asignatura sugerida: Ciencias Naturales"')
    expect(markup).not.toContain('aria-label="Asignatura sugerida: Matemáticas"')
  })

  it('hides an already-taken suggested subject', () => {
    const markup = render('create', {
      ...Initial,
      subjects: ['Matemáticas', 'Ciencias Naturales'],
    })
    expect(markup).not.toContain('aria-label="Asignatura sugerida: Ciencias Naturales"')
  })

  it('provides the paste-a-roster loader', () => {
    const markup = render()
    expect(markup).toContain('Cargar una lista de estudiantes')
    expect(markup).toContain('Cargar lista')
    expect(markup).toContain('aria-label="Lista de estudiantes para pegar"')
  })
})
