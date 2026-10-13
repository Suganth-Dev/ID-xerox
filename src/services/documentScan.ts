import type { Point, Quad } from '../types/geometry'

// The opencv.js TypeScript declarations ship as a best-effort (see the package's own
// README: "may not be up to date with the latest OpenCV.js"), so we treat `cv` as `any`
// internally and keep our own functions' public signatures strongly typed instead.
let cvPromise: Promise<any> | null = null

async function getCv(): Promise<any> {
  if (!cvPromise) {
    cvPromise = (async () => {
      const mod = await import('@techstark/opencv-js')
      const cvModule: any = mod.default ?? mod
      if (cvModule instanceof Promise) {
        return cvModule
      }
      if (cvModule.Mat) {
        return cvModule
      }
      await new Promise<void>((resolve) => {
        cvModule.onRuntimeInitialized = () => resolve()
      })
      return cvModule
    })()
  }
  return cvPromise
}

/** Call once (e.g. on app start) to warm up the ~13 MB OpenCV.js runtime in the background. */
export function preloadCv(): void {
  void getCv().catch(() => {
    // ignored — detection will simply report "unavailable" when actually invoked
  })
}

export async function isCvAvailable(): Promise<boolean> {
  try {
    await getCv()
    return true
  } catch {
    return false
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function orderCorners(pts: Point[]): Quad {
  const sum = (p: Point) => p.x + p.y
  const diff = (p: Point) => p.y - p.x
  const tl = pts.reduce((a, b) => (sum(a) < sum(b) ? a : b))
  const br = pts.reduce((a, b) => (sum(a) > sum(b) ? a : b))
  const tr = pts.reduce((a, b) => (diff(a) < diff(b) ? a : b))
  const bl = pts.reduce((a, b) => (diff(a) > diff(b) ? a : b))
  return [tl, tr, br, bl]
}

function angleAt(prev: Point, corner: Point, next: Point): number {
  const v1 = { x: prev.x - corner.x, y: prev.y - corner.y }
  const v2 = { x: next.x - corner.x, y: next.y - corner.y }
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / mag))
  return (Math.acos(cos) * 180) / Math.PI
}

/** 0..1 — how close the quad is to a "nice" rectangle (square-ish corners, matching opposite sides). */
function rectangularityScore(q: Quad): number {
  const [tl, tr, br, bl] = q
  const angles = [angleAt(bl, tl, tr), angleAt(tl, tr, br), angleAt(tr, br, bl), angleAt(br, bl, tl)]
  const angleScore = angles.reduce((acc, a) => acc + Math.max(0, 1 - Math.abs(a - 90) / 45), 0) / 4

  const topW = dist(tl, tr)
  const botW = dist(bl, br)
  const leftH = dist(tl, bl)
  const rightH = dist(tr, br)
  const wRatio = Math.min(topW, botW) / (Math.max(topW, botW) || 1)
  const hRatio = Math.min(leftH, rightH) / (Math.max(leftH, rightH) || 1)

  return angleScore * 0.6 + wRatio * 0.2 + hRatio * 0.2
}

export interface DetectionResult {
  corners: Quad
  confidence: number
}

const WORKING_MAX_DIM = 900
const MIN_AREA_FRACTION = 0.15
const MAX_AREA_FRACTION = 0.98
const MIN_CONFIDENCE = 0.55

/**
 * Attempts to find a document-shaped quadrilateral in the image. Returns null when no
 * confident boundary is found (caller should fall back to manual corner adjustment).
 */
