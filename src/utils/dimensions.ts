export const MM_PER_INCH = 25.4
export const POINTS_PER_INCH = 72

export function mmToPoints(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH
}

export function pointsToMm(points: number): number {
  return (points / POINTS_PER_INCH) * MM_PER_INCH
}

export function pxToMmAtDpi(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH
}

/** Fit a box of given aspect into a bounding box, preserving aspect ratio. */
export function fitWithinBox(
  contentWidth: number,
  contentHeight: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(boxWidth / contentWidth, boxHeight / contentHeight)
  return { width: contentWidth * scale, height: contentHeight * scale }
}

export function formatMm(value: number): string {
  return `${value.toFixed(1)} mm`
}
