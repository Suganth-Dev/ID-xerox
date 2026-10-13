import { useState } from 'react'
import { Copy, Pencil, Save, Trash2, X } from 'lucide-react'
import type { SavedJobsApi } from '../hooks/useSavedJobs'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  open: boolean
  onClose: () => void
  savedJobs: SavedJobsApi
  hasCurrentWork: boolean
  onSaveCurrent: (name: string) => Promise<void>
  onOpenJob: (id: string) => Promise<void>
  confirmBeforeDelete: boolean
}

export function SavedJobsPanel({ open, onClose, savedJobs, hasCurrentWork, onSaveCurrent, onOpenJob, confirmBeforeDelete }: Props) {
  const [newJobName, setNewJobName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  if (!open) return null

  const requestDelete = (id: string) => {
    if (confirmBeforeDelete) setPendingDeleteId(id)
    else void savedJobs.deleteJob(id)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-sm flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Saved Jobs</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border p-3">
          <input
            value={newJobName}
            onChange={(e) => setNewJobName(e.target.value)}
            placeholder="Name this job…"
            disabled={!hasCurrentWork}
            className="flex-1 rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-ink disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!hasCurrentWork}
            onClick={async () => {
              await onSaveCurrent(newJobName || 'Untitled Job')
              setNewJobName('')
            }}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Save size={13} /> Save
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {savedJobs.jobs.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">No saved jobs yet. Jobs you save stay only on this computer.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {savedJobs.jobs.map((job) => (
                <li key={job.id} className="rounded-lg border border-border bg-canvas p-3">
                  {renamingId === job.id ? (
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await savedJobs.renameJob(job.id, renameValue)
                          setRenamingId(null)
                        }}
                        className="text-xs font-semibold text-accent-strong"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="truncate text-sm font-medium text-ink">{job.name}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted">
                    {job.imageCount} image{job.imageCount !== 1 ? 's' : ''} · updated {new Date(job.updatedAt).toLocaleString()}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void onOpenJob(job.id)}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-accent/50"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(job.id)
                        setRenameValue(job.name)
                      }}
                      className="rounded-md p-1.5 text-muted hover:text-ink"
                      title="Rename"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void savedJobs.duplicateJob(job.id)}
                      className="rounded-md p-1.5 text-muted hover:text-ink"
                      title="Duplicate"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(job.id)}
                      className="ml-auto rounded-md p-1.5 text-muted hover:text-danger"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this saved job?"
        message="This removes the job and its stored images from this computer. This cannot be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) void savedJobs.deleteJob(pendingDeleteId)
          setPendingDeleteId(null)
        }}
      />
    </div>
  )
}
