import { useCallback, useRef, useState } from 'react'
import { createId } from '../utils/id'

export type ToastKind = 'info' | 'success' | 'error' | 'warning'

export interface ToastItem {
  id: string
  kind: ToastKind
  message: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message: string, kind: ToastKind = 'info', durationMs = kind === 'error' ? 6000 : 3500) => {
      const id = createId()
      setToasts((prev) => [...prev, { id, kind, message }])
      const timer = setTimeout(() => dismiss(id), durationMs)
      timers.current.set(id, timer)
      return id
    },
    [dismiss],
  )

  return {
    toasts,
    info: useCallback((m: string) => push(m, 'info'), [push]),
    success: useCallback((m: string) => push(m, 'success'), [push]),
    error: useCallback((m: string) => push(m, 'error'), [push]),
    warning: useCallback((m: string) => push(m, 'warning'), [push]),
    dismiss,
  }
}

export type ToastApi = ReturnType<typeof useToast>
