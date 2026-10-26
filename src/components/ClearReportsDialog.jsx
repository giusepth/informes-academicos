import { Button, Modal } from './ui'

/**
 * Destructive confirmation for clearing the current school year. The modal
 * spells out exactly what is deleted and what survives; the default focus
 * stays on Cancelar so an accidental Enter never wipes the work.
 */
export default function ClearReportsDialog({
  open,
  busy = false,
  onCancel,
  onConfirm,
  readOnly = false,
}) {
  return (
    <Modal
      open={open}
      title="Limpiar informes"
      onClose={busy ? undefined : onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy} data-autofocus>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={busy || readOnly}
            aria-busy={busy}
          >
            {busy ? 'Limpiando…' : 'Limpiar informes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <p>Se eliminarán de este navegador:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Todos los períodos y sus notas.</li>
          <li>Todos los desempeños, incluidos los del informe final.</li>
          <li>Cualquier matriz de desempeños pendiente de aplicar.</li>
        </ul>
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          Se conservan la institución, el período lectivo, la escala y el escudo.
        </p>
        <p>
          Esta acción no se puede deshacer. Si necesitas conservar el trabajo, cancela y
          exporta primero el backup (.xlsx).
        </p>
      </div>
    </Modal>
  )
}
