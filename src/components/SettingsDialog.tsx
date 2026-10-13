import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { useLocalSettings } from '../hooks/useLocalSettings'
import type { SavedJobsApi } from '../hooks/useSavedJobs'
import { ConfirmDialog } from './ConfirmDialog'
import { estimateStorageUsage } from '../services/localDatabase'
import type { ToastApi } from '../hooks/useToast'

interface Props {
  open: boolean
  onClose: () => void
  settingsApi: ReturnType<typeof useLocalSettings>
  savedJobs: SavedJobsApi
  toast: ToastApi
}

export function SettingsDialog({ open, onClose, settingsApi, savedJobs, toast }: Props) {
  const { settings, update, updatePageDefaults, restoreDefaults } = settingsApi
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [usage, setUsage] = useState<{ usageMb: number; quotaMb: number } | null>(null)

  useEffect(() => {
    if (open) void estimateStorageUsage().then(setUsage)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Settings</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Appearance</h3>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Theme
              <select
                value={settings.theme}
                onChange={(e) => update({ theme: e.target.value as 'light' | 'dark' | 'system' })}
                className="w-40 rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Defaults for new jobs</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Paper size
                <select
                  value={settings.defaultPageSettings.paperSize}
                  onChange={(e) => updatePageDefaults({ paperSize: e.target.value as typeof settings.defaultPageSettings.paperSize })}
                  className="rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink"
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="A3">A3</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                  <option value="Custom">Custom</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Orientation
                <select
                  value={settings.defaultPageSettings.orientation}
                  onChange={(e) => updatePageDefaults({ orientation: e.target.value as 'portrait' | 'landscape' })}
                  className="rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Margin (mm)
                <input
                  type="number"
                  min={0}
                  value={settings.defaultPageSettings.marginMm}
                  onChange={(e) => updatePageDefaults({ marginMm: Number(e.target.value) })}
                  className="rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Spacing (mm)
                <input
                  type="number"
                  min={0}
                  value={settings.defaultPageSettings.spacingMm}
                  onChange={(e) => updatePageDefaults({ spacingMm: Number(e.target.value) })}
                  className="rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Default copies
                <input
                  type="number"
                  min={1}
                  value={settings.defaultPageSettings.copies}
                  onChange={(e) => updatePageDefaults({ copies: Math.max(1, Number(e.target.value)) })}
                  className="rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Image quality
                <select
                  value={settings.defaultPageSettings.imageQuality}
                  onChange={(e) => updatePageDefaults({ imageQuality: Number(e.target.value) })}
                  className="rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink"
                >
                  <option value={0.98}>Best</option>
                  <option value={0.92}>High</option>
                  <option value={0.8}>Standard</option>
                </select>
              </label>
            </div>
            <button type="button" onClick={restoreDefaults} className="mt-3 text-xs font-medium text-accent-strong hover:underline">
              Restore defaults
            </button>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Saved jobs</h3>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={settings.confirmBeforeDeletingJobs}
                onChange={(e) => update({ confirmBeforeDeletingJobs: e.target.checked })}
              />
              Ask for confirmation before deleting a saved job
            </label>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Privacy &amp; local data</h3>
            <p className="text-sm text-muted">
              XeroxMate never uploads images anywhere. Saved jobs and their images are stored only in this browser's local IndexedDB
              storage on this computer. Browser data is not encrypted — clearing site data or using "Delete all local data" removes it
              permanently.
            </p>
            {usage && (
              <p className="mt-2 text-xs text-muted-2">
                Approx. local storage used: {usage.usageMb.toFixed(1)} MB{usage.quotaMb ? ` of ${usage.quotaMb.toFixed(0)} MB available` : ''}
              </p>
            )}
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(true)}
              className="mt-3 rounded-md border border-danger/40 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
            >
              Delete all local data
            </button>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteAll}
        title="Delete all local data?"
        message="This permanently deletes every saved job and image stored on this computer. This cannot be undone."
        confirmLabel="Delete everything"
        danger
        onCancel={() => setConfirmDeleteAll(false)}
        onConfirm={async () => {
          await savedJobs.deleteAll()
          setConfirmDeleteAll(false)
          toast.success('All local data deleted.')
        }}
      />
    </div>
  )
}
