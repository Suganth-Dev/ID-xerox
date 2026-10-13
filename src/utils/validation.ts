export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
export const MIN_DIMENSION_PX = 64
export const MAX_DIMENSION_PX = 10000

export interface ValidationResult {
  ok: boolean
  error?: string
}

export function validateFile(file: File): ValidationResult {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: `"${file.name}" is not a supported image type. Use JPG, PNG, or WebP.` }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, error: `"${file.name}" is ${mb} MB, which is larger than the 25 MB limit.` }
  }
  if (file.size === 0) {
    return { ok: false, error: `"${file.name}" appears to be empty or corrupted.` }
  }
  return { ok: true }
}

export function validateDimensions(width: number, height: number, fileName: string): ValidationResult {
  if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
    return { ok: false, error: `"${fileName}" is too small (${width}x${height}px). Minimum is ${MIN_DIMENSION_PX}px.` }
  }
  if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
    return { ok: false, error: `"${fileName}" is too large (${width}x${height}px). Maximum is ${MAX_DIMENSION_PX}px per side.` }
  }
  return { ok: true }
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image file could not be decoded. It may be corrupted or in an unsupported format.'))
    img.src = url
  })
}

export function validateCustomDimensionMm(value: number, label: string): ValidationResult {
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `${label} must be a positive number.` }
  }
  if (value > 2000) {
    return { ok: false, error: `${label} is unreasonably large.` }
  }
  return { ok: true }
}
