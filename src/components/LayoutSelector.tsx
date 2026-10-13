import { ArrowLeftRight, Sparkle } from 'lucide-react'
import {
  GRID_SOURCE_PAIR_SIDE_BY_SIDE,
  GRID_SOURCE_PAIR_STACKED,
  type LayoutKind,
  type PageSettings,
} from '../types/layout'
import type { ManagedImage } from '../types/image'

interface Props {
  settings: PageSettings
  images: ManagedImage[]
  onChange: (patch: Partial<PageSettings>) => void
}

const LAYOUT_OPTIONS: { value: LayoutKind; label: string; hint: string }[] = [
  { value: 'side-by-side', label: 'Front & back — side by side', hint: 'One pair per tile' },
  { value: 'stacked', label: 'Front & back — stacked', hint: 'One pair per tile' },
  { value: 'front-only', label: 'Front only', hint: 'Repeats the front image' },
  { value: 'back-only', label: 'Back only', hint: 'Repeats the back image' },
  { value: 'grid', label: 'Multiple copies (grid)', hint: 'Choose what to repeat' },
]

export function LayoutSelector({ settings, images, onChange }: Props) {
  const front = images.find((i) => i.slot === 'front')
  const back = images.find((i) => i.slot === 'back')

  // Wide/landscape documents (e.g. a family card) waste space side-by-side on a narrow
  // portrait page — width becomes the binding constraint and both end up small. Tall
  // documents (e.g. an Aadhaar sheet) waste space stacked instead. Pick whichever pairing
  // lets each image use the page's long dimension fully, based on the actual photo shape.
  const representative = front ?? back
  const representativeAspect = representative ? representative.previewWidth / representative.previewHeight : 1
  const bestPairLayout: LayoutKind = representativeAspect > 1.15 ? 'stacked' : 'side-by-side'

  const isQuickSetupActive = settings.layout === bestPairLayout && settings.sizePreset === 'fill-page'

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onChange({ layout: bestPairLayout, sizePreset: 'fill-page', manualPlacements: null })}
        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
          isQuickSetupActive ? 'border-accent bg-accent-soft' : 'border-accent/50 bg-accent-soft/40 hover:bg-accent-soft'
        }`}
      >
        <Sparkle size={16} className="shrink-0 text-accent-strong" />
        <span>
          <span className="block text-sm font-semibold text-accent-strong">Full-page front + back (one click)</span>
          <span className="block text-[11px] text-muted">
            {bestPairLayout === 'stacked' ? 'Stacked' : 'Side by side'}, sized to fill the page — picked automatically to match your
            photo's shape
          </span>
        </span>
      </button>

      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Layout</p>
      <div className="grid gap-1.5">
        {LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ layout: opt.value, manualPlacements: null })}
            className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
              settings.layout === opt.value
                ? 'border-accent bg-accent-soft text-accent-strong'
                : 'border-border bg-surface text-ink hover:border-accent/40'
            }`}
          >
            <span className="font-medium">{opt.label}</span>
            <span className="text-[11px] text-muted">{opt.hint}</span>
          </button>
        ))}
      </div>

      {settings.layout === 'grid' && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Repeat
          <select
            value={settings.gridSource}
            onChange={(e) => onChange({ gridSource: e.target.value })}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
          >
            <option value={GRID_SOURCE_PAIR_SIDE_BY_SIDE} disabled={!front || !back}>
              Front + back pair (side by side)
            </option>
            <option value={GRID_SOURCE_PAIR_STACKED} disabled={!front || !back}>
              Front + back pair (stacked)
            </option>
            {images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.slot === 'front' ? 'Front' : img.slot === 'back' ? 'Back' : img.fileName}
              </option>
            ))}
          </select>
          {settings.gridSource !== GRID_SOURCE_PAIR_SIDE_BY_SIDE && settings.gridSource !== GRID_SOURCE_PAIR_STACKED && (
            <span className="text-[11px] text-muted-2">
              This repeats only that one image. To show front and back together, pick "Front + back pair" above, or use the
              side-by-side/stacked layout instead.
            </span>
          )}
        </label>
      )}

      {(settings.layout === 'side-by-side' || settings.layout === 'stacked' || settings.layout === 'grid') && front && back && (
        <button
          type="button"
          onClick={() => onChange({ swapFrontBack: !settings.swapFrontBack })}
          className="flex items-center gap-1.5 self-start rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-accent/50"
        >
          <ArrowLeftRight size={13} /> {settings.swapFrontBack ? 'Back shown first' : 'Front shown first'}
        </button>
      )}
    </div>
  )
}
