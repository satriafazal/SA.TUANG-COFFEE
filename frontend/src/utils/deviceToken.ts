const DEVICE_TOKEN_KEY = 'satuang-device-id'
const CART_KEY = 'satuang-cart'
const GUEST_NAME_KEY = 'satuang-guest-name'
const ORDERING_SESSION_KEY = 'satuang-ordering-session'

export interface DeviceSessionRecord {
  token: string
  date: string
}

export function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function clearPreviousDayGuestSession(): void {
  try {
    localStorage.removeItem(CART_KEY)
    localStorage.removeItem(GUEST_NAME_KEY)
    sessionStorage.removeItem(ORDERING_SESSION_KEY)
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function getOrCreateDeviceToken(): string {
  const today = getTodayDateString()
  try {
    const raw = localStorage.getItem(DEVICE_TOKEN_KEY)
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (
          parsed &&
          typeof parsed === 'object' &&
          'token' in parsed &&
          'date' in parsed &&
          typeof (parsed as DeviceSessionRecord).token === 'string' &&
          (parsed as DeviceSessionRecord).date === today
        ) {
          return (parsed as DeviceSessionRecord).token
        }
      } catch {
        // Raw string format from legacy version or corrupt JSON: treat as expired
      }
    }

    // New day (past 00:00 midnight) or first visit: clear yesterday's state
    clearPreviousDayGuestSession()

    const token = crypto.randomUUID()
    const sessionData: DeviceSessionRecord = {
      token,
      date: today,
    }
    localStorage.setItem(DEVICE_TOKEN_KEY, JSON.stringify(sessionData))
    return token
  } catch {
    return 'anon-' + Date.now().toString(36)
  }
}

export function forceResetDeviceSession(): string {
  const today = getTodayDateString()
  try {
    clearPreviousDayGuestSession()
    const token = crypto.randomUUID()
    const sessionData: DeviceSessionRecord = {
      token,
      date: today,
    }
    localStorage.setItem(DEVICE_TOKEN_KEY, JSON.stringify(sessionData))
    return token
  } catch {
    return 'anon-' + Date.now().toString(36)
  }
}
