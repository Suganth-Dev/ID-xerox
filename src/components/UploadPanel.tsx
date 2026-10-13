import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import type { ImageEditorApi } from '../hooks/useImageEditor'
import type { ImageSlot } from '../types/image'
import { ImageThumbnail } from './ImageThumbnail'
import type { ToastApi } from '../hooks/useToast'

interface Props {
  editor: ImageEditorApi
  toast: ToastApi
}

function SlotDropzone({
  label,
  slot,
  editor,
  toast,
}: {
  label: string
  slot: 'front' | 'back'
  editor: ImageEditorApi
  toast: ToastApi
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const image = editor.images.find((i) => i.slot === slot) ?? null

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const result = await editor.addImages(Array.from(files).slice(0, 1), slot)
      result.errors.forEach((e) => toast.error(e))
      if (result.added.length > 0) toast.success(`${label} image uploaded.`)
    },
    [editor, slot, label, toast],
  )

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {image ? (
        <ImageThumbnail
          image={image}
          active={editor.activeImageId === image.id}
          onSelect={() => editor.setActiveImageId(image.id)}
          onRemove={() => editor.removeImage(image.id)}
          onReplace={(file) => void handleFiles([file])}
        />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files)
          }}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-6 text-center transition-colors ${
            dragOver ? 'border-accent bg-accent-soft' : 'border-border-strong bg-canvas hover:border-accent/50'
          }`}
        >
          <Upload size={20} className="text-muted" />
          <span className="text-xs font-medium text-ink">Upload or drop {label.toLowerCase()}</span>
          <span className="text-[11px] text-muted">JPG, PNG, WebP</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </button>
      )}
    </div>
  )
}

export function UploadPanel({ editor, toast }: Props) {
  const [dragOverExtra, setDragOverExtra] = useState(false)
  const extraInputRef = useRef<HTMLInputElement>(null)
  const extras = editor.images.filter((i) => i.slot === 'extra')

  const handleExtraFiles = useCallback(
    async (files: FileList | File[]) => {
      const slot: ImageSlot = 'extra'
      const result = await editor.addImages(Array.from(files), slot)
      result.errors.forEach((e) => toast.error(e))
      if (result.added.length > 0) toast.success(`${result.added.length} image(s) added.`)
    },
    [editor, toast],
  )

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <SlotDropzone label="Front image" slot="front" editor={editor} toast={toast} />
      <SlotDropzone label="Back image" slot="back" editor={editor} toast={toast} />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Additional documents</p>
          <button
            type="button"
            onClick={() => extraInputRef.current?.click()}
            className="flex items-center gap-1 text-xs font-medium text-accent-strong hover:underline"
          >
            <ImagePlus size={13} /> Add image
          </button>
          <input
            ref={extraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleExtraFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverExtra(true)
          }}
          onDragLeave={() => setDragOverExtra(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOverExtra(false)
            if (e.dataTransfer.files.length) void handleExtraFiles(e.dataTransfer.files)
          }}
          className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-2 transition-colors ${
            dragOverExtra ? 'border-accent bg-accent-soft' : 'border-transparent'
          }`}
        >
          {extras.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-strong bg-canvas p-3 text-center text-[11px] text-muted">
              Drop extra documents here
            </p>
          ) : (
            extras.map((img) => (
              <ImageThumbnail
                key={img.id}
                image={img}
                active={editor.activeImageId === img.id}
                onSelect={() => editor.setActiveImageId(img.id)}
                onRemove={() => editor.removeImage(img.id)}
                onReplace={(file) => void editor.replaceImage(img.id, file)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
