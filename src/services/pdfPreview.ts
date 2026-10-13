import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export interface LoadedPdf {
  numPages: number
  doc: pdfjsLib.PDFDocumentProxy
}

export async function loadPdf(bytes: Uint8Array): Promise<LoadedPdf> {
  // pdf.js transfers (detaches) the underlying ArrayBuffer to its worker for zero-copy
  // loading. Hand it a private copy so the caller's original bytes stay intact and can
  // still be used for Download/Print after a Preview.
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  return { numPages: doc.numPages, doc }
}

// pdf.js throws if render() is called on a canvas that already has a render in flight
// (e.g. one triggered by a doc/page change, immediately followed by a scale change from
// "fit to screen"). Track the in-flight task per canvas and cancel it before starting a new one.
const activeRenderTasks = new WeakMap<HTMLCanvasElement, ReturnType<pdfjsLib.PDFPageProxy['render']>>()

export async function renderPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const existing = activeRenderTasks.get(canvas)
  if (existing) {
    existing.cancel()
  }

  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  const task = page.render({ canvasContext: ctx, viewport, canvas })
  activeRenderTasks.set(canvas, task)
  try {
    await task.promise
  } catch (err) {
    // RenderingCancelledException from our own cancel() above is expected — ignore it.
    const name = err && typeof err === 'object' && 'name' in err ? (err as { name?: string }).name : undefined
    if (name !== 'RenderingCancelledException') throw err
  } finally {
    if (activeRenderTasks.get(canvas) === task) {
      activeRenderTasks.delete(canvas)
    }
  }
}
