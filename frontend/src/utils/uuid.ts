export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // fallback if invocation fails
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
      )
    } catch {
      // fallback if getRandomValues fails
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Polyfill window.crypto.randomUUID for insecure contexts (e.g. HTTP over LAN IP)
if (typeof window !== 'undefined') {
  try {
    if (!window.crypto) {
      // @ts-expect-error polyfill
      window.crypto = {}
    }
    if (typeof window.crypto.randomUUID !== 'function') {
      Object.defineProperty(window.crypto, 'randomUUID', {
        value: generateUUID,
        writable: true,
        configurable: true,
      })
    }
  } catch {
    // Ignore if property is non-configurable
  }
}

