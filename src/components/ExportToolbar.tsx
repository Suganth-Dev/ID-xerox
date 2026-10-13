import { useState } from 'react'
import { CheckCircle2, Download, Eye, Printer, FilePlus2 } from 'lucide-react'

interface Props {
  onPreview: () => void
  onDownload: () => Promise<void> | void
  onPrint: () => Promise<void> | void
  onNewJob: () => void
  generating: boolean
  hasPdf: boolean
  pageCount: number
}

export function ExportToolbar({ onPreview, onDownload, onPrint, onNewJob, generating, hasPdf, pageCount }: Props) {
  const [justDownloaded, setJustDownloaded] = useState(false)
  const [justPrinted, setJustPrinted] = useState(false)

  const handleDownload = async () => {
    await onDownload()
    setJustDownloaded(true)
    setTimeout(() => setJustDownloaded(false), 2500)
  }

  const handlePrint = async () => {
    await onPrint()
    setJustPrinted(true)
    setTimeout(() => setJustPrinted(false), 2500)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onPreview}
        disabled={generating}
        className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Eye size={16} /> {generating ? 'Generating…' : 'Generate / Preview PDF'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!hasPdf || generating}
          className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-40 ${
            justDownloaded ? 'border-success/40 bg-success-soft text-success' : 'border-border bg-surface text-ink enabled:hover:border-accent/50'
          }`}
        >
          {justDownloaded ? <CheckCircle2 size={15} /> : <Download size={15} />} {justDownloaded ? 'Downloaded' : 'Download'}
        </button>
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={!hasPdf || generating}
          className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-40 ${
            justPrinted ? 'border-success/40 bg-success-soft text-success' : 'border-border bg-surface text-ink enabled:hover:border-accent/50'
          }`}
        >
          {justPrinted ? <CheckCircle2 size={15} /> : <Printer size={15} />} {justPrinted ? 'Opened' : 'Print'}
        </button>
      </div>
      {hasPdf && <p className="text-center text-[11px] text-muted">{pageCount} page{pageCount > 1 ? 's' : ''} ready · print at 100% / actual size</p>}
      <button
        type="button"
        onClick={onNewJob}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted hover:text-danger"
      >
        <FilePlus2 size={13} /> Start new job
      </button>
    </div>
  )
}
