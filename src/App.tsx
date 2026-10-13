import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { UploadPanel } from './components/UploadPanel'
import { ImageEditor } from './components/ImageEditor'
import { LayoutSelector } from './components/LayoutSelector'
import { PageSettingsPanel } from './components/PageSettings'
import { PdfPreview } from './components/PdfPreview'
import { PageCanvas } from './components/PageCanvas'
import { ExportToolbar } from './components/ExportToolbar'
import { SavedJobsPanel } from './components/SavedJobsPanel'
import { SettingsDialog } from './components/SettingsDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ToastContainer } from './components/ToastContainer'
import { useImageEditor } from './hooks/useImageEditor'
import { useLocalSettings } from './hooks/useLocalSettings'
import { useSavedJobs } from './hooks/useSavedJobs'
import { useToast } from './hooks/useToast'
import { computeLayout, generatePdf, suggestFillSizeMm, type LayoutImageInput } from './services/pdfGenerator'
import { renderEditedImageWithSize } from './services/imageProcessing'
import { preloadCv } from './services/documentScan'
import type { ManualPlacement, PageSettings } from './types/layout'
import type { StoredImageRecord } from './types/job'
import { generatePdfFilename } from './utils/filenames'

function App() {
  const editor = useImageEditor()
  const toast = useToast()
  const localSettings = useLocalSettings()
  const savedJobs = useSavedJobs()

  useEffect(() => {
    preloadCv()
  }, [])

  const [pageSettings, setPageSettings] = useState<PageSettings>(() => ({ ...localSettings.settings.defaultPageSettings }))
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [savedJobsOpen, setSavedJobsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmNewJobOpen, setConfirmNewJobOpen] = useState(false)

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'arrange' | 'preview'>('edit')

  useEffect(() => {
    const root = document.documentElement
    if (localSettings.settings.theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', localSettings.settings.theme)
    }
  }, [localSettings.settings.theme])

  const activeImage = editor.getImage(editor.activeImageId)

  // Any change to an uploaded/edited image invalidates the cached PDF so Download/Print
  // can never silently serve an out-of-date export.
  useEffect(() => {
    setPdfBytes(null)
  }, [editor.images])

  const updatePageSettings = useCallback((patch: Partial<PageSettings>) => {
    setPageSettings((prev) => ({ ...prev, ...patch }))
    setPdfBytes(null)
  }, [])

  const layoutPreviewImages: LayoutImageInput[] = useMemo(
    () =>
      editor.images.map((img) => ({
        id: img.id,
        slot: img.slot,
        aspect: img.previewWidth / img.previewHeight,
        blob: img.originalBlob,
        mimeType: 'image/jpeg' as const,
      })),
    [editor.images],
  )

  const layoutPreview = useMemo(() => computeLayout(pageSettings, layoutPreviewImages), [pageSettings, layoutPreviewImages])

  // Always the *automatic* layout (ignoring any custom arrangement), used to seed the
  // interactive Arrange canvas when the user starts a custom arrangement.
  const autoLayoutPreview = useMemo(
    () => computeLayout({ ...pageSettings, manualPlacements: null }, layoutPreviewImages),
    [pageSettings, layoutPreviewImages],
  )

  const handleCommitPlacements = useCallback(
    (placements: ManualPlacement[]) => {
      updatePageSettings({ manualPlacements: placements })
    },
    [updatePageSettings],
  )

  const handleResetToAutoLayout = useCallback(() => {
    updatePageSettings({ manualPlacements: null })
  }, [updatePageSettings])

  const frontImage = editor.images.find((i) => i.slot === 'front') ?? null
  const backImage = editor.images.find((i) => i.slot === 'back') ?? null

  // While sizePreset is 'fill-page' (the default), keep imageWidthMm/imageHeightMm sized to
  // make good use of the printable area for the current layout/paper/images, instead of
  // leaving a tiny fixed box. Stops as soon as the user picks a different preset or edits
  // the size fields directly (which switches sizePreset to 'id-card' / 'custom').
  useEffect(() => {
    if (pageSettings.sizePreset !== 'fill-page') return
    const representative = frontImage ?? backImage
    if (!representative) return
    const suggestion = suggestFillSizeMm(pageSettings, representative.previewWidth / representative.previewHeight)
    if (!suggestion) return
    const widthClose = Math.abs(suggestion.widthMm - pageSettings.imageWidthMm) < 0.05
    const heightClose = Math.abs(suggestion.heightMm - pageSettings.imageHeightMm) < 0.05
    if (widthClose && heightClose) return
    setPageSettings((prev) => ({ ...prev, imageWidthMm: suggestion.widthMm, imageHeightMm: suggestion.heightMm }))
  }, [pageSettings, frontImage, backImage])

  const buildExportImages = useCallback(async (): Promise<LayoutImageInput[]> => {
    return Promise.all(
      editor.images.map(async (img) => {
        const rendered = await renderEditedImageWithSize(img.originalBlob, img.edit, 'image/jpeg', pageSettings.imageQuality)
        return {
          id: img.id,
          slot: img.slot,
          aspect: rendered.width / rendered.height,
          blob: rendered.blob,
          mimeType: 'image/jpeg' as const,
        }
      }),
    )
  }, [editor.images, pageSettings.imageQuality])

  const generate = useCallback(async (): Promise<Uint8Array | null> => {
    if (editor.images.length === 0) {
      toast.error('Upload at least one image before generating a PDF.')
      return null
    }
    setGenerating(true)
    try {
      const images = await buildExportImages()
      const result = await generatePdf(pageSettings, images)
      if (!result.bytes || result.bytes.byteLength === 0) {
        throw new Error('The generated PDF came back empty. Please try again.')
      }
      setPdfBytes(result.bytes)
      setPdfPageCount(result.pageCount)
      result.warnings.forEach((w) => toast.warning(w))
      return result.bytes
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate the PDF.')
      setPdfBytes(null)
      return null
    } finally {
      setGenerating(false)
    }
  }, [editor.images.length, buildExportImages, pageSettings, toast])

  const handlePreview = useCallback(async () => {
    const bytes = await generate()
    if (bytes) setViewMode('preview')
  }, [generate])

  const handleDownload = useCallback(async () => {
    try {
      const bytes = pdfBytes ?? (await generate())
      if (!bytes || bytes.byteLength === 0) {
        toast.error('No PDF to download yet. Click "Generate / Preview PDF" first.')
        return
      }
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      if (blob.size === 0) throw new Error('The PDF file came back empty.')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = generatePdfFilename()
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast.success('PDF downloaded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The download failed. Please try generating the PDF again.')
    }
  }, [pdfBytes, generate, toast])

  const handlePrint = useCallback(async () => {
    try {
      const bytes = pdfBytes ?? (await generate())
      if (!bytes || bytes.byteLength === 0) {
        toast.error('No PDF to print yet. Click "Generate / Preview PDF" first.')
        return
      }
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) {
        toast.error('Could not open the print window. Check your popup blocker, then try again.')
        URL.revokeObjectURL(url)
      } else {
        toast.info('Opened the PDF in a new tab — use its Print button, and set scale to 100% / Actual Size.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the PDF for printing.')
    }
  }, [pdfBytes, generate, toast])

  const resetJobState = useCallback(() => {
    editor.clearAll()
    setPageSettings({ ...localSettings.settings.defaultPageSettings })
    setPdfBytes(null)
    setPdfPageCount(0)
    setActiveJobId(null)
  }, [editor, localSettings.settings.defaultPageSettings])

  const handleNewJob = useCallback(() => {
    if (editor.images.length > 0) {
      setConfirmNewJobOpen(true)
    } else {
      resetJobState()
    }
  }, [editor.images.length, resetJobState])

  const handleSaveCurrentJob = useCallback(
    async (name: string) => {
      if (editor.images.length === 0) {
        toast.error('Nothing to save yet. Upload at least one image first.')
        return
      }
      const images: StoredImageRecord[] = editor.images.map((img) => ({
        id: img.id,
        slot: img.slot,
        fileName: img.fileName,
        mimeType: img.mimeType,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        blob: img.originalBlob,
        edit: img.edit,
      }))
      try {
        const saved = await savedJobs.saveJob({ id: activeJobId ?? undefined, name, pageSettings, images })
        setActiveJobId(saved.id)
        toast.success(`Job "${saved.name}" saved locally.`)
      } catch {
        toast.error('Could not save the job. Local storage may be full — try Settings → Delete all local data to free space.')
      }
    },
    [editor.images, activeJobId, pageSettings, savedJobs, toast],
  )

  const handleOpenJob = useCallback(
    async (id: string) => {
      try {
        const job = await savedJobs.openJob(id)
        if (!job) {
          toast.error('That saved job could not be found. It may have been deleted.')
          return
        }
        editor.loadManagedImages(job.images)
        setPageSettings(job.pageSettings)
        setActiveJobId(job.id)
        setPdfBytes(null)
        setSavedJobsOpen(false)
        toast.success(`Opened "${job.name}".`)
      } catch {
        toast.error('This saved job appears to be corrupted and could not be opened.')
      }
    },
    [savedJobs, editor, toast],
  )

  return (
    <div className="flex h-screen flex-col bg-app-bg">
      <Header onNewJob={handleNewJob} onOpenSavedJobs={() => setSavedJobsOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        <aside className="w-64 shrink-0 overflow-hidden rounded-xl border border-border bg-surface">
          <UploadPanel editor={editor} toast={toast} />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex shrink-0 items-center gap-1 rounded-lg border border-border bg-canvas p-1">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'edit' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Edit images
            </button>
            <button
              type="button"
              onClick={() => setViewMode('arrange')}
              className={`relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'arrange' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Arrange{pageSettings.manualPlacements ? ' (custom)' : ''}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'preview' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Print preview{pdfBytes ? ` (${pdfPageCount} page${pdfPageCount > 1 ? 's' : ''})` : ''}
              {!pdfBytes && editor.images.length > 0 && !generating && (
                <span
                  className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-warning"
                  title="Preview is out of date — regenerate to see your latest edits"
                />
              )}
            </button>
          </div>

          {viewMode === 'preview' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {pageSettings.sizePreset === 'id-card' && (
                <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-ink">
                  <span>
                    <strong>Image size is "ID card"</strong> — a small fixed wallet-card size, not a full page. That's why the image(s)
                    look small on the page.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const patch: Partial<PageSettings> = { sizePreset: 'fill-page' }
                      // Also fix the pairing orientation if it's fighting the photo's shape
                      // (e.g. a wide landscape card squeezed side-by-side on a narrow page).
                      if (pageSettings.layout === 'side-by-side' || pageSettings.layout === 'stacked') {
                        const representative = frontImage ?? backImage
                        const aspect = representative ? representative.previewWidth / representative.previewHeight : 1
                        patch.layout = aspect > 1.15 ? 'stacked' : 'side-by-side'
                      }
                      updatePageSettings(patch)
                    }}
                    className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Use full page instead
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1">
                <PdfPreview bytes={pdfBytes} generating={generating} onRegenerate={handlePreview} />
              </div>
            </div>
          ) : viewMode === 'arrange' ? (
            editor.images.length > 0 ? (
              <PageCanvas
                pageSettings={pageSettings}
                images={editor.images}
                autoLayout={autoLayoutPreview}
                onCommitPlacements={handleCommitPlacements}
                onResetToAuto={handleResetToAutoLayout}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
                <p className="text-sm font-medium text-ink">Nothing to arrange yet</p>
                <p className="max-w-xs text-xs">Upload a front or back image first, then come back here to drag and resize them directly on the page.</p>
              </div>
            )
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeImage ? (
                <ImageEditor image={activeImage} editor={editor} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
                  <p className="text-sm font-medium text-ink">No image selected</p>
                  <p className="max-w-xs text-xs">
                    Upload a front or back image on the left, or select an image from the thumbnail list to start editing. Everything is
                    processed locally on this computer.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-4">
          <LayoutSelector settings={pageSettings} images={editor.images} onChange={updatePageSettings} />
          <div className="h-px bg-border" />
          <PageSettingsPanel settings={pageSettings} onChange={updatePageSettings} layoutPreview={layoutPreview} />
          <div className="h-px bg-border" />
          <ExportToolbar
            onPreview={() => void handlePreview()}
            onDownload={handleDownload}
            onPrint={handlePrint}
            onNewJob={handleNewJob}
            generating={generating}
            hasPdf={pdfBytes !== null}
            pageCount={pdfPageCount}
          />
        </aside>
      </main>

      <SavedJobsPanel
        open={savedJobsOpen}
        onClose={() => setSavedJobsOpen(false)}
        savedJobs={savedJobs}
        hasCurrentWork={editor.images.length > 0}
        onSaveCurrent={handleSaveCurrentJob}
        onOpenJob={handleOpenJob}
        confirmBeforeDelete={localSettings.settings.confirmBeforeDeletingJobs}
      />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settingsApi={localSettings} savedJobs={savedJobs} toast={toast} />

      <ConfirmDialog
        open={confirmNewJobOpen}
        title="Start a new job?"
        message="Any unsaved images and edits in the current job will be discarded. Save the job first if you want to keep it."
        confirmLabel="Discard & start new"
        danger
        onCancel={() => setConfirmNewJobOpen(false)}
        onConfirm={() => {
          resetJobState()
          setConfirmNewJobOpen(false)
        }}
      />

      <ToastContainer toast={toast} />
    </div>
  )
}

export default App
