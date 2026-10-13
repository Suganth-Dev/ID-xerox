import {
  ID_CARD_HEIGHT_MM,
  ID_CARD_WIDTH_MM,
  PAPER_SIZES,
  type PageSettings as PageSettingsType,
  type PaperSizeName,
  type SizePreset,
} from '../types/layout'
import type { ComputedLayout } from '../services/pdfGenerator'

interface Props {
  settings: PageSettingsType
  onChange: (patch: Partial<PageSettingsType>) => void
  layoutPreview: ComputedLayout | null
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
        />
        {suffix && <span className="text-[11px] text-muted-2">{suffix}</span>}
      </div>
    </label>
  )
}

export function PageSettingsPanel({ settings, onChange, layoutPreview }: Props) {
  const sizePresetChange = (preset: SizePreset) => {
    if (preset === 'id-card') {
      onChange({ sizePreset: preset, imageWidthMm: ID_CARD_WIDTH_MM, imageHeightMm: ID_CARD_HEIGHT_MM, manualPlacements: null })
    } else {
      // 'fill-page' is recomputed live by the app whenever this preset is active;
      // 'custom' just stops any further auto-sizing and keeps the current numbers.
      // Clearing manualPlacements so these size controls aren't a silent no-op while a
      // custom (drag-arranged) layout is active.
      onChange({ sizePreset: preset, manualPlacements: null })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Paper</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Size
            <select
              value={settings.paperSize}
              onChange={(e) => onChange({ paperSize: e.target.value as PaperSizeName })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            >
              {Object.keys(PAPER_SIZES).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Orientation
            <select
              value={settings.orientation}
              onChange={(e) => onChange({ orientation: e.target.value as 'portrait' | 'landscape' })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        </div>
        {settings.paperSize === 'Custom' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField label="Width" value={settings.customWidthMm} onChange={(v) => onChange({ customWidthMm: v })} min={10} suffix="mm" />
            <NumberField label="Height" value={settings.customHeightMm} onChange={(v) => onChange({ customHeightMm: v })} min={10} suffix="mm" />
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField label="Margin" value={settings.marginMm} onChange={(v) => onChange({ marginMm: v })} min={0} suffix="mm" />
          <NumberField label="Spacing" value={settings.spacingMm} onChange={(v) => onChange({ spacingMm: v })} min={0} suffix="mm" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Image size</p>
        <div className="mb-2 flex gap-1.5">
          {(['fill-page', 'id-card', 'custom'] as SizePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => sizePresetChange(p)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                settings.sizePreset === p ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border bg-surface text-muted'
              }`}
            >
              {p === 'fill-page' ? 'Fill page' : p === 'id-card' ? 'ID card' : 'Custom'}
            </button>
          ))}
        </div>
        {settings.sizePreset === 'fill-page' && (
          <p className="mb-2 text-[11px] text-muted-2">Sized automatically to use the page well. Edit width/height to take over manually.</p>
        )}
        {settings.sizePreset === 'id-card' && (
          <p className="mb-2 text-[11px] text-muted-2">
            Fixed physical size of a standard plastic card (85.6×53.98mm) — use this for actual wallet-sized ID cards, not full printed
            sheets.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width" value={settings.imageWidthMm} onChange={(v) => onChange({ imageWidthMm: v, sizePreset: 'custom' })} min={1} step={0.1} suffix="mm" />
          <NumberField label="Height" value={settings.imageHeightMm} onChange={(v) => onChange({ imageHeightMm: v, sizePreset: 'custom' })} min={1} step={0.1} suffix="mm" />
        </div>
        <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
          Fit mode
          <select
            value={settings.fitMode}
            onChange={(e) => onChange({ fitMode: e.target.value as 'fit' | 'actual' })}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
          >
            <option value="fit">Fit — preserve aspect ratio</option>
            <option value="actual">Actual size — fill exactly</option>
          </select>
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Placement</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Align horizontal
            <select
              value={settings.hAlign}
              onChange={(e) => onChange({ hAlign: e.target.value as PageSettingsType['hAlign'] })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Align vertical
            <select
              value={settings.vAlign}
              onChange={(e) => onChange({ vAlign: e.target.value as PageSettingsType['vAlign'] })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Copies</p>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Copies" value={settings.copies} onChange={(v) => onChange({ copies: Math.max(1, Math.round(v)) })} min={1} max={500} />
          <label className="flex flex-col gap-1 text-xs text-muted">
            Columns
            <select
              value={settings.columns}
              onChange={(e) => onChange({ columns: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="auto">Auto</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Rows
            <select
              value={settings.rows}
              onChange={(e) => onChange({ rows: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="auto">Auto</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {layoutPreview && (
        <div className="rounded-md border border-border bg-canvas p-3 text-xs text-muted">
          {layoutPreview.pages.length > 0 ? (
            <p>
              <span className="font-semibold text-ink">{layoutPreview.unitsPerPage}</span> per page ·{' '}
              <span className="font-semibold text-ink">{layoutPreview.pages.length}</span> page{layoutPreview.pages.length > 1 ? 's' : ''} total
            </p>
          ) : (
            <p className="text-warning">Nothing to arrange yet.</p>
          )}
          {layoutPreview.warnings.map((w, i) => (
            <p key={i} className="mt-1 text-warning">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
