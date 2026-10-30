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

const render = (mode = 'create') =>
  renderToStaticMarkup(
    <PeriodEditor mode={mode} initial={Initial} onSave={() => {}} onCancel={() => {}} />,
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
