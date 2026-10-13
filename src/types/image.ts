import type { Quad } from './geometry'

export type ImageSlot = 'front' | 'back' | 'extra'

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 'idle' — scan hasn't run yet. 'detecting' — running now. 'detected' — a confident
 * boundary was found and applied automatically. 'needs-review' — detection failed or was
 * low-confidence; the full photo is shown until the user adjusts corners manually or skips.
 * 'manual' — the user set/adjusted the corners themselves. 'skipped' — user chose to use
 * the full photo without perspective correction.
 */
export type ScanStatus = 'idle' | 'detecting' | 'detected' | 'needs-review' | 'manual' | 'skipped'

export interface ImageEditState {
  /** four document corners in the *original* image's pixel space, or null for no perspective correction */
  documentCorners: Quad | null
  scanStatus: ScanStatus
  /** CLAHE-based automatic brightness/contrast correction, applied before the manual sliders below */
  autoEnhance: boolean
  /** crop rectangle in the *rotated* (post-perspective-correction) image's pixel space, from react-easy-crop */
  crop: CropArea | null
  /** zoom used while cropping (informational, crop already bakes zoom in via crop area) */
  zoom: number
  /** coarse rotation in degrees, multiple of 90 */
  rotation: 0 | 90 | 180 | 270
  /** fine rotation in degrees, -45..45, applied in addition to coarse rotation */
  fineRotation: number
  flipH: boolean
  flipV: boolean
  brightness: number // -100..100
  contrast: number // -100..100
  grayscale: boolean
  aspect: number | null // locked aspect ratio for cropping, null = free
}

export const DEFAULT_EDIT_STATE: ImageEditState = {
  documentCorners: null,
  scanStatus: 'idle',
  autoEnhance: false,
  crop: null,
  zoom: 1,
  rotation: 0,
  fineRotation: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  grayscale: false,
  aspect: null,
}

export interface ManagedImage {
  id: string
  slot: ImageSlot
  fileName: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
  /** original, never-mutated source blob */
  originalBlob: Blob
  /** object URL for originalBlob, created lazily */
  originalUrl: string
  edit: ImageEditState
  /** undo/redo history of edit states */
  history: ImageEditState[]
  historyIndex: number
  /** cached rendered preview url reflecting current edit state */
  previewUrl: string | null
  /** pixel dimensions of the rendered preview (post rotate/crop), used for layout aspect calculations */
  previewWidth: number
  previewHeight: number
  createdAt: number
}

export const MAX_HISTORY = 25
