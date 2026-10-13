import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point, Quad } from '../types/geometry'
import type { ManagedImage } from '../types/image'

interface Props {
  image: ManagedImage
  initialCorners: Quad | null
  onApply: (corners: Quad) => void
  onCancel: () => void
}

const HANDLE_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left']

function defaultCorners(w: number, h: number): Quad {
  const mx = w * 0.08
  const my = h * 0.08
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ]
}

export function DocumentCornerEditor({ image, initialCorners, onApply, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [points, setPoints] = useState<Quad>(() => initialCorners ?? defaultCorners(image.naturalWidth, image.naturalHeight))
  const draggingIndex = useRef<number | null>(null)

  useEffect(() => {
    const update = () => {
      const el = containerRef.current
      if (!el) return
      const maxW = el.clientWidth
      const maxH = window.innerHeight * 0.6
      const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1)
      setDisplaySize({ width: image.naturalWidth * scale, height: image.naturalHeight * scale })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [image.naturalWidth, image.naturalHeight])

  const scale = displaySize.width > 0 ? displaySize.width / image.naturalWidth : 1

  const toDisplay = (p: Point): Point => ({ x: p.x * scale, y: p.y * scale })
  const toNatural = (p: Point): Point => ({ x: p.x / scale, y: p.y / scale })

  const handlePointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    draggingIndex.current = index
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const idx = draggingIndex.current
    if (idx === null || !containerRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(displaySize.width, Math.max(0, e.clientX - rect.left))
    const y = Math.min(displaySize.height, Math.max(0, e.clientY - rect.top))
    setPoints((prev) => {
      const next = [...prev] as Quad
      next[idx] = toNatural({ x, y })
      return next
    })
  }

  const handlePointerUp = () => {
    draggingIndex.current = null
  }

  const displayPoints = points.map(toDisplay)
  const polygonStr = displayPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-3xl flex-col gap-3 rounded-xl bg-surface p-4 shadow-xl">
        <div>
          <h3 className="text-sm font-semibold text-ink">Adjust document corners</h3>
          <p className="text-xs text-muted">
            Drag each handle onto the matching corner of the document in the photo ({HANDLE_LABELS.join(', ').toLowerCase()}), then apply.
          </p>
        </div>

        <div ref={containerRef} className="flex justify-center">
          <div
            className="relative touch-none select-none overflow-hidden rounded-lg border border-border bg-canvas"
            style={{ width: displaySize.width || '100%', height: displaySize.height || 400 }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {displaySize.width > 0 && (
              <>
                <img
                  src={image.originalUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
                <svg className="pointer-events-none absolute inset-0" width={displaySize.width} height={displaySize.height}>
                  <polygon points={polygonStr} fill="rgba(14,138,116,0.22)" stroke="#0e8a74" strokeWidth={2} />
                </svg>
                {displayPoints.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onPointerDown={handlePointerDown(i)}
                    aria-label={`${HANDLE_LABELS[i]} corner handle`}
                    className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-accent shadow-md"
                    style={{ left: p.x, top: p.y }}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(points)}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Apply corners
          </button>
        </div>
      </div>
    </div>
  )
}
