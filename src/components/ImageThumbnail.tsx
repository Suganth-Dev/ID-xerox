import { Trash2, RefreshCcw } from 'lucide-react'
import type { ManagedImage } from '../types/image'

interface Props {
  image: ManagedImage
  active: boolean
  onSelect: () => void
  onRemove: () => void
  onReplace: (file: File) => void
}

export function ImageThumbnail({ image, active, onSelect, onRemove, onReplace }: Props) {
  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border p-2 transition-colors ${
        active ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-accent/40'
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <img
          src={image.previewUrl ?? image.originalUrl}
          alt={image.fileName}
          className="h-12 w-16 shrink-0 rounded-md border border-border object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-ink">{image.fileName}</span>
          <span className="block text-[11px] text-muted">
            {image.naturalWidth}×{image.naturalHeight}px
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <label className="cursor-pointer rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink" title="Replace image">
          <RefreshCcw size={14} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onReplace(file)
              e.target.value = ''
            }}
          />
        </label>
        <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-muted hover:bg-danger-soft hover:text-danger" title="Remove image">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
