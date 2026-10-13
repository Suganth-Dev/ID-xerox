import { RotateCcw, RotateCw } from 'lucide-react'
import type { ManagedImage } from '../types/image'

interface Props {
  image: ManagedImage
  onRotate: (direction: 'left' | 'right') => void
  onFineRotationChange: (deg: number, commit: boolean) => void
  onResetRotation: () => void
}

export function RotationControls({ image, onRotate, onFineRotationChange, onResetRotation }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onRotate('left')}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50 hover:text-accent-strong"
        >
          <RotateCcw size={15} /> Rotate left
        </button>
        <button
          type="button"
          onClick={() => onRotate('right')}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50 hover:text-accent-strong"
        >
          <RotateCw size={15} /> Rotate right
        </button>
        <button
          type="button"
          onClick={onResetRotation}
          className="ml-auto text-xs font-medium text-muted hover:text-accent-strong"
        >
          Reset rotation
        </button>
      </div>
      <label className="flex items-center gap-3 text-sm text-muted">
        <span className="w-20 shrink-0">Fine-tune</span>
        <input
          type="range"
          min={-45}
          max={45}
          step={0.5}
          value={image.edit.fineRotation}
          onChange={(e) => onFineRotationChange(Number(e.target.value), false)}
          onMouseUp={(e) => onFineRotationChange(Number((e.target as HTMLInputElement).value), true)}
          onTouchEnd={(e) => onFineRotationChange(Number((e.target as HTMLInputElement).value), true)}
          className="slider flex-1"
          aria-label="Fine rotation"
        />
        <span className="w-14 shrink-0 text-right tabular-nums">{image.edit.fineRotation.toFixed(1)}°</span>
      </label>
    </div>
  )
}
