import { useRef, useState } from 'react'
import { DEFAULT_SCALE } from '../utils/calculations'
import { Button, Field, Modal, TextInput } from './ui'

function toDraft(config) {
  return {
    institution: config?.institution ?? '',
    period: config?.period ?? '',
    scale: (config?.scale ?? DEFAULT_SCALE).map((band) => ({ ...band })),
    logo: config?.logo ?? null,
  }
}

/**
 * Initial configuration modal (RF-01): qualitative scale and PNG shield.
 * When `initialRun` is true the modal cannot be dismissed without saving.
 * The parent mounts it only while it should be visible, so mount == open.
 */
export default function SetupModal({ initialConfig, initialRun = false, onSave, onClose }) {
  const [draft, setDraft] = useState(() => toDraft(initialConfig))
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const updateBand = (index, patch) => {
    setDraft((current) => ({
      ...current,
      scale: current.scale.map((band, i) => (i === index ? { ...band, ...patch } : band)),
    }))
  }

  const handleLogo = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('El escudo debe ser un archivo de imagen (PNG recomendado).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setDraft((current) => ({ ...current, logo: reader.result }))
      setError('')
    }
    reader.onerror = () => setError('No se pudo leer la imagen.')
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    const cleanedScale = draft.scale
      .map((band) => ({
        ...band,
        label: band.label.trim() || band.key,
        min: Number(band.min),
        max: Number(band.max),
      }))
      .filter((band) => Number.isFinite(band.min) && Number.isFinite(band.max))

    const invalid = cleanedScale.find((band) => band.min > band.max)
    if (invalid) {
      setError(`La escala "${invalid.label}" tiene el mínimo mayor que el máximo.`)
      return
    }

    onSave({
      institution: draft.institution.trim(),
      period: draft.period.trim(),
      scale: cleanedScale.length ? cleanedScale : DEFAULT_SCALE,
      logo: draft.logo,
    })
  }

  return (
    <Modal
      open
      title={initialRun ? 'Configuración inicial' : 'Configuración'}
      onClose={initialRun ? undefined : onClose}
      footer={
        <>
          {!initialRun ? (
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          ) : null}
          <Button onClick={handleSubmit}>Guardar configuración</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institución educativa">
            <TextInput
              className="w-full"
              value={draft.institution}
              onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
              placeholder="Colegio Ejemplo"
            />
          </Field>
          <Field label="Periodo">
            <TextInput
              className="w-full"
              value={draft.period}
              onChange={(e) => setDraft({ ...draft, period: e.target.value })}
              placeholder="Primer periodo 2026"
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Escala cualitativa (rango de notas)
          </p>
          <div className="space-y-2">
            {draft.scale.map((band, index) => (
              <div key={band.key} className="flex items-center gap-2">
                <TextInput
                  className="flex-1"
                  value={band.label}
                  onChange={(e) => updateBand(index, { label: e.target.value })}
                  aria-label={`Nombre de la banda ${index + 1}`}
                />
                <TextInput
                  className="w-20"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={band.min}
                  onChange={(e) => updateBand(index, { min: e.target.value })}
                  aria-label={`Mínimo de ${band.label}`}
                />
                <span className="text-slate-400">a</span>
                <TextInput
                  className="w-20"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={band.max}
                  onChange={(e) => updateBand(index, { max: e.target.value })}
                  aria-label={`Máximo de ${band.label}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Escudo institucional</p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
              {draft.logo ? (
                <img src={draft.logo} alt="Escudo cargado" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">Sin escudo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogo}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Subir PNG
              </Button>
              {draft.logo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft({ ...draft, logo: null })}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Se usa como marca de agua en el informe. La imagen queda solo en memoria.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </Modal>
  )
}
