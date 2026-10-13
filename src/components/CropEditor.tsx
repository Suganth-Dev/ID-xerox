import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import type { ManagedImage } from '../types/image'

interface AspectPreset {
  label: string
  value: number | null
}

const ASPECT_PRESETS: AspectPreset[] = [
  { label: 'Original', value: null },
  { label: 'Square', value: 1 },
  { label: 'Portrait 3:4', value: 3 / 4 },
  { label: 'Landscape 4:3', value: 4 / 3 },
  { label: 'ID Card', value: 85.6 / 53.98 },
]

interface Props {
  image: ManagedImage
  /** URL of the source to crop — the warped/scanned document when available, otherwise the original photo */
  sourceUrl: string
  sourceWidth: number
  sourceHeight: number
  onLiveChange: (patch: { crop: Area; zoom: number }) => void
  onCommit: () => void
  onAspectChange: (aspect: number | null) => void
}

export function CropEditor({ image, sourceUrl, sourceWidth, sourceHeight, onLiveChange, onCommit, onAspectChange }: Props) {
  const [zoom, setZoom] = useState(image.edit.zoom || 1)
  const [cropPoint, setCropPoint] = useState<Point>({ x: 0, y: 0 })

  const totalRotation = image.edit.rotation + image.edit.fineRotation
  const aspect = image.edit.aspect ?? sourceWidth / sourceHeight

  const handleCropComplete = useCallback(
    (_area: Area, areaPixels: Area) => {
      onLiveChange({ crop: areaPixels, zoom })
    },
    [onLiveChange, zoom],
  )

  // Live preview only — brightness/contrast/grayscale are actually baked in later in the
  // pipeline (after crop), but mirroring them here with a CSS filter gives instant visual
  // feedback while dragging the sliders, instead of only showing up in the small thumbnail.
  const { brightness, contrast, grayscale } = image.edit
  const previewFilter =
    brightness === 0 && contrast === 0 && !grayscale
      ? undefined
      : `brightness(${Math.max(0, 100 + brightness)}%) contrast(${Math.max(0, 100 + contrast)}%) ${grayscale ? 'grayscale(100%)' : ''}`

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative mx-auto h-[420px] overflow-hidden rounded-lg border border-border bg-canvas"
        style={{ width: `min(100%, ${Math.round(420 * aspect)}px)`, filter: previewFilter }}
      >
        <Cropper
          image={sourceUrl}
          crop={cropPoint}
          zoom={zoom}
          rotation={totalRotation}
          aspect={aspect}
          initialCroppedAreaPixels={image.edit.crop ?? undefined}
          onCropChange={setCropPoint}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          onInteractionEnd={onCommit}
          showGrid
          restrictPosition
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ASPECT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onAspectChange(preset.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              image.edit.aspect === preset.value
                ? 'border-accent bg-accent-soft text-accent-strong'
                : 'border-border bg-surface text-muted hover:border-accent/50 hover:text-ink'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 text-sm text-muted">
        <span className="w-16 shrink-0">Zoom</span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          onMouseUp={onCommit}
          onTouchEnd={onCommit}
          className="slider flex-1"
          aria-label="Zoom"
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{zoom.toFixed(2)}x</span>
      </label>
    </div>
  )
}
