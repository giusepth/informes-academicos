import { Button, Modal } from './ui'

/** Confirmation before discarding a period-editor draft (R4.2). */
export default function UnsavedChangesDialog({ open, onKeepEditing, onDiscard }) {
  return (
    <Modal
      open={open}
      title="Cambios sin guardar"
      onClose={onKeepEditing}
      footer={
        <>
          <Button variant="secondary" onClick={onKeepEditing} data-autofocus>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            Volver sin guardar
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        Este período tiene cambios que todavía no guardaste. Si vuelves ahora, se descartan.
      </p>
    </Modal>
  )
}
