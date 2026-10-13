import { PDFDocument, type PDFImage } from 'pdf-lib'
import {
  GRID_SOURCE_PAIR_SIDE_BY_SIDE,
  GRID_SOURCE_PAIR_STACKED,
  resolvePaperSizeMm,
  type PageSettings,
} from '../types/layout'
import { mmToPoints } from '../utils/dimensions'

export interface LayoutImageInput {
  id: string
  slot: 'front' | 'back' | 'extra'
  /** aspect ratio (width / height) of the fully edited image */
  aspect: number
  /** already-rendered, edit-baked raster blob, JPEG or PNG */
  blob: Blob
  mimeType: 'image/jpeg' | 'image/png'
}

export interface PlacedItem {
  imageId: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export interface PageLayout {
  items: PlacedItem[]
}

export interface ComputedLayout {
  pageWidthMm: number
  pageHeightMm: number
  pages: PageLayout[]
  warnings: string[]
  unitsPerPage: number
  cols: number
  rows: number
}

interface UnitCell {
  imageId: string
  xOffsetMm: number
  yOffsetMm: number
  widthMm: number
  heightMm: number
}

interface Unit {
  widthMm: number
  heightMm: number
  cells: UnitCell[]
}

function fitAspect(boxW: number, boxH: number, aspect: number): { w: number; h: number } {
  const boxAspect = boxW / boxH
  if (aspect > boxAspect) {
    return { w: boxW, h: boxW / aspect }
  }
  return { w: boxH * aspect, h: boxH }
}

function buildUnit(
  settings: PageSettings,
  images: Map<string, LayoutImageInput>,
  printableW: number,
  printableH: number,
): { unit: Unit | null; error?: string } {
  const front = [...images.values()].find((i) => i.slot === 'front')
  const back = [...images.values()].find((i) => i.slot === 'back')

  const cellSize = (aspect: number) =>
    settings.fitMode === 'actual'
      ? { w: settings.imageWidthMm, h: settings.imageHeightMm }
      : fitAspect(settings.imageWidthMm, settings.imageHeightMm, aspect)

  const pairUnit = (direction: 'row' | 'col', a: LayoutImageInput, b: LayoutImageInput): Unit => {
    // In 'fill-page' mode, size each image independently to fully use its half of the
    // page using *its own* aspect ratio — rather than forcing both through one shared box
    // sized for only one of them, which leaves a gap whenever front/back aspects differ.
    let sizeA: { w: number; h: number }
    let sizeB: { w: number; h: number }
    if (settings.sizePreset === 'fill-page' && settings.fitMode === 'fit') {
      if (direction === 'row') {
        // Prioritize using the full page height first (the usual binding dimension for
        // tall ID-style documents placed side by side) — only shrink both if the combined
        // width overflows the page. Splitting the width in half up front (the old approach)
        // under-used the height whenever the documents were narrow relative to the page.
        const naturalA = { w: printableH * a.aspect, h: printableH }
        const naturalB = { w: printableH * b.aspect, h: printableH }
        const combinedW = naturalA.w + naturalB.w + settings.spacingMm
        if (combinedW > printableW) {
          const scale = printableW / combinedW
          sizeA = { w: naturalA.w * scale, h: naturalA.h * scale }
          sizeB = { w: naturalB.w * scale, h: naturalB.h * scale }
        } else {
          sizeA = naturalA
          sizeB = naturalB
        }
      } else {
        const boxH = Math.max(1, (printableH - settings.spacingMm) / 2)
        sizeA = fitAspect(printableW, boxH, a.aspect)
        sizeB = fitAspect(printableW, boxH, b.aspect)
      }
    } else {
      sizeA = cellSize(a.aspect)
      sizeB = cellSize(b.aspect)
    }
    if (direction === 'row') {
      const unitH = Math.max(sizeA.h, sizeB.h)
      return {
        widthMm: sizeA.w + sizeB.w + settings.spacingMm,
        heightMm: unitH,
        cells: [
          { imageId: a.id, xOffsetMm: 0, yOffsetMm: (unitH - sizeA.h) / 2, widthMm: sizeA.w, heightMm: sizeA.h },
          { imageId: b.id, xOffsetMm: sizeA.w + settings.spacingMm, yOffsetMm: (unitH - sizeB.h) / 2, widthMm: sizeB.w, heightMm: sizeB.h },
        ],
      }
    }
    const unitW = Math.max(sizeA.w, sizeB.w)
    return {
      widthMm: unitW,
      heightMm: sizeA.h + sizeB.h + settings.spacingMm,
      cells: [
        { imageId: a.id, xOffsetMm: (unitW - sizeA.w) / 2, yOffsetMm: 0, widthMm: sizeA.w, heightMm: sizeA.h },
        { imageId: b.id, xOffsetMm: (unitW - sizeB.w) / 2, yOffsetMm: sizeA.h + settings.spacingMm, widthMm: sizeB.w, heightMm: sizeB.h },
      ],
    }
  }

  const singleUnit = (img: LayoutImageInput): Unit => {
    const s = cellSize(img.aspect)
    return { widthMm: s.w, heightMm: s.h, cells: [{ imageId: img.id, xOffsetMm: 0, yOffsetMm: 0, widthMm: s.w, heightMm: s.h }] }
  }

  switch (settings.layout) {
    case 'front-only':
      if (!front) return { unit: null, error: 'Upload a front image to use this layout.' }
      return { unit: singleUnit(front) }
    case 'back-only':
      if (!back) return { unit: null, error: 'Upload a back image to use this layout.' }
      return { unit: singleUnit(back) }
    case 'side-by-side': {
      if (!front || !back) return { unit: null, error: 'Upload both front and back images to use this layout.' }
      const [a, b] = settings.swapFrontBack ? [back, front] : [front, back]
      return { unit: pairUnit('row', a, b) }
    }
    case 'stacked': {
      if (!front || !back) return { unit: null, error: 'Upload both front and back images to use this layout.' }
      const [a, b] = settings.swapFrontBack ? [back, front] : [front, back]
      return { unit: pairUnit('col', a, b) }
    }
    case 'grid': {
      if (settings.gridSource === GRID_SOURCE_PAIR_SIDE_BY_SIDE) {
        if (!front || !back) return { unit: null, error: 'Upload both front and back images to use this layout.' }
        const [a, b] = settings.swapFrontBack ? [back, front] : [front, back]
        return { unit: pairUnit('row', a, b) }
      }
      if (settings.gridSource === GRID_SOURCE_PAIR_STACKED) {
        if (!front || !back) return { unit: null, error: 'Upload both front and back images to use this layout.' }
        const [a, b] = settings.swapFrontBack ? [back, front] : [front, back]
        return { unit: pairUnit('col', a, b) }
      }
      const img = images.get(settings.gridSource)
      if (!img) return { unit: null, error: 'Select which image to repeat for this layout.' }
      return { unit: singleUnit(img) }
    }
    default:
      return { unit: null, error: 'Unknown layout.' }
  }
}

export function computeLayout(settings: PageSettings, imagesList: LayoutImageInput[]): ComputedLayout {
  const images = new Map(imagesList.map((i) => [i.id, i]))
  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = resolvePaperSizeMm(settings)
  const printableW = pageWidthMm - 2 * settings.marginMm
  const printableH = pageHeightMm - 2 * settings.marginMm
  const warnings: string[] = []
  const empty: ComputedLayout = { pageWidthMm, pageHeightMm, pages: [], warnings, unitsPerPage: 0, cols: 0, rows: 0 }

  if (settings.manualPlacements && settings.manualPlacements.length > 0) {
    const items: PlacedItem[] = settings.manualPlacements
      .filter((p) => images.has(p.imageId))
      .map((p) => ({ imageId: p.imageId, xMm: p.xMm, yMm: p.yMm, widthMm: p.widthMm, heightMm: p.heightMm }))
    if (items.length === 0) {
      warnings.push('Nothing to arrange yet.')
      return empty
    }
    return { pageWidthMm, pageHeightMm, pages: [{ items }], warnings, unitsPerPage: items.length, cols: 1, rows: 1 }
  }

  if (printableW <= 0 || printableH <= 0) {
    warnings.push('Margins are too large for the selected page size.')
    return empty
  }

  const { unit, error } = buildUnit(settings, images, printableW, printableH)
  if (!unit) {
    warnings.push(error ?? 'Nothing to arrange yet.')
    return empty
  }

  let unitW = unit.widthMm
  let unitH = unit.heightMm

  if (unitW > printableW || unitH > printableH) {
    if (settings.fitMode === 'fit') {
      const scale = Math.min(printableW / unitW, printableH / unitH)
      unitW *= scale
      unitH *= scale
      unit.cells.forEach((c) => {
        c.xOffsetMm *= scale
        c.yOffsetMm *= scale
        c.widthMm *= scale
        c.heightMm *= scale
      })
      warnings.push('The arrangement was scaled down to fit the printable area.')
    } else {
      warnings.push('The specified size is larger than the printable area. Reduce margins or switch to Fit mode.')
      return empty
    }
  }

  const maxCols = Math.max(1, Math.floor((printableW + settings.spacingMm) / (unitW + settings.spacingMm)))
  const maxRows = Math.max(1, Math.floor((printableH + settings.spacingMm) / (unitH + settings.spacingMm)))

  if ((settings.columns !== 'auto' && settings.columns > maxCols) || (settings.rows !== 'auto' && settings.rows > maxRows)) {
    warnings.push('The requested rows/columns do not fully fit the printable area; the layout was reduced to fit.')
  }

  // Capacity per page honoring any explicit (non-auto) rows/columns the user set.
  const capCols = settings.columns === 'auto' ? maxCols : Math.max(1, Math.min(settings.columns, maxCols))
  const capRows = settings.rows === 'auto' ? maxRows : Math.max(1, Math.min(settings.rows, maxRows))
  const perPageCapacity = capCols * capRows

  const totalUnits = Math.max(1, Math.round(settings.copies))
  const totalPages = Math.max(1, Math.ceil(totalUnits / perPageCapacity))

  if (totalPages > 1) {
    warnings.push(`${totalUnits} copies need ${totalPages} pages at up to ${capCols}×${capRows} per page.`)
  }

  const pages: PageLayout[] = []
  let remaining = totalUnits
  for (let p = 0; p < totalPages; p++) {
    const unitsThisPage = Math.min(perPageCapacity, remaining)

    // Pack only as many rows/columns as this page's units actually need — never reserve
    // a bigger grid than what's being placed, or items get shoved into a corner of empty space.
    const cols = settings.columns === 'auto' ? Math.max(1, Math.min(capCols, unitsThisPage)) : capCols
    const rows = settings.rows === 'auto' ? Math.max(1, Math.ceil(unitsThisPage / cols)) : capRows

    const blockW = cols * unitW + (cols - 1) * settings.spacingMm
    const blockH = rows * unitH + (rows - 1) * settings.spacingMm
    const blockX = settings.hAlign === 'left' ? 0 : settings.hAlign === 'right' ? printableW - blockW : (printableW - blockW) / 2
    const blockY = settings.vAlign === 'top' ? 0 : settings.vAlign === 'bottom' ? printableH - blockH : (printableH - blockH) / 2

    const items: PlacedItem[] = []
    for (let u = 0; u < unitsThisPage; u++) {
      const r = Math.floor(u / cols)
      const c = u % cols
      const originX = settings.marginMm + blockX + c * (unitW + settings.spacingMm)
      const originY = settings.marginMm + blockY + r * (unitH + settings.spacingMm)
      for (const cell of unit.cells) {
        items.push({
          imageId: cell.imageId,
          xMm: originX + cell.xOffsetMm,
          yMm: originY + cell.yOffsetMm,
          widthMm: cell.widthMm,
          heightMm: cell.heightMm,
        })
      }
    }
    pages.push({ items })
    remaining -= unitsThisPage
  }

  return { pageWidthMm, pageHeightMm, pages, warnings, unitsPerPage: perPageCapacity, cols: capCols, rows: capRows }
}

/**
 * Picks an imageWidthMm/imageHeightMm box that makes good use of the printable page for the
 * current layout, using `aspect` (the representative image's width/height) as the shape to
 * fit. Used to size images sensibly by default instead of defaulting to a tiny fixed box.
 */
export function suggestFillSizeMm(settings: PageSettings, aspect: number | null): { widthMm: number; heightMm: number } | null {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return null
  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = resolvePaperSizeMm(settings)
  const printableW = pageWidthMm - 2 * settings.marginMm
  const printableH = pageHeightMm - 2 * settings.marginMm
  if (printableW <= 0 || printableH <= 0) return null
  const spacing = settings.spacingMm

  const fit = (boxW: number, boxH: number) => {
    const boxAspect = boxW / boxH
    return aspect > boxAspect ? { w: boxW, h: boxW / aspect } : { w: boxH * aspect, h: boxH }
  }

  let box: { w: number; h: number }
  if (settings.layout === 'side-by-side' || (settings.layout === 'grid' && settings.gridSource === GRID_SOURCE_PAIR_SIDE_BY_SIDE)) {
    box = fit(Math.max(1, (printableW - spacing) / 2), printableH)
  } else if (settings.layout === 'stacked' || (settings.layout === 'grid' && settings.gridSource === GRID_SOURCE_PAIR_STACKED)) {
    box = fit(printableW, Math.max(1, (printableH - spacing) / 2))
  } else {
    box = fit(printableW, printableH)
  }

  return { widthMm: Math.round(box.w * 10) / 10, heightMm: Math.round(box.h * 10) / 10 }
}

export async function generatePdf(
  settings: PageSettings,
  imagesList: LayoutImageInput[],
): Promise<{ bytes: Uint8Array; warnings: string[]; pageCount: number }> {
  const layout = computeLayout(settings, imagesList)
  if (layout.pages.length === 0) {
    throw new Error(layout.warnings[0] ?? 'Nothing to export yet. Upload and arrange images first.')
  }

  const pdfDoc = await PDFDocument.create()
  const embedded = new Map<string, PDFImage>()
  const usedIds = new Set(layout.pages.flatMap((p) => p.items.map((i) => i.imageId)))

  for (const img of imagesList) {
    if (!usedIds.has(img.id)) continue
    const bytes = new Uint8Array(await img.blob.arrayBuffer())
    const embed = img.mimeType === 'image/png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
    embedded.set(img.id, embed)
  }

  for (const page of layout.pages) {
    const pdfPage = pdfDoc.addPage([mmToPoints(layout.pageWidthMm), mmToPoints(layout.pageHeightMm)])
    for (const item of page.items) {
      const embed = embedded.get(item.imageId)
      if (!embed) continue
      const xPt = mmToPoints(item.xMm)
      const wPt = mmToPoints(item.widthMm)
      const hPt = mmToPoints(item.heightMm)
      const yPt = mmToPoints(layout.pageHeightMm - item.yMm - item.heightMm)
      pdfPage.drawImage(embed, { x: xPt, y: yPt, width: wPt, height: hPt })
    }
  }

  const bytes = await pdfDoc.save()
  return { bytes, warnings: layout.warnings, pageCount: layout.pages.length }
}
