const DEVICE_TOKEN_KEY = 'satuang-device-id'

export function getOrCreateDeviceToken(): string {
  try {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY)
    if (!token || token.length < 10) {
      token = crypto.randomUUID()
      localStorage.setItem(DEVICE_TOKEN_KEY, token)
    }
    return token
  } catch {
    return 'anon-' + Date.now().toString(36)
  }
}