export async function detectDocumentCorners(img: HTMLImageElement): Promise<DetectionResult | null> {
  const cv = await getCv()

  const scale = Math.min(1, WORKING_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
  const workW = Math.max(1, Math.round(img.naturalWidth * scale))
  const workH = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = workW
  canvas.height = workH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, workW, workH)

  const src = cv.imread(canvas)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const dilated = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)

  let best: { quad: Quad; score: number } | null = null

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    cv.Canny(blurred, edges, 50, 150)
    cv.dilate(edges, dilated, kernel, new cv.Point(-1, -1), 1)
    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    const imgArea = workW * workH

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i)
      const area = cv.contourArea(cnt)
      if (area < imgArea * MIN_AREA_FRACTION || area > imgArea * MAX_AREA_FRACTION) {
        cnt.delete()
        continue
      }

      const peri = cv.arcLength(cnt, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true)

      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const pts: Point[] = []
        for (let j = 0; j < 4; j++) {
          pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] })
        }
        const ordered = orderCorners(pts)
        const score = (area / imgArea) * 0.4 + rectangularityScore(ordered) * 0.6
        if (!best || score > best.score) {
          best = { quad: ordered, score }
        }
      }
      approx.delete()
      cnt.delete()
    }
  } finally {
    src.delete()
    gray.delete()
    blurred.delete()
    edges.delete()
    dilated.delete()
    contours.delete()
    hierarchy.delete()
    kernel.delete()
  }

  if (!best || best.score < MIN_CONFIDENCE) return null

  const invScale = 1 / scale
  const corners = best.quad.map((p) => ({ x: p.x * invScale, y: p.y * invScale })) as Quad

  return { corners, confidence: Math.min(1, best.score) }
}

async function warpDocumentUncached(blob: Blob, corners: Quad): Promise<HTMLCanvasElement> {
  const cv = await getCv()
  const url = URL.createObjectURL(blob)
  let img: HTMLImageElement
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not load the image for perspective correction.'))
      el.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = img.naturalWidth
  srcCanvas.height = img.naturalHeight
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) throw new Error('Canvas 2D context unavailable')
  srcCtx.drawImage(img, 0, 0)

  const [tl, tr, br, bl] = corners
  const outW = Math.max(1, Math.round(Math.max(dist(tl, tr), dist(bl, br))))
  const outH = Math.max(1, Math.round(Math.max(dist(tl, bl), dist(tr, br))))

  const src = cv.imread(srcCanvas)
  const dst = new cv.Mat()
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y])
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH])
  const M = cv.getPerspectiveTransform(srcTri, dstTri)
  const dsize = new cv.Size(outW, outH)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = outW
  outCanvas.height = outH

  try {
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar())
    cv.imshow(outCanvas, dst)
  } finally {
    src.delete()
    dst.delete()
    srcTri.delete()
    dstTri.delete()
    M.delete()
  }

  return outCanvas
}

const warpCache = new WeakMap<Blob, Map<string, Promise<HTMLCanvasElement>>>()

/**
 * Perspective-corrects `blob` so that `corners` become the four corners of the output
 * rectangle. Results are memoized per (blob, corners) so repeated calls while the user
 * tweaks unrelated settings (brightness, rotation, ...) don't redo this expensive step.
 */
export function warpDocument(blob: Blob, corners: Quad): Promise<HTMLCanvasElement> {
  const key = JSON.stringify(corners)
  let perBlob = warpCache.get(blob)
  if (!perBlob) {
    perBlob = new Map()
    warpCache.set(blob, perBlob)
  }
  let promise = perBlob.get(key)
  if (!promise) {
    promise = warpDocumentUncached(blob, corners)
    perBlob.set(key, promise)
  }
  return promise
}

/** Auto brightness/contrast via CLAHE on the L channel (Lab color space) — conservative, safe default. */
export async function autoEnhanceCanvas(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const cv = await getCv()
  const src = cv.imread(canvas)
  const lab = new cv.Mat()
  const planes = new cv.MatVector()
  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = canvas.width
  outCanvas.height = canvas.height

  try {
    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB)
    cv.cvtColor(src, lab, cv.COLOR_RGB2Lab)
    cv.split(lab, planes)
    const l = planes.get(0)
    clahe.apply(l, l)
    planes.set(0, l)
    l.delete()
    cv.merge(planes, lab)
    cv.cvtColor(lab, lab, cv.COLOR_Lab2RGB)
    cv.imshow(outCanvas, lab)
  } finally {
    src.delete()
    lab.delete()
    planes.delete()
    clahe.delete()
  }

  return outCanvas
}
