import { preparationGroupLabel } from './constants'

export interface OrderGroupItem {
  id?: number
  name: string
  item_type: 'drink' | 'food'
  quantity: number
  unit_price?: string | number
  line_total?: string | number
  special_instructions?: string | null
  preparation_status: string
}

export interface OrderCategoryGroup {
  itemType: 'drink' | 'food'
  label: string
  items: OrderGroupItem[]
  readyCount: number
  totalCount: number
  status: 'SIAP' | 'DIPROSES' | 'MENUNGGU'
}

export function groupOrderItemsByCategory(
  items: Array<{
    id?: number
    product_name_snapshot?: string
    name?: string
    item_type?: string
    quantity: number
    unit_price?: string | number
    line_total?: string | number
    special_instructions?: string | null
    preparation_status: string
  }>,
): OrderCategoryGroup[] {
  const grouped = new Map<'drink' | 'food', OrderGroupItem[]>()

  for (const raw of items) {
    const itemType: 'drink' | 'food' = raw.item_type === 'food' ? 'food' : 'drink'
    const item: OrderGroupItem = {
      id: raw.id,
      name: raw.product_name_snapshot || raw.name || 'Menu',
      item_type: itemType,
      quantity: raw.quantity,
      unit_price: raw.unit_price,
      line_total: raw.line_total,
      special_instructions: raw.special_instructions,
      preparation_status: raw.preparation_status || 'MENUNGGU',
    }
    grouped.set(itemType, [...(grouped.get(itemType) ?? []), item])
  }

  const categoryOrder: Array<'drink' | 'food'> = ['drink', 'food']
  const result: OrderCategoryGroup[] = []

  for (const type of categoryOrder) {
    const groupItems = grouped.get(type)
    if (!groupItems || groupItems.length === 0) continue

    const readyCount = groupItems.filter((i) => i.preparation_status === 'SIAP').length
    const status: 'SIAP' | 'DIPROSES' | 'MENUNGGU' = groupItems.every(
      (i) => i.preparation_status === 'SIAP',
    )
      ? 'SIAP'
      : groupItems.some((i) => i.preparation_status !== 'MENUNGGU')
      ? 'DIPROSES'
      : 'MENUNGGU'

    result.push({
      itemType: type,
      label: preparationGroupLabel(type),
      items: groupItems,
      readyCount,
      totalCount: groupItems.length,
      status,
    })
  }

  return result
}
