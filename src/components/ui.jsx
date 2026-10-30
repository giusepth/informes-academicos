import { useEffect, useRef } from 'react'
import { TONE_CLASSES } from '../utils/calculations'
import { cx } from '../utils/cx'

const BUTTON_VARIANTS = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-700 focus-visible:outline-slate-900',
  secondary:
    'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400',
  danger:
    'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400',
}

const BUTTON_SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  )
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

// R6: editable fields are recognizable inside the editors. The muted
// disabled/read-only treatment keeps report surfaces free of form borders.
const INPUT_CLASS =
  'rounded-lg border border-[#8da4c2] bg-[#f4f8fc] px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-600 hover:bg-[#edf4fb] focus:border-[#3e6fa8] focus:ring-2 focus:ring-[rgba(62,111,168,0.3)] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-slate-700 disabled:shadow-none disabled:hover:bg-white read-only:border-[#e2e8f0] read-only:bg-white read-only:shadow-none'

const TEXTAREA_CLASS =
  'min-h-[56px] w-full resize-y rounded-md border border-[#8da4c2] bg-[#f4f8fc] px-2 py-1 text-sm text-slate-900 outline-none transition placeholder:text-slate-600 hover:bg-[#edf4fb] focus:border-[#3e6fa8] focus:ring-2 focus:ring-[rgba(62,111,168,0.3)] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-slate-700 disabled:shadow-none disabled:hover:bg-white read-only:border-[#e2e8f0] read-only:bg-white'

export function TextInput({ className, ...props }) {
  return <input className={cx(INPUT_CLASS, className)} {...props} />
}

export function TextArea({ className, ...props }) {
  return <textarea className={cx(TEXTAREA_CLASS, className)} {...props} />
}

export function ToneBadge({ tone = 'slate', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONE_CLASSES[tone] ?? TONE_CLASSES.slate,
      )}
    >
      {children}
    </span>
  )
}

/** Label + underline signature slot used at the footer of report sheets. */
export function SignatureField({ label }) {
  return (
    <div>
      <div className="h-12 border-b border-slate-400" />
      <p className="mt-2 text-xs font-medium text-slate-600">{label}</p>
    </div>
  )
}

/** Compact label:value row used in the report data grid. */
export function Info({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-slate-500">{label}:</span>
      <span className="text-slate-800">{value}</span>
    </div>
  )
}

export function Modal({ open, title, children, footer, onClose }) {
  const containerRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const container = containerRef.current
    const focusables = () =>
      Array.from(
        container?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0)

    const initial = container?.querySelector('[data-autofocus]') ?? focusables()[0] ?? container
    initial?.focus()

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = focusables()
      if (nodes.length === 0) {
        event.preventDefault()
        container?.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && (document.activeElement === first || !container?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !container?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
              Cerrar
            </Button>
          ) : null}
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
