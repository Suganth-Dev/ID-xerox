import type { CropArea, ImageEditState } from '../types/image'
import { warpDocument, autoEnhanceCanvas } from './documentScan'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image could not be decoded. It may be corrupted or in an unsupported format.'))
    img.src = src
  })
}

export async function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function getNaturalDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const img = await createImageFromBlob(blob)
  return { width: img.naturalWidth, height: img.naturalHeight }
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function rotatedBoundingBox(width: number, height: number, rotationDeg: number) {
  const rad = degToRad(rotationDeg)
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  }
}

/** Draws `source` (w x h) rotated by rotationDeg into a canvas sized to its bounding box. */
function renderRotatedToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  rotationDeg: number,
): HTMLCanvasElement {
  const { width: bw, height: bh } = rotatedBoundingBox(sourceWidth, sourceHeight, rotationDeg)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bw))
  canvas.height = Math.max(1, Math.round(bh))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(degToRad(rotationDeg))
  ctx.drawImage(source, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight)
  return canvas
}

function cropCanvas(source: HTMLCanvasElement, area: CropArea): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width))
  canvas.height = Math.max(1, Math.round(area.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(
    source,
    Math.round(area.x),
    Math.round(area.y),
    Math.round(area.width),
    Math.round(area.height),
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas
}

function applyFlip(source: HTMLCanvasElement, edit: ImageEditState): HTMLCanvasElement {
  if (!edit.flipH && !edit.flipV) return source
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1)
  ctx.drawImage(source, -canvas.width / 2, -canvas.height / 2)
  return canvas
}

function applyColorFilters(source: HTMLCanvasElement, edit: ImageEditState): HTMLCanvasElement {
  if (edit.brightness === 0 && edit.contrast === 0 && !edit.grayscale) return source
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  const brightnessPct = Math.max(0, 100 + edit.brightness)
  const contrastPct = Math.max(0, 100 + edit.contrast)
  const filters = [`brightness(${brightnessPct}%)`, `contrast(${contrastPct}%)`]
  if (edit.grayscale) filters.push('grayscale(100%)')
  ctx.filter = filters.join(' ')
  ctx.drawImage(source, 0, 0)
  return canvas
}

/**
 * Full non-destructive render pipeline:
 * document perspective correction -> rotate -> crop -> flip -> auto-enhance -> brightness/contrast/grayscale.
 */
export async function renderEditedCanvas(blob: Blob, edit: ImageEditState): Promise<HTMLCanvasElement> {
  let base: HTMLCanvasElement | HTMLImageElement
  let baseWidth: number
  let baseHeight: number

  if (edit.documentCorners) {
    try {
      base = await warpDocument(blob, edit.documentCorners)
      baseWidth = base.width
      baseHeight = base.height
    } catch (err) {
      console.warn('Perspective correction failed, falling back to unwarped photo:', err)
      // perspective correction failed (e.g. OpenCV unavailable) — fall back to the unwarped photo
      base = await createImageFromBlob(blob)
      baseWidth = base.naturalWidth
      baseHeight = base.naturalHeight
    }
  } else {
    base = await createImageFromBlob(blob)
    baseWidth = base.naturalWidth
    baseHeight = base.naturalHeight
  }

  const totalRotation = edit.rotation + edit.fineRotation
  const rotated = renderRotatedToCanvas(base, baseWidth, baseHeight, totalRotation)
  const cropped = edit.crop ? cropCanvas(rotated, edit.crop) : rotated
  const flipped = applyFlip(cropped, edit)

  let enhanced = flipped
  if (edit.autoEnhance) {
    try {
      enhanced = await autoEnhanceCanvas(flipped)
    } catch {
      // auto-enhance failed (e.g. OpenCV unavailable) — continue with the un-enhanced image
    }
  }

  return applyColorFilters(enhanced, edit)
}

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to export the edited image.'))
      },
      mimeType,
      quality,
    )
  })
}

export async function renderEditedImage(
  blob: Blob,
  edit: ImageEditState,
  mimeType = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  const canvas = await renderEditedCanvas(blob, edit)
  return canvasToBlob(canvas, mimeType, quality)
}

export async function renderEditedImageWithSize(
  blob: Blob,
  edit: ImageEditState,
  mimeType = 'image/jpeg',
  quality = 0.92,
): Promise<{ blob: Blob; width: number; height: number }> {
  const canvas = await renderEditedCanvas(blob, edit)
  const outBlob = await canvasToBlob(canvas, mimeType, quality)
  return { blob: outBlob, width: canvas.width, height: canvas.height }
}
