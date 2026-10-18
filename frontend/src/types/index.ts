export type Category = {
  id: number
  parent_id?: number | null
  name: string
  slug: string
  item_type?: 'drink' | 'food'
  sort_order?: number
  description?: string | null
  parent?: Category | null
  children?: Category[]
}

export type BundleComponentItem = {
  id: number
  bundle_id: number
  product_id: number
  quantity: number
  product: {
    id: number
    name: string
    price: string
    item_type: 'food' | 'drink'
    is_available: boolean
  }
}

export type CustomerBundle = {
  id: number
  category_id?: number | null
  category?: Category | null
  name: string
  slug: string
  description: string | null
  price: string
  image_path: string | null
  is_active: boolean
  components?: BundleComponentItem[]
}

export type Product = {
  id: number
  category_id: number | null
  name: string
  slug: string
  description: string | null
  item_type: 'food' | 'drink'
  price: string
  image_path: string | null
  allow_notes: boolean
  is_available: boolean
  category?: Category | null
}

export type OrderReceipt = {
  order: {
    id: number
    order_number: string
    daily_ticket_number?: string | null
    customer_name: string
    order_status: string
    payment_status: string
    total: string
    created_at: string
    expires_at?: string | null
  }
  message: string
}

export type TrackedOrder = {
  order: {
    order_number: string
    daily_ticket_number?: string | null
    order_status: string
    payment_status: string
    created_at: string
    items: Array<{
      name: string
      item_type: 'food' | 'drink'
      quantity: number
      preparation_status: string
    }>
  }
}

export type CustomerProfile = {
  id: number
  name: string
  email: string
  phone: string
  points_balance: number
}

export type CustomerOrderRecord = {
  id: number
  order_number: string
  daily_ticket_number?: string | null
  customer_name: string
  customer_phone?: string | null
  order_status: string
  payment_status: string
  payment_method: string
  subtotal: string
  discount_total: string
  total: string
  created_at: string
  expires_at?: string | null
  items: Array<{
    id: number
    product_name_snapshot: string
    item_type: string
    quantity: number
    unit_price: string
    line_total: string
    special_instructions?: string | null
    preparation_status: string
  }>
}

export type CustomerBanner = {
  id: number
  title: string
  subtitle: string | null
  image_path: string | null
  link_url: string | null
}
