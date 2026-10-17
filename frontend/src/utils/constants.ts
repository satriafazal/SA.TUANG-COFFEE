/**
 * Shared domain labels and constants for SA.TUANG COFFEE
 */

export const orderStatusLabels: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: 'Menunggu pembayaran',
  PESANAN_DITERIMA: 'Pesanan diterima',
  SEDANG_DIBUAT: 'Sedang dibuat',
  SIAP_DIAMBIL: 'Siap diambil',
  SELESAI: 'Selesai',
  MENUNGGU: 'Menunggu',
  BERHASIL: 'Terkonfirmasi',
  SIAP: 'Siap',
  DIPROSES: 'Sedang dibuat',
}

export const paymentStatusLabels: Record<string, string> = {
  MENUNGGU: 'Menunggu',
  BERHASIL: 'Berhasil',
  GAGAL: 'Gagal',
  KADALUWARSA: 'Kedaluwarsa',
  REFUND_SEBAGIAN: 'Refund sebagian',
  REFUND_PENUH: 'Refund penuh',
}

export const preparationGroupLabel = (type: string): string => {
  if (type === 'food') return 'Makanan'
  if (type === 'drink') return 'Minuman'
  return 'Lainnya'
}
