import type { OrderReceipt, Product, Category, TrackedOrder } from './types'

const API_ROOT = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('satuang-token')
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const firstError = Object.values(body.errors ?? {}).flat()[0]
    throw new Error(firstError?.toString() ?? body.message ?? 'Terjadi kesalahan. Coba lagi.')
  }
  return body as T
}

export async function getMenu() {
  return request<{ categories: Array<{ id: number; name: string; slug: string; sort_order: number }>; products: Product[] }>('/menu')
}

export function createCashOrder(input: {
  customer_name: string
  customer_phone?: string
  payment_method: 'cash'
  items: Array<{ product_id: number; quantity: number; special_instructions?: string }>
}, idempotencyKey: string) {
  return request<OrderReceipt>('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  })
}

export function trackOrder(orderNumber: string, customerName: string) {
  const query = new URLSearchParams({ customer_name: customerName })
  return request<TrackedOrder>(`/orders/${encodeURIComponent(orderNumber)}/status?${query}`)
}

export type StaffUser = { id: number; name: string; email: string; role: string; permissions: string[] }
export type StaffOrder = {
  id: number
  order_number: string
  customer_name: string
  customer_phone: string | null
  order_status: string
  payment_status: string
  payment_method: string
  subtotal: string
  discount_total: string
  points_discount: string
  total: string
  created_at: string
  items: Array<{ id: number; product_name_snapshot: string; item_type: string; quantity: number; unit_price: string; line_total: string; special_instructions: string | null; preparation_status: 'MENUNGGU' | 'DIPROSES' | 'SIAP' }>
  payments: Array<{ method: string; status: string; amount: string }>
}

export function getCurrentStaff() {
  return request<{ user: StaffUser }>('/auth/me').then((result) => result.user)
}

export async function loginStaff(email: string, password: string) {
  const result = await request<{ token: string; user: StaffUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  localStorage.setItem('satuang-token', result.token)
  localStorage.setItem('satuang-staff', JSON.stringify(result.user))
  return result.user
}

export function logoutStaff() {
  return request<{ message: string }>('/auth/logout', { method: 'POST' }).finally(() => {
    localStorage.removeItem('satuang-token')
    localStorage.removeItem('satuang-staff')
  })
}

export type AdminCategory = Category & {
  description: string | null
  is_active: boolean
  products_count: number
}
export type AdminItemType = 'food' | 'drink' | 'other'
export type AdminProduct = Omit<Product, 'item_type' | 'category'> & {
  item_type: AdminItemType
  is_active: boolean
  category?: Pick<AdminCategory, 'id' | 'name' | 'slug' | 'sort_order'> | null
}
export type AdminDashboard = {
  stats: {
    active_categories: number
    active_products: number
    unavailable_products: number
    active_bundles?: number
    active_promotions?: number
    active_staff?: number
    open_orders: number
  }
  recent_orders: Array<{ order_number: string; customer_name: string; order_status: string; payment_status: string; total: string; created_at: string }>
}
export type AdminCategoryInput = Pick<AdminCategory, 'name' | 'sort_order' | 'is_active'> & { description: string | null; slug?: string }
export type AdminProductInput = {
  category_id: number | null
  name: string
  slug?: string
  description: string | null
  item_type: AdminItemType
  price: number
  image_path: string | null
  allow_notes: boolean
  is_available: boolean
  is_active: boolean
}

export function getAdminDashboard() {
  return request<AdminDashboard>('/admin/dashboard')
}

export function getAdminCategories() {
  return request<{ categories: AdminCategory[] }>('/admin/categories')
}

export function createAdminCategory(input: AdminCategoryInput) {
  return request<{ category: AdminCategory }>('/admin/categories', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminCategory(categoryId: number, input: AdminCategoryInput) {
  return request<{ category: AdminCategory }>(`/admin/categories/${categoryId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteAdminCategory(categoryId: number) {
  return request<void>(`/admin/categories/${categoryId}`, { method: 'DELETE' })
}

export function getAdminProducts() {
  return request<{ products: AdminProduct[] }>('/admin/products')
}

export function createAdminProduct(input: AdminProductInput) {
  return request<{ product: AdminProduct }>('/admin/products', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminProduct(productId: number, input: AdminProductInput) {
  return request<{ product: AdminProduct }>(`/admin/products/${productId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteAdminProduct(productId: number) {
  return request<void>(`/admin/products/${productId}`, { method: 'DELETE' })
}

export type AdminBundle = {
  id: number
  name: string
  slug: string
  description: string | null
  price: string
  image_path: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  products: Array<{ id: number; name: string; price: string; item_type: string; is_available: boolean; pivot: { quantity: number } }>
}
export type AdminBundleInput = {
  name: string
  slug?: string
  description: string | null
  price: number
  image_path: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  components: Array<{ product_id: number; quantity: number }>
}

export function getAdminBundles() {
  return request<{ bundles: AdminBundle[] }>('/admin/bundles')
}

export function createAdminBundle(input: AdminBundleInput) {
  return request<{ bundle: AdminBundle }>('/admin/bundles', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminBundle(bundleId: number, input: AdminBundleInput) {
  return request<{ bundle: AdminBundle }>(`/admin/bundles/${bundleId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteAdminBundle(bundleId: number) {
  return request<void>(`/admin/bundles/${bundleId}`, { method: 'DELETE' })
}

export type AdminPromotion = {
  id: number
  code: string
  name: string
  description: string | null
  discount_type: 'fixed' | 'percent'
  discount_value: string
  min_spend: string
  max_discount: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}
export type AdminPromotionInput = {
  code: string
  name: string
  description: string | null
  discount_type: 'fixed' | 'percent'
  discount_value: number
  min_spend: number
  max_discount: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

export function getAdminPromotions() {
  return request<{ promotions: AdminPromotion[] }>('/admin/promotions')
}

export function createAdminPromotion(input: AdminPromotionInput) {
  return request<{ promotion: AdminPromotion }>('/admin/promotions', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminPromotion(promotionId: number, input: AdminPromotionInput) {
  return request<{ promotion: AdminPromotion }>(`/admin/promotions/${promotionId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteAdminPromotion(promotionId: number) {
  return request<void>(`/admin/promotions/${promotionId}`, { method: 'DELETE' })
}

export type AdminBanner = {
  id: number
  title: string
  subtitle: string | null
  image_path: string | null
  link_url: string | null
  sort_order: number
  is_active: boolean
}
export type AdminBannerInput = {
  title: string
  subtitle: string | null
  image_path: string | null
  link_url: string | null
  sort_order: number
  is_active: boolean
}

export function getAdminBanners() {
  return request<{ banners: AdminBanner[] }>('/admin/banners')
}

export function createAdminBanner(input: AdminBannerInput) {
  return request<{ banner: AdminBanner }>('/admin/banners', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminBanner(bannerId: number, input: AdminBannerInput) {
  return request<{ banner: AdminBanner }>(`/admin/banners/${bannerId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteAdminBanner(bannerId: number) {
  return request<void>(`/admin/banners/${bannerId}`, { method: 'DELETE' })
}

export type AdminStaffUser = {
  id: number
  name: string
  email: string
  role: 'admin' | 'cashier'
  is_active: boolean
  created_at: string
}
export type AdminStaffInput = {
  name: string
  email: string
  password?: string
  role: 'admin' | 'cashier'
  is_active?: boolean
}

export function getAdminStaff() {
  return request<{ staff: AdminStaffUser[] }>('/admin/staff')
}

export function createAdminStaff(input: AdminStaffInput) {
  return request<{ staff: AdminStaffUser }>('/admin/staff', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminStaff(userId: number, input: AdminStaffInput) {
  return request<{ staff: AdminStaffUser }>(`/admin/staff/${userId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function toggleAdminStaffStatus(userId: number) {
  return request<{ staff: AdminStaffUser }>(`/admin/staff/${userId}/toggle-status`, { method: 'PATCH' })
}

export function getAdminOrders(search = '', status = '') {
  const query = new URLSearchParams()
  if (search.trim()) query.set('q', search.trim())
  if (status.trim()) query.set('status', status.trim())
  return request<{ orders: StaffOrder[] }>(`/admin/orders${query.size ? `?${query}` : ''}`)
}

export type AdminAuditLog = {
  id: number
  action: string
  subject_type: string | null
  subject_id: string | null
  before_snapshot: string | null
  after_snapshot: string | null
  ip_address: string | null
  created_at: string
  actor_name: string | null
  actor_email: string | null
}

export function getAdminAuditLogs() {
  return request<{ audit_logs: AdminAuditLog[] }>('/admin/audit-logs')
}

export function getCashierOrders(completed = false, search = '') {
  const query = new URLSearchParams()
  if (search.trim()) query.set('q', search.trim())
  return request<{ orders: StaffOrder[] }>(`/cashier/orders${completed ? '/completed' : ''}${query.size ? `?${query}` : ''}`)
}

export type CashierProduct = {
  id: number
  name: string
  item_type: string
  price: string
  is_available: boolean
}

export function getCashierProducts() {
  return request<{ products: CashierProduct[] }>('/cashier/products')
}

export function updateCashierProductAvailability(productId: number, is_available: boolean) {
  return request<{ product: CashierProduct }>(`/cashier/products/${productId}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ is_available }),
  })
}

export function confirmCashPayment(orderNumber: string) {
  return request<{ order: StaffOrder }>(`/cashier/orders/${encodeURIComponent(orderNumber)}/confirm-payment`, { method: 'POST' })
}

export function updatePreparationGroupStatus(orderNumber: string, itemType: string, status: 'DIPROSES' | 'SIAP') {
  return request<{ item_type: string; order_status: string }>(`/cashier/orders/${encodeURIComponent(orderNumber)}/preparation-groups`, {
    method: 'PATCH',
    body: JSON.stringify({ item_type: itemType, status }),
  })
}

export function completeCashierOrder(orderNumber: string) {
  return request<{ order: StaffOrder }>(`/cashier/orders/${encodeURIComponent(orderNumber)}/complete`, { method: 'POST' })
}
