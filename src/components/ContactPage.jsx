import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { Button } from './ui'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'

/**
 * Contacto — the '#/contacto' hash route in the landing's triplicate world.
 * Client-only by design: a valid submit composes a mailto with the fields the
 * visitor typed, opens their mail app with the message ready, and offers a
 * copy fallback. That honesty keeps the zero-servers promise intact.
 */

const CONTACT_EMAIL = 'giusepthrivera@gmail.com'
const EMAIL_PATTERN = /\S+@\S+\.\S+/
const MIN_MESSAGE_LENGTH = 10

const typed = { fontFamily: "'IBM Plex Mono', monospace" }
const headed = {
  fontFamily: "'Archivo Variable', sans-serif",
  fontVariationSettings: "'wdth' 78, 'wght' 700",
}

const INITIAL_VALUES = { nombre: '', institucion: '', rol: '', correo: '', mensaje: '' }

const SUMMARY_LABELS = { nombre: 'Nombre', correo: 'Correo', mensaje: 'Mensaje' }

const validate = (values) => {
  const errors = {}
  if (!values.nombre.trim()) errors.nombre = 'Escribe tu nombre y apellido.'
  if (!values.correo.trim()) errors.correo = 'Escribe el correo donde esperas la respuesta.'
  else if (!EMAIL_PATTERN.test(values.correo.trim())) {
    errors.correo = 'Escribe un correo válido, del estilo nombre@colegio.edu.'
  }
  if (!values.mensaje.trim()) errors.mensaje = 'Cuenta el caso: qué necesita el colegio y cómo arma los informes hoy.'
  else if (values.mensaje.trim().length < MIN_MESSAGE_LENGTH) {
    errors.mensaje = `El mensaje necesita al menos ${MIN_MESSAGE_LENGTH} caracteres.`
  }
  return errors
}

const composeBody = (values) =>
  [
    `Institución: ${values.institucion.trim()}`,
    `Rol: ${values.rol.trim()}`,
    `Correo: ${values.correo.trim()}`,
    '',
    values.mensaje.trim(),
  ].join('\n')

