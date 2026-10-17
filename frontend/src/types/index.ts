export type Category = {
  id: number
  name: string
  slug: string
  sort_order?: number
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
    customer_name: string
    order_status: string
    payment_status: string
    total: string
    created_at: string
  }
  message: string
}

export type TrackedOrder = {
  order: {
    order_number: string
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

export type CustomerBanner = {
  id: number
  title: string
  subtitle: string | null
  image_path: string | null
  link_url: string | null
}
