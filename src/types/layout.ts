export type PaperSizeName = 'A4' | 'A5' | 'A3' | 'Letter' | 'Legal' | 'Custom'

export interface PaperSize {
  name: PaperSizeName
  widthMm: number
  heightMm: number
}

export const PAPER_SIZES: Record<Exclude<PaperSizeName, 'Custom'>, PaperSize> = {
  A4: { name: 'A4', widthMm: 210, heightMm: 297 },
  A5: { name: 'A5', widthMm: 148, heightMm: 210 },
  A3: { name: 'A3', widthMm: 297, heightMm: 420 },
  Letter: { name: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  Legal: { name: 'Legal', widthMm: 215.9, heightMm: 355.6 },
}

export type Orientation = 'portrait' | 'landscape'

export type LayoutKind = 'side-by-side' | 'stacked' | 'front-only' | 'back-only' | 'grid'

/** For 'grid' layout: either a pair unit, or the id of a specific uploaded image to repeat. */
export const GRID_SOURCE_PAIR_SIDE_BY_SIDE = 'pair-side-by-side'
export const GRID_SOURCE_PAIR_STACKED = 'pair-stacked'

/** 'fit' = preserve each image's own aspect ratio within its cell (auto-shrinks the whole block to fit the page).
 *  'actual' = render at the exact specified mm size, stretching to fill the cell if needed; never auto-shrunk. */
export type FitMode = 'fit' | 'actual'
export type HAlign = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'center' | 'bottom'

/** 'fill-page' auto-sizes images to make good use of the printable area for the current layout (default).
 *  'id-card' is the fixed physical size of a standard plastic ID card. 'custom' is a manually set size. */
export type SizePreset = 'fill-page' | 'id-card' | 'custom'

export const ID_CARD_WIDTH_MM = 85.6
export const ID_CARD_HEIGHT_MM = 53.98

/** One explicitly placed item in a hand-arranged ("Canva-style") layout, overriding the automatic grid. */
export interface ManualPlacement {
  /** stable id for this placed instance (an image can appear more than once) */
  key: string
  imageId: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export interface PageSettings {
  paperSize: PaperSizeName
  customWidthMm: number
  customHeightMm: number
  orientation: Orientation
  marginMm: number
  spacingMm: number
  sizePreset: SizePreset
  imageWidthMm: number
  imageHeightMm: number
  fitMode: FitMode
  hAlign: HAlign
  vAlign: VAlign
  copies: number
  rows: number | 'auto'
  columns: number | 'auto'
  layout: LayoutKind
  /** 'pair-side-by-side' | 'pair-stacked' | a specific image id */
  gridSource: string
  swapFrontBack: boolean
  imageQuality: number // 0..1 JPEG quality for embedded raster
  /** When set, replaces the automatic single-page layout with these exact hand-placed items. */
  manualPlacements: ManualPlacement[] | null
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  paperSize: 'A4',
  customWidthMm: 210,
  customHeightMm: 297,
  orientation: 'portrait',
  marginMm: 10,
  spacingMm: 5,
  sizePreset: 'fill-page',
  imageWidthMm: 190,
  imageHeightMm: 277,
  fitMode: 'fit',
  hAlign: 'center',
  vAlign: 'top',
  copies: 1,
  rows: 'auto',
  columns: 'auto',
  layout: 'side-by-side',
  gridSource: GRID_SOURCE_PAIR_SIDE_BY_SIDE,
  swapFrontBack: false,
  imageQuality: 0.92,
  manualPlacements: null,
}

export function resolvePaperSizeMm(settings: PageSettings): { widthMm: number; heightMm: number } {
  const base =
    settings.paperSize === 'Custom'
      ? { widthMm: settings.customWidthMm, heightMm: settings.customHeightMm }
      : { widthMm: PAPER_SIZES[settings.paperSize].widthMm, heightMm: PAPER_SIZES[settings.paperSize].heightMm }

  const portraitWidth = Math.min(base.widthMm, base.heightMm)
  const portraitHeight = Math.max(base.widthMm, base.heightMm)

  if (settings.orientation === 'portrait') {
    return { widthMm: portraitWidth, heightMm: portraitHeight }
  }
  return { widthMm: portraitHeight, heightMm: portraitWidth }
}
