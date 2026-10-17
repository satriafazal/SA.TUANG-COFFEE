export type CustomerMode = 'guest' | 'member'

export type PrototypeSession =
  | { mode: 'guest'; token: string }
  | { mode: 'member'; email: string }

export type PrototypeMember = {
  id: string
  name: string
  email: string
  points: number
  isSeededDemo?: boolean
  passwordSalt?: string
  passwordHash?: string
}

export type PrototypeOrderItem = {
  name: string
  itemType: 'food' | 'drink'
  quantity: number
  price: string
}

export type PrototypeOrder = {
  orderNumber: string
  customerName: string
  customerPhone: string | null
  total: string
  createdAt: string
  orderStatus: string
  paymentStatus: string
  mode: CustomerMode
  guestToken?: string
  memberEmail?: string
  items: PrototypeOrderItem[]
}

export async function hashPrototypePassword(password: string): Promise<{ salt: string; hash: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 120_000, hash: 'SHA-256' }, key, 256)
  const hash = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { salt, hash }
}

export async function verifyPrototypePassword(password: string, member: PrototypeMember): Promise<boolean> {
  if (!member.passwordSalt || !member.passwordHash) return false
  const saltBytes = new Uint8Array(member.passwordSalt.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [])
  if (saltBytes.length !== 16 || !/^[0-9a-f]{64}$/i.test(member.passwordHash)) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 120_000, hash: 'SHA-256' }, key, 256)
  const candidate = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return candidate === member.passwordHash
}

const SESSION_KEY = 'satuang-prototype-session'
const MEMBERS_KEY = 'satuang-prototype-members'
const ORDERS_KEY = 'satuang-prototype-orders'

function readValue<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeValue<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function readPrototypeSession(): PrototypeSession | null {
  const session = readValue<PrototypeSession | null>(SESSION_KEY, null)
  if (!session || (session.mode !== 'guest' && session.mode !== 'member')) return null
  if (session.mode === 'guest' && typeof session.token !== 'string') return null
  if (session.mode === 'member' && typeof session.email !== 'string') return null
  return session
}

export function savePrototypeSession(session: PrototypeSession | null) {
  if (session) writeValue(SESSION_KEY, session)
  else localStorage.removeItem(SESSION_KEY)
}

export function newGuestSession(): PrototypeSession {
  const session: PrototypeSession = { mode: 'guest', token: crypto.randomUUID() }
  savePrototypeSession(session)
  return session
}

export function readPrototypeMembers(): PrototypeMember[] {
  return readValue<PrototypeMember[]>(MEMBERS_KEY, [])
}

export function savePrototypeMembers(members: PrototypeMember[]) {
  writeValue(MEMBERS_KEY, members)
}

export function readPrototypeOrders(): PrototypeOrder[] {
  return readValue<PrototypeOrder[]>(ORDERS_KEY, [])
}

export function savePrototypeOrder(order: PrototypeOrder) {
  const orders = readPrototypeOrders().filter((item) => item.orderNumber !== order.orderNumber)
  writeValue(ORDERS_KEY, [order, ...orders])
}

export function replacePrototypeOrder(order: PrototypeOrder) {
  const orders = readPrototypeOrders().map((item) => item.orderNumber === order.orderNumber ? order : item)
  writeValue(ORDERS_KEY, orders)
}

export function seedDemoMember(): PrototypeMember {
  const members = readPrototypeMembers()
  const existing = members.find((member) => member.email === 'demo.member@satuang.test')
  if (existing) return existing
  const member: PrototypeMember = {
    id: 'prototype-demo-member',
    name: 'Demo Member',
    email: 'demo.member@satuang.test',
    points: 250,
    isSeededDemo: true,
  }
  savePrototypeMembers([member, ...members])
  return member
}
