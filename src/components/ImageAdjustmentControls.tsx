import { FlipHorizontal2, FlipVertical2 } from 'lucide-react'
import type { ManagedImage } from '../types/image'

interface Props {
  image: ManagedImage
  onFlip: (axis: 'h' | 'v') => void
  onAdjust: (patch: { brightness?: number; contrast?: number }, commit: boolean) => void
  onGrayscaleToggle: () => void
}

export function ImageAdjustmentControls({ image, onFlip, onAdjust, onGrayscaleToggle }: Props) {
  const { edit } = image

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onFlip('h')}
          aria-pressed={edit.flipH}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${
            edit.flipH ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border bg-surface text-ink hover:border-accent/50'
          }`}
        >
          <FlipHorizontal2 size={15} /> Flip H
        </button>
        <button
          type="button"
          onClick={() => onFlip('v')}
          aria-pressed={edit.flipV}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${
            edit.flipV ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border bg-surface text-ink hover:border-accent/50'
          }`}
        >
          <FlipVertical2 size={15} /> Flip V
        </button>
        <button
          type="button"
          onClick={onGrayscaleToggle}
          aria-pressed={edit.grayscale}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            edit.grayscale ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border bg-surface text-ink hover:border-accent/50'
          }`}
        >
          Grayscale
        </button>
      </div>

      <label className="flex items-center gap-3 text-sm text-muted">
        <span className="w-20 shrink-0">Brightness</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={edit.brightness}
          onChange={(e) => onAdjust({ brightness: Number(e.target.value) }, false)}
          onMouseUp={(e) => onAdjust({ brightness: Number((e.target as HTMLInputElement).value) }, true)}
          onTouchEnd={(e) => onAdjust({ brightness: Number((e.target as HTMLInputElement).value) }, true)}
          className="slider flex-1"
          aria-label="Brightness"
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{edit.brightness}</span>
      </label>

      <label className="flex items-center gap-3 text-sm text-muted">
        <span className="w-20 shrink-0">Contrast</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={edit.contrast}
          onChange={(e) => onAdjust({ contrast: Number(e.target.value) }, false)}
          onMouseUp={(e) => onAdjust({ contrast: Number((e.target as HTMLInputElement).value) }, true)}
          onTouchEnd={(e) => onAdjust({ contrast: Number((e.target as HTMLInputElement).value) }, true)}
          className="slider flex-1"
          aria-label="Contrast"
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{edit.contrast}</span>
      </label>
    </div>
  )
}
