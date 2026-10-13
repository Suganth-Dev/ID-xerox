import { useEffect, useState } from 'react'
import { Redo2, Undo2, RotateCcw as ResetIcon } from 'lucide-react'
import type { ManagedImage } from '../types/image'
import type { ImageEditorApi } from '../hooks/useImageEditor'
import { CropEditor } from './CropEditor'
import { RotationControls } from './RotationControls'
import { ImageAdjustmentControls } from './ImageAdjustmentControls'
import { DocumentScanPanel } from './DocumentScanPanel'
import { DocumentCornerEditor } from './DocumentCornerEditor'
import { warpDocument } from '../services/documentScan'
import { canvasToBlob } from '../services/imageProcessing'

interface Props {
  image: ManagedImage
  editor: ImageEditorApi
}

/** The source the crop tool should operate on: the perspective-corrected document when scanned, else the raw photo. */
function useCropSource(image: ManagedImage) {
  const [scanned, setScanned] = useState<{ url: string; width: number; height: number } | null>(null)

  useEffect(() => {
    if (!image.edit.documentCorners) {
      setScanned(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    warpDocument(image.originalBlob, image.edit.documentCorners)
      .then(async (canvas) => ({ blob: await canvasToBlob(canvas, 'image/jpeg', 0.95), width: canvas.width, height: canvas.height }))
      .then(({ blob, width, height }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setScanned((prev) => {
          if (prev) URL.revokeObjectURL(prev.url)
          return { url: objectUrl!, width, height }
        })
      })
      .catch(() => {
        if (!cancelled) setScanned(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [image.originalBlob, image.edit.documentCorners])

  if (scanned) return scanned
  return { url: image.originalUrl, width: image.naturalWidth, height: image.naturalHeight }
}

export function ImageEditor({ image, editor }: Props) {
  const { updateEdit, undo, redo, resetEdit } = editor
  const [cornerEditorOpen, setCornerEditorOpen] = useState(false)
  const cropSource = useCropSource(image)

  const canUndo = image.historyIndex > 0
  const canRedo = image.historyIndex < image.history.length - 1

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="truncate text-sm font-semibold text-ink" title={image.fileName}>
            {image.fileName}
          </h2>
          <p className="text-xs text-muted">
            Original {image.naturalWidth}×{image.naturalHeight}px · Edited {image.previewWidth}×{image.previewHeight}px
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => undo(image.id)}
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accent/50"
            aria-label="Undo"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => redo(image.id)}
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accent/50"
            aria-label="Redo"
          >
            <Redo2 size={14} /> Redo
          </button>
          <button
            type="button"
            onClick={() => resetEdit(image.id)}
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-danger hover:border-danger/50"
            aria-label="Reset to original"
          >
            <ResetIcon size={14} /> Reset
          </button>
        </div>
      </div>

      <DocumentScanPanel image={image} editor={editor} onAdjustCorners={() => setCornerEditorOpen(true)} />

      <CropEditor
        key={`${image.id}-${image.edit.documentCorners ? 'scanned' : 'original'}`}
        image={image}
        sourceUrl={cropSource.url}
        sourceWidth={cropSource.width}
        sourceHeight={cropSource.height}
        onLiveChange={({ crop, zoom }) => updateEdit(image.id, { crop, zoom }, { commit: false })}
        onCommit={() => updateEdit(image.id, {}, { commit: true })}
        onAspectChange={(aspect) => updateEdit(image.id, { aspect, crop: null }, { commit: true })}
      />

      <div className="h-px bg-border" />

      <RotationControls
        image={image}
        onRotate={(direction) => {
          const delta = direction === 'left' ? -90 : 90
          const next = (((image.edit.rotation + delta) % 360) + 360) % 360
          updateEdit(image.id, { rotation: next as 0 | 90 | 180 | 270, crop: null }, { commit: true })
        }}
        onFineRotationChange={(deg, commit) => updateEdit(image.id, { fineRotation: deg, crop: null }, { commit })}
        onResetRotation={() => updateEdit(image.id, { rotation: 0, fineRotation: 0, crop: null }, { commit: true })}
      />

      <div className="h-px bg-border" />

      <ImageAdjustmentControls
        image={image}
        onFlip={(axis) => updateEdit(image.id, axis === 'h' ? { flipH: !image.edit.flipH } : { flipV: !image.edit.flipV }, { commit: true })}
        onAdjust={(patch, commit) => updateEdit(image.id, patch, { commit })}
        onGrayscaleToggle={() => updateEdit(image.id, { grayscale: !image.edit.grayscale }, { commit: true })}
      />

      {cornerEditorOpen && (
        <DocumentCornerEditor
          image={image}
          initialCorners={image.edit.documentCorners}
          onCancel={() => setCornerEditorOpen(false)}
          onApply={(corners) => {
            editor.applyManualCorners(image.id, corners)
            setCornerEditorOpen(false)
          }}
        />
      )}
    </div>
  )
}
