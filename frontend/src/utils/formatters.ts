/**
 * Formatting utilities for SA.TUANG COFFEE
 */

export const rupiah = (value: string | number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

export const dateTime = (value: string): string =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export const orderDateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export const todayLabel = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date())

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  )
}

export function isExternalUrl(pathOrUrl: string): boolean {
  if (!pathOrUrl) return false
  const trimmed = pathOrUrl.trim()
  if (
    trimmed.startsWith('/storage/') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return false
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.origin === window.location.origin) {
      return !parsed.pathname.startsWith('/storage/')
    }
    if (parsed.pathname.startsWith('/storage/')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

