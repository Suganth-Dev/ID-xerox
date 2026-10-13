import { CheckCircle2, Crop, Loader2, ScanLine, Sparkle, TriangleAlert, Undo2 } from 'lucide-react'
import type { ManagedImage } from '../types/image'
import type { ImageEditorApi } from '../hooks/useImageEditor'

interface Props {
  image: ManagedImage
  editor: ImageEditorApi
  onAdjustCorners: () => void
}

export function DocumentScanPanel({ image, editor, onAdjustCorners }: Props) {
  const { scanStatus } = image.edit

  const statusLabel = (): { text: string; tone: 'muted' | 'success' | 'warning'; icon: React.ReactNode } => {
    switch (scanStatus) {
      case 'detecting':
        return { text: 'Scanning document…', tone: 'muted', icon: <Loader2 size={14} className="animate-spin" /> }
      case 'detected':
        return { text: 'Document detected and straightened automatically', tone: 'success', icon: <CheckCircle2 size={14} /> }
      case 'manual':
        return { text: 'Corners adjusted manually', tone: 'success', icon: <CheckCircle2 size={14} /> }
      case 'skipped':
        return { text: 'Using the full photo — no perspective correction applied', tone: 'muted', icon: <ScanLine size={14} /> }
      case 'needs-review':
        return { text: "Couldn't confidently find the document edges — please adjust the corners", tone: 'warning', icon: <TriangleAlert size={14} /> }
      default:
        return { text: 'Not scanned yet', tone: 'muted', icon: <ScanLine size={14} /> }
    }
  }

  const status = statusLabel()
  const toneClass =
    status.tone === 'success' ? 'text-success' : status.tone === 'warning' ? 'text-warning' : 'text-muted'

  return (
    <div className="rounded-lg border border-border bg-canvas p-3">
      <div className={`flex items-center gap-2 text-xs font-medium ${toneClass}`}>
        {status.icon}
        {status.text}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => editor.rescan(image.id)}
          disabled={scanStatus === 'detecting'}
          className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink disabled:opacity-50 enabled:hover:border-accent/50"
        >
          <ScanLine size={13} /> {image.edit.documentCorners ? 'Re-scan' : 'Auto-scan'}
        </button>
        <button
          type="button"
          onClick={onAdjustCorners}
          className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-accent/50"
        >
          <Crop size={13} /> Adjust corners manually
        </button>
        {(image.edit.documentCorners || scanStatus === 'needs-review') && (
          <button
            type="button"
            onClick={() => editor.skipScan(image.id)}
            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
          >
            <Undo2 size={13} /> Use full photo
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-ink">
          <input
            type="checkbox"
            checked={image.edit.autoEnhance}
            onChange={(e) => editor.updateEdit(image.id, { autoEnhance: e.target.checked }, { commit: true })}
          />
          <Sparkle size={13} /> Auto enhance
        </label>
      </div>
    </div>
  )
}
