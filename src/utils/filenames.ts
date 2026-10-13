export function generatePdfFilename(prefix = 'ID_Print'): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${prefix}_${y}-${m}-${d}.pdf`
}

export function sanitizeJobName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Untitled Job'
  return trimmed.slice(0, 80)
}
