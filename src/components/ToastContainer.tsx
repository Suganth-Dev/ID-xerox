import { CheckCircle2, AlertCircle, Info, X, TriangleAlert } from 'lucide-react'
import type { ToastApi } from '../hooks/useToast'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
}

const STYLES = {
  success: 'border-success/30 bg-success-soft text-success',
  error: 'border-danger/30 bg-danger-soft text-danger',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  info: 'border-border bg-surface text-ink',
}

export function ToastContainer({ toast }: { toast: ToastApi }) {
  if (toast.toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toast.toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-md ${STYLES[t.kind]}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">{t.message}</p>
            <button type="button" onClick={() => toast.dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