const composeMailto = (values) => {
  const subject = `Contacto web — ${values.nombre.trim()}`
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(composeBody(values))}`
}

const composePlainMessage = (values) =>
  [
    `Asunto: Contacto web — ${values.nombre.trim()}`,
    `Para: ${CONTACT_EMAIL}`,
    composeBody(values),
  ].join('\n')

const controlClass = (invalid) =>
  cx(
    'w-full rounded-[2px] border bg-[#fdfcf8] px-3 py-2.5 text-[14px] text-[#33455c]',
    'outline-none transition focus:border-[#3e6fa8] focus:ring-2 focus:ring-[#3e6fa8]/50 focus:ring-2 focus:ring-[#3e6fa8]/25',
    invalid ? 'border-[#b4453d] focus:border-[#b4453d]' : 'border-[#8a7d63]',
  )

function ContactField({ id, label, meta = 'obligatorio', error, children }) {
  return (
    <div className="border-b border-[#e4dbc4] px-5 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} style={typed} className="text-[13px] tracking-[0.08em] text-[#6f6757]">
          {label}
        </label>
        <span style={typed} className="text-[12.5px] tracking-[0.03em] text-[#6f6757]">
          {meta}
        </span>
      </div>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] leading-snug text-[#b4453d]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ErrorSummary({ errors }) {
  const entries = Object.entries(SUMMARY_LABELS)
    .map(([field, label]) => ({ field, label, message: errors[field] }))
    .filter((entry) => entry.message)
  return (
    <div role="alert" className="mx-5 mt-4 border-l-[3px] border-[#b4453d] bg-[#faf1ef] px-4 py-3">
      <p style={typed} className="text-[12.5px] font-semibold tracking-[0.04em] text-[#b4453d]">
        Revisa estos campos antes de enviar
      </p>
      <ul className="mt-1.5 space-y-1">
        {entries.map((entry) => (
          <li key={entry.field} className="text-[12.5px] leading-snug text-[#b4453d]">
            {entry.label}: {entry.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ContactPage() {
  const titleRef = useRef(null)
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [mailtoHref, setMailtoHref] = useState('')
  const [toast, setToast] = useState('')
  const [copyFallback, setCopyFallback] = useState(false)
  const successRef = useRef(null)

  // Route entry: the landing footer link can hand over mid-page scroll, so
  // reset to the top, land focus on the page heading and title the document.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    titleRef.current?.focus({ preventScroll: true })
    const previousTitle = document.title
    document.title = 'Contacto — Informes académicos'
    return () => {
      document.title = previousTitle
    }
  }, [])

  // Move focus into the confirmation once it replaces the form so keyboard and
  // screen-reader users hear the result instead of landing back at the top.
  useEffect(() => {
    if (!sent) return undefined
    successRef.current?.focus()
    return undefined
  }, [sent])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const update = (field) => (event) => {
    const { value } = event.target
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const next = validate(values)
    setErrors(next)
    if (next.nombre || next.correo || next.mensaje) {
      const firstInvalid = ['nombre', 'correo', 'mensaje'].find((field) => next[field])
      document.getElementById(firstInvalid)?.focus()
      return
    }
    const href = composeMailto(values)
    setMailtoHref(href)
    setSent(true)
    // Hand off to the mail app; the rendered anchor below mirrors the same
    // href as the inspectable, user-controllable fallback.
    try {
      window.location.href = href
    } catch {
      // A blocked external protocol handler must not stop the success panel.
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(composePlainMessage(values))
      setToast('Copiado')
    } catch {
      setCopyFallback(true)
      setToast('No se pudo copiar automáticamente; el mensaje quedó visible abajo.')
    }
  }

  const handleEdit = () => {
    setMailtoHref('')
    setSent(false)
  }

  const mailErrors = Boolean(errors.nombre || errors.correo || errors.mensaje)

  return (
    <div className="contact-world min-h-screen bg-[#f7f5ef] text-[#33455c]">
      <style>{`
        .contact-world ::selection { background: #cfe0f2; color: #33455c; }
        .contact-world p, .contact-world h1, .contact-world h2 { text-wrap: pretty; }
        .contact-world h1, .contact-world h2 { text-wrap: balance; }
      `}</style>

      <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-8 md:px-6 md:pt-14">
        <p className="mb-5">
          <a
            href="/"
            style={typed}
            className="inline-flex min-h-11 items-center text-[12.5px] tracking-[0.03em] text-[#3e6fa8] underline decoration-[#cfe0f2] underline-offset-2 hover:decoration-[#3e6fa8]"
          >
            <span aria-hidden="true">← </span>Volver al inicio
          </a>
        </p>

        <section className="rounded-[2px] border border-[#d8cfb8] bg-[#fdfcf8] shadow-[2px_3px_12px_rgba(120,110,80,0.14)]">
          <header className="flex items-center justify-between border-b-2 border-[#3e6fa8] px-5 py-3">
            <span style={typed} className="text-[13px] font-semibold tracking-[0.06em] text-[#3e6fa8]">
              CONTACTO
            </span>
            <span style={typed} className="text-[12px] text-[#6f6757]">
              SIN SERVIDORES
            </span>
          </header>

          {sent ? (
            <div
              ref={successRef}
              role="status"
              aria-live="polite"
              tabIndex={-1}
              className="px-5 py-10 text-center focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3e6fa8]"
            >
              <div
                aria-hidden="true"
                className="mx-auto flex h-[74px] w-[74px] items-center justify-center rounded-full border-2 border-[#55704f] p-[5px]"
              >
                <span
                  style={typed}
                  className="flex h-full w-full items-center justify-center rounded-full border border-[#55704f] text-[11px] font-semibold tracking-[0.12em] text-[#55704f]"
                >
                  LISTO
                </span>
              </div>
              <h1 style={headed} className="mt-5 text-[20px] text-[#3b4a63]">
                Mensaje listo
              </h1>
              <p style={typed} className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-[1.65] text-[#6f6757]">
                Se abrió tu correo con el mensaje listo. Si no se abrió, copia este texto y envíalo a{' '}
                <a
                  href={mailtoHref}
                  className="text-[#3e6fa8] underline decoration-[#cfe0f2] underline-offset-2 hover:decoration-[#3e6fa8]"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
              {copyFallback ? (
                <pre
                  data-copy-fallback
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  className="mx-auto mt-5 max-h-40 max-w-[46ch] overflow-auto whitespace-pre-wrap rounded-[2px] border border-[#8a7d63] bg-[#f7f5ef] p-3 text-left text-[12.5px] leading-relaxed text-[#33455c]"
                >
                  {composePlainMessage(values)}
                </pre>
              ) : null}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={handleCopy}
                  className="min-h-11 rounded-[3px] bg-[#3e6fa8] px-5 py-3 text-[14px] font-semibold text-white shadow-[3px_4px_0_#adc6e4] hover:bg-[#4f7bb4] focus-visible:outline-[#3e6fa8]"
                >
                  Copiar mensaje
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleEdit}
                  className="min-h-11 rounded-[3px] px-4 py-3 text-[13px] font-semibold text-[#6f6757] hover:bg-[#efe9db] focus-visible:outline-[#3e6fa8]"
                >
                  Editar de nuevo
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 pb-2 pt-7">
                <h1
                  ref={titleRef}
                  tabIndex={-1}
                  style={headed}
                  className="text-[26px] leading-tight text-[#3b4a63] focus:outline-none"
                >
                  Escríbenos
                </h1>
                <p style={typed} className="mt-2 text-[13px] leading-[1.6] text-[#6f6757]">
                  Si tu colegio necesita una versión a medida, cuéntanos tu caso.
                </p>
              </div>

              {mailErrors ? <ErrorSummary errors={errors} /> : null}

              <form noValidate onSubmit={handleSubmit}>
                <div className="mt-6 border-t border-[#e4dbc4]">
                  <ContactField id="nombre" label="Nombre" error={errors.nombre}>
                    <input
                      id="nombre"
                      name="nombre"
                      type="text"
                      autoComplete="name"
                      required
                      value={values.nombre}
                      onChange={update('nombre')}
                      aria-invalid={errors.nombre ? true : undefined}
                      aria-describedby={errors.nombre ? 'nombre-error' : undefined}
                      className={controlClass(Boolean(errors.nombre))}
                    />
                  </ContactField>

                  <ContactField id="institucion" label="Institución" meta="opcional">
                    <input
                      id="institucion"
                      name="institucion"
                      type="text"
                      autoComplete="organization"
                      value={values.institucion}
                      onChange={update('institucion')}
                      className={controlClass(false)}
                    />
                  </ContactField>

                  <ContactField id="rol" label="Rol" meta="opcional">
                    <select
                      id="rol"
                      name="rol"
                      value={values.rol}
                      onChange={update('rol')}
                      className={controlClass(false)}
                    >
                      <option value="">Selecciona tu rol</option>
                      <option value="Rector">Rector</option>
                      <option value="Coordinación o dirección">Coordinación o dirección</option>
                      <option value="Docente">Docente</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </ContactField>

                  <ContactField id="correo" label="Correo" error={errors.correo}>
                    <input
                      id="correo"
                      name="correo"
                      type="email"
                      autoComplete="email"
                      required
                      value={values.correo}
                      onChange={update('correo')}
                      aria-invalid={errors.correo ? true : undefined}
                      aria-describedby={errors.correo ? 'correo-error' : undefined}
                      className={controlClass(Boolean(errors.correo))}
                    />
                  </ContactField>

                  <ContactField id="mensaje" label="Mensaje" error={errors.mensaje}>
                    <textarea
                      id="mensaje"
                      name="mensaje"
                      rows={5}
                      required
                      minLength={MIN_MESSAGE_LENGTH}
                      value={values.mensaje}
                      onChange={update('mensaje')}
                      aria-invalid={errors.mensaje ? true : undefined}
                      aria-describedby={errors.mensaje ? 'mensaje-error' : undefined}
                      className={cx(controlClass(Boolean(errors.mensaje)), 'resize-y leading-[1.55]')}
                    />
                  </ContactField>
                </div>

                <div className="px-5 pb-7 pt-5">
                  <Button
                    type="submit"
                    className="rounded-[3px] bg-[#3e6fa8] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[3px_4px_0_#adc6e4] hover:bg-[#4f7bb4] focus-visible:outline-[#3e6fa8]"
                  >
                    Enviar mensaje
                  </Button>
                  <p style={typed} className="mt-3 text-[12.5px] leading-[1.6] text-[#6f6757]">
                    El formulario no envía nada por sí solo: abre tu aplicación de correo con el mensaje
                    listo. No hay servidores.
                  </p>
                </div>
              </form>
            </>
          )}
        </section>
      </main>

      {sent && mailtoHref ? (
        <a id="mailto-target" href={mailtoHref} aria-hidden="true" tabIndex={-1} className="hidden">
          Abrir en tu aplicación de correo
        </a>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#33455c] px-4 py-2 text-[13px] text-[#fdfcf8] shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
