import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SetupModal from './SetupModal'

const GRANTED = 'Almacenamiento protegido en este navegador.'
const DENIED =
  'El navegador puede liberar espacio; exporta el backup (.xlsx) para conservar el trabajo.'

const render = (persistenceStatus) =>
  renderToStaticMarkup(
    <SetupModal
      persistenceStatus={persistenceStatus}
      onSave={() => {}}
      onClose={() => {}}
    />,
  )

describe('SetupModal persistence status', () => {
  it('keeps the reserved slot empty for missing, unknown and unsupported status', () => {
    for (const status of [undefined, 'unknown', 'unsupported']) {
      const markup = render(status)

      expect(markup).not.toContain(GRANTED)
      expect(markup).not.toContain(DENIED)
      expect(markup).toContain('role="status"')
      expect(markup).toContain('aria-live="polite"')
    }
  })

  it('renders the exact neutral granted and denied copies without voseo', () => {
    const granted = render('granted')
    expect(granted).toContain(GRANTED)
    expect(granted).not.toContain(DENIED)
    expect(granted).not.toContain('exportá')

    const denied = render('denied')
    expect(denied).toContain(DENIED)
    expect(denied).not.toContain(GRANTED)
    expect(denied).not.toContain('exportá')
  })
})
