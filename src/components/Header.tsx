import { FolderOpen, Lock, Settings as SettingsIcon, SquarePlus } from 'lucide-react'

interface Props {
  onNewJob: () => void
  onOpenSavedJobs: () => void
  onOpenSettings: () => void
}

export function Header({ onNewJob, onOpenSavedJobs, onOpenSettings }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">X</div>
        <div>
          <p className="text-sm font-semibold leading-tight text-ink">XeroxMate</p>
          <p className="text-[11px] leading-tight text-muted">Local ID card PDF editor</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewJob}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50"
        >
          <SquarePlus size={15} /> New Job
        </button>
        <button
          type="button"
          onClick={onOpenSavedJobs}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50"
        >
          <FolderOpen size={15} /> Saved Jobs
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50"
          aria-label="Settings"
        >
          <SettingsIcon size={15} />
        </button>
        <span className="ml-1 flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-strong">
          <Lock size={11} /> Local only
        </span>
      </div>
    </header>
  )
}
