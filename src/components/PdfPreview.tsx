import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { loadPdf, renderPageToCanvas } from '../services/pdfPreview'
import type { PDFDocumentProxy } from 'pdfjs-dist'

interface Props {
  bytes: Uint8Array | null
  generating: boolean
  onRegenerate?: () => void
}

export function PdfPreview({ bytes, generating, onRegenerate }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fitToScreen = async (targetDoc: PDFDocumentProxy, targetPage: number) => {
    if (!containerRef.current) return
    const page = await targetDoc.getPage(targetPage)
    const viewport = page.getViewport({ scale: 1 })
    const available = containerRef.current.clientWidth - 32
    const availableHeight = containerRef.current.clientHeight - 32
    setScale(Math.max(0.2, Math.min(available / viewport.width, availableHeight / viewport.height)))
  }

  useEffect(() => {
    if (!bytes) {
      setDoc(null)
      return
    }
    let cancelled = false
    loadPdf(bytes).then((loaded) => {
      if (!cancelled) {
        setDoc(loaded.doc)
        setPageNumber((prev) => Math.min(prev, loaded.numPages))
        void fitToScreen(loaded.doc, 1)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes])

  useEffect(() => {
    if (!doc || !canvasRef.current) return
    void renderPageToCanvas(doc, pageNumber, canvasRef.current, scale)
  }, [doc, pageNumber, scale])

  if (generating) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        Generating PDF…
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-canvas text-center text-sm text-muted">
        <p className="max-w-xs">
          No print preview yet. This shows the exact PDF that will be downloaded or printed — generate it to check the layout before
          exporting.
        </p>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Generate preview
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="rounded-md p-1 text-ink disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs tabular-nums text-muted">
            Page {pageNumber} / {doc.numPages}
          </span>
          <button
            type="button"
            disabled={pageNumber >= doc.numPages}
            onClick={() => setPageNumber((p) => Math.min(doc.numPages, p + 1))}
            className="rounded-md p-1 text-ink disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setScale((s) => Math.max(0.2, s - 0.2))} className="rounded-md p-1 text-ink" aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-muted">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale((s) => Math.min(4, s + 0.2))} className="rounded-md p-1 text-ink" aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button type="button" onClick={() => void fitToScreen(doc, pageNumber)} className="rounded-md p-1 text-ink" aria-label="Fit to screen">
            <Maximize2 size={16} />
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="ml-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:border-accent/50"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto rounded-lg border border-border bg-canvas p-4">
        <canvas ref={canvasRef} className="mx-auto block shadow-lg" />
      </div>
    </div>
  )
}
