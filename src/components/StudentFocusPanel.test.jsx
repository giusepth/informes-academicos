import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import StudentFocusPanel from './StudentFocusPanel'
import { DEFAULT_SCALE } from '../utils/calculations'

const Subjects = [
  { id: 'subject-0', name: 'Matemáticas', teacher: '' },
  { id: 'subject-1', name: 'Lengua', teacher: '' },
]

const Student = {
  id: 's1',
  name: 'Ana Gómez',
  scores: { 'subject-0': 4.6, 'subject-1': 2.5 },
  performances: { 'subject-0': 'Resuelve con estrategias propias.', 'subject-1': '' },
}

const base = {
  student: Student,
  position: 0,
  count: 5,
  subjects: Subjects,
  scoreDrafts: {},
  maxScore: 5,
  scale: DEFAULT_SCALE,
  scaleType: 'decimal',
  onNameChange: () => {},
  onScoreDraftChange: () => {},
  onScoreCommit: () => {},
  onPerformanceChange: () => {},
  onNavigate: () => {},
  onClose: () => {},
}

const render = (props = {}) => renderToStaticMarkup(<StudentFocusPanel {...base} {...props} />)

describe('StudentFocusPanel', () => {
  it('renders the student name and one editable row per subject', () => {
    const markup = render()
    expect(markup).toContain('value="Ana Gómez"')
    expect(markup).toContain('Matemáticas')
    expect(markup).toContain('Lengua')
    expect(markup).toContain('value="4.6"')
   expect(markup).toContain('Resuelve con estrategias propias.')
    expect(markup).toContain('aria-label="Desempeño de Ana Gómez en Lengua"')
  })

  it('shows the institutional band for committed scores', () => {
    const markup = render()
    expect(markup).toContain('Superior')
    expect(markup).toContain('Bajo')
  })

  it('navigates with bounds disabled and exits back to the grid', () => {
    const markup = render()
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('Siguiente')
    expect(markup).toContain('Volver a la grilla')
  })
})
