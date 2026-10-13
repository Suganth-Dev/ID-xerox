import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Copy, RotateCcw, Trash2 } from 'lucide-react'
import type { ManagedImage } from '../types/image'
import type { ManualPlacement, PageSettings } from '../types/layout'
import { resolvePaperSizeMm } from '../types/layout'
import type { ComputedLayout } from '../services/pdfGenerator'
import { createId } from '../utils/id'

interface Props {
  pageSettings: PageSettings
  images: ManagedImage[]
  autoLayout: ComputedLayout
  onCommitPlacements: (placements: ManualPlacement[]) => void
  onResetToAuto: () => void
}

const MIN_SIZE_MM = 8

function seedFromAuto(autoLayout: ComputedLayout): ManualPlacement[] {
  const items = autoLayout.pages[0]?.items ?? []
  return items.map((item, idx) => ({
    key: `${item.imageId}-${idx}`,
    imageId: item.imageId,
    xMm: item.xMm,
    yMm: item.yMm,
    widthMm: item.widthMm,
    heightMm: item.heightMm,
  }))
}

type DragState =
  | { mode: 'move'; key: string; startClientX: number; startClientY: number; startXMm: number; startYMm: number }
  | {
      mode: 'resize'
      key: string
      startClientX: number
      startClientY: number
      startWidthMm: number
      startHeightMm: number
      xMm: number
      yMm: number
      aspect: number
    }

export function PageCanvas({ pageSettings, images, autoLayout, onCommitPlacements, onResetToAuto }: Props) {
  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = resolvePaperSizeMm(pageSettings)
  const [placements, setPlacements] = useState<ManualPlacement[]>(() => pageSettings.manualPlacements ?? seedFromAuto(autoLayout))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const movedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pxPerMm, setPxPerMm] = useState(2)

  useEffect(() => {
    if (pageSettings.manualPlacements === null) {
      setPlacements(seedFromAuto(autoLayout))
      setSelectedKey(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSettings.manualPlacements])

  useEffect(() => {
    const update = () => {
      const el = containerRef.current
      if (!el) return
      const available = el.clientWidth - 32
      setPxPerMm(Math.max(0.5, available / pageWidthMm))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [pageWidthMm])

  const imageByid = new Map(images.map((img) => [img.id, img]))

  const commit = (next: ManualPlacement[]) => {
    setPlacements(next)
    onCommitPlacements(next)
  }

  const startMove = (key: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const placement = placements.find((p) => p.key === key)
    if (!placement) return
    setSelectedKey(key)
    movedRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { mode: 'move', key, startClientX: e.clientX, startClientY: e.clientY, startXMm: placement.xMm, startYMm: placement.yMm }
  }

  const startResize = (key: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const placement = placements.find((p) => p.key === key)
    if (!placement) return
    setSelectedKey(key)
    movedRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: 'resize',
      key,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidthMm: placement.widthMm,
      startHeightMm: placement.heightMm,
      xMm: placement.xMm,
      yMm: placement.yMm,
      aspect: placement.widthMm / placement.heightMm,
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const deltaXMm = (e.clientX - drag.startClientX) / pxPerMm
    const deltaYMm = (e.clientY - drag.startClientY) / pxPerMm
    if (Math.abs(e.clientX - drag.startClientX) > 2 || Math.abs(e.clientY - drag.startClientY) > 2) {
      movedRef.current = true
    }

    setPlacements((prev) =>
      prev.map((p) => {
        if (p.key !== drag.key) return p
        if (drag.mode === 'move') {
          const xMm = Math.min(Math.max(0, drag.startXMm + deltaXMm), pageWidthMm - p.widthMm)
          const yMm = Math.min(Math.max(0, drag.startYMm + deltaYMm), pageHeightMm - p.heightMm)
          return { ...p, xMm, yMm }
        }
        let widthMm = Math.max(MIN_SIZE_MM, drag.startWidthMm + deltaXMm)
        let heightMm = widthMm / drag.aspect
        const maxW = pageWidthMm - drag.xMm
        const maxH = pageHeightMm - drag.yMm
        if (widthMm > maxW) {
          widthMm = maxW
          heightMm = widthMm / drag.aspect
        }
        if (heightMm > maxH) {
          heightMm = maxH
          widthMm = heightMm * drag.aspect
        }
        if (heightMm < MIN_SIZE_MM) {
          heightMm = MIN_SIZE_MM
          widthMm = heightMm * drag.aspect
        }
        return { ...p, widthMm, heightMm }
      }),
    )
  }

  const handlePointerUp = () => {
    if (!dragRef.current) return
    dragRef.current = null
    // A plain click (no actual drag) just selects the item — it shouldn't silently lock
    // in a custom arrangement when the user was only browsing/selecting.
    if (!movedRef.current) return
    setPlacements((current) => {
      onCommitPlacements(current)
      return current
    })
  }

  const duplicateSelected = () => {
    const current = placements.find((p) => p.key === selectedKey)
    if (!current) return
    const copy: ManualPlacement = {
      ...current,
      key: createId(),
      xMm: Math.min(pageWidthMm - current.widthMm, current.xMm + 8),
      yMm: Math.min(pageHeightMm - current.heightMm, current.yMm + 8),
    }
    const next = [...placements, copy]
    setSelectedKey(copy.key)
    commit(next)
  }

  const removeSelected = () => {
    if (!selectedKey) return
    const next = placements.filter((p) => p.key !== selectedKey)
    setSelectedKey(null)
    commit(next)
  }

  const isManual = pageSettings.manualPlacements !== null

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <p className="text-xs text-muted">
          {isManual
            ? 'Custom arrangement active — drag to move, drag the corner handle to resize. Copies/layout settings are ignored here.'
            : 'Drag any image to start a custom arrangement, overriding the automatic layout.'}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {selectedKey && (
            <>
              <button type="button" onClick={duplicateSelected} className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-accent/50">
                <Copy size={13} /> Duplicate
              </button>
              <button type="button" onClick={removeSelected} className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-danger hover:border-danger/50">
                <Trash2 size={13} /> Remove
              </button>
            </>
          )}
          {isManual && (
            <button
              type="button"
              onClick={onResetToAuto}
              className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-accent/50"
            >
              <RotateCcw size={13} /> Reset to automatic layout
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-canvas p-4">
        <div
          className="relative mx-auto bg-white shadow-sm"
          style={{ width: pageWidthMm * pxPerMm, height: pageHeightMm * pxPerMm }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedKey(null)
          }}
        >
          <div
            className="pointer-events-none absolute border border-dashed border-border-strong"
            style={{
              left: pageSettings.marginMm * pxPerMm,
              top: pageSettings.marginMm * pxPerMm,
              width: Math.max(0, pageWidthMm - 2 * pageSettings.marginMm) * pxPerMm,
              height: Math.max(0, pageHeightMm - 2 * pageSettings.marginMm) * pxPerMm,
            }}
          />

          {placements.map((p) => {
            const img = imageByid.get(p.imageId)
            if (!img) return null
            const selected = selectedKey === p.key
            return (
              <div
                key={p.key}
                onPointerDown={startMove(p.key)}
                className={`absolute cursor-move touch-none select-none ${selected ? 'outline outline-2 outline-accent' : ''}`}
                style={{ left: p.xMm * pxPerMm, top: p.yMm * pxPerMm, width: p.widthMm * pxPerMm, height: p.heightMm * pxPerMm }}
              >
                <img src={img.previewUrl ?? img.originalUrl} alt="" draggable={false} className="h-full w-full object-fill" />
                {selected && (
                  <div
                    onPointerDown={startResize(p.key)}
                    className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-accent shadow"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
