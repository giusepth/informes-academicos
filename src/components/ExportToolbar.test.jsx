import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ExportToolbar from './ExportToolbar'

const base = {
  report: { grade: '5° A' },
  students: [],
  selectedStudentId: null,
  onSelectStudent: () => {},
  getPrintElement: () => null,
  onPreview: () => {},
  onNotify: () => {},
}

const render = (props = {}) => renderToStaticMarkup(<ExportToolbar {...base} {...props} />)

describe('ExportToolbar backup download', () => {
  it('shows the backup download action when the session backup handler is provided', () => {
    const markup = render({ onBackupExport: () => {} })
    expect(markup).toContain('Descargar respaldo (.xlsx)')
  })

  it('keeps the toolbar backward compatible without the backup handler', () => {
    const markup = render()
    expect(markup).not.toContain('Descargar respaldo (.xlsx)')
    expect(markup).toContain('Imprimir')
    expect(markup).toContain('Generar ZIP (todos)')
  })
})
