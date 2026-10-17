import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  completeCashierOrder,
  confirmCashPayment,
  getCashierOrders,
  getCashierProducts,
  getCurrentStaff,
  loginStaff,
  logoutStaff,
  updateCashierBundleAvailability,
  updateCashierProductAvailability,
  updatePreparationGroupStatus,
  type CashierProduct,
  type StaffOrder,
  type StaffUser,
} from '../../api'
import type { CustomerBundle } from '../../types'
import '../../styles/cashier.css'
import { dateTime, escapeHtml, rupiah, todayLabel } from '../../utils/formatters'
import { orderStatusLabels, paymentStatusLabels, preparationGroupLabel } from '../../utils/constants'

type CashierView = 'orders' | 'menu'
type OrderTab = 'active' | 'completed'
type QueueFilter = '' | 'MENUNGGU_PEMBAYARAN' | 'PESANAN_DITERIMA' | 'SEDANG_DIBUAT' | 'SIAP_DIAMBIL'

const orderFilters: Array<{ value: QueueFilter; label: string }> = [
  { value: '', label: 'Semua' },
  { value: 'MENUNGGU_PEMBAYARAN', label: 'Pembayaran' },
  { value: 'PESANAN_DITERIMA', label: 'Diterima' },
  { value: 'SEDANG_DIBUAT', label: 'Diproses' },
  { value: 'SIAP_DIAMBIL', label: 'Siap diambil' },
]

const hasStoredStaffToken = typeof window !== 'undefined' && Boolean(window.localStorage.getItem('satuang-token'))
const isCashierRole = (user: StaffUser) => user.role === 'cashier' || user.role === 'admin'
const productTypeLabel = (type: CashierProduct['item_type']) => preparationGroupLabel(type)

function printMarkup(order: StaffOrder) {
  const created = escapeHtml(dateTime(order.created_at))
  const itemRows = order.items.map((item) => `<tr><td>${escapeHtml(item.quantity)}× ${escapeHtml(item.product_name_snapshot)}${item.special_instructions ? `<small>${escapeHtml(item.special_instructions)}</small>` : ''}</td><td>${escapeHtml(rupiah(item.line_total))}</td></tr>`).join('')
  const groupedItems = new Map<string, StaffOrder['items']>()
  for (const item of order.items) {
    const type = item.item_type || 'other'
    groupedItems.set(type, [...(groupedItems.get(type) ?? []), item])
  }
  const kotGroups = Array.from(groupedItems.entries()).map(([type, items]) => `<h3>${escapeHtml(preparationGroupLabel(type).toUpperCase())}</h3>${items.map((item) => `<div class="kot-item"><b>${escapeHtml(item.quantity)}× ${escapeHtml(item.product_name_snapshot)}</b>${item.special_instructions ? `<p>Catatan: ${escapeHtml(item.special_instructions)}</p>` : ''}</div>`).join('')}`).join('')
  const discounts = Number(order.discount_total) + Number(order.points_discount)
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Pesanan ${escapeHtml(order.order_number)}</title><style>*{box-sizing:border-box}body{margin:0;color:#171717;font:12px/1.45 Arial,sans-serif}.paper{width:72mm;margin:0 auto;padding:4mm 2mm}.brand{text-align:center;margin-bottom:12px}.brand b{display:block;font-size:18px;letter-spacing:1px}.brand small{font-size:9px;letter-spacing:1.5px}.ticket-head{text-align:center;border-top:1px dashed #555;border-bottom:1px dashed #555;padding:8px 0;margin:8px 0}.ticket-head strong{display:block;font-size:17px;letter-spacing:.8px}.muted{color:#555;font-size:10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:8px 0}table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:6px 0;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}td small{display:block;color:#555;font-size:9px}tfoot td{border-top:1px dashed #555}.total td{font-weight:bold;font-size:14px}.thank{text-align:center;border-top:1px dashed #555;margin-top:12px;padding-top:8px;font-size:10px}.kot{page-break-before:always}.kot-item{padding:9px 0;border-bottom:1px solid #bbb;font-size:15px}.kot-item p{font-size:12px;margin:4px 0 0}.kot h2{text-align:center;font-size:18px}.kot h3{font-size:11px;letter-spacing:1px;border-bottom:1px solid #333;padding-bottom:3px}@media print{@page{size:80mm auto;margin:4mm}.paper{width:auto;padding:0}.kot{break-before:page;page-break-before:always}}</style></head><body><section class="paper invoice"><div class="brand"><b>SA.TUANG COFFEE</b><small>BANJAR WIJAYA</small></div><div class="ticket-head"><strong>INVOICE</strong><span>${escapeHtml(order.order_number)}</span></div><div class="meta"><span>Pelanggan</span><b>${escapeHtml(order.customer_name)}</b><span>Waktu</span><b>${created}</b><span>Pembayaran</span><b>${escapeHtml(order.payment_method.toUpperCase())}</b></div><table><tbody>${itemRows}</tbody><tfoot><tr><td>Subtotal</td><td>${escapeHtml(rupiah(order.subtotal))}</td></tr>${discounts > 0 ? `<tr><td>Diskon</td><td>−${escapeHtml(rupiah(discounts))}</td></tr>` : ''}<tr class="total"><td>Total</td><td>${escapeHtml(rupiah(order.total))}</td></tr></tfoot></table><div class="thank">Terima kasih telah berkunjung.</div></section><section class="paper kot"><div class="brand"><b>SA.TUANG COFFEE</b><small>BANJAR WIJAYA</small></div><div class="ticket-head"><h2>KITCHEN ORDER TICKET</h2><strong>${escapeHtml(order.order_number)}</strong><span>${created}</span></div><div class="meta"><span>Pelanggan</span><b>${escapeHtml(order.customer_name)}</b></div>${kotGroups}</section><script>window.addEventListener('afterprint',()=>window.close());window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script></body></html>`
}

function openPrintWindow(order: StaffOrder) {
  const popup = window.open('', '_blank', 'width=460,height=800')
  if (!popup) return false
  popup.document.open()
  popup.document.write(printMarkup(order))
  popup.document.close()
  return true
}

export default function CashierApp() {
  const [staff, setStaff] = useState<StaffUser | null>(null)
  const [sessionChecking, setSessionChecking] = useState(hasStoredStaffToken)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [view, setView] = useState<CashierView>('orders')
  const [tab, setTab] = useState<OrderTab>('active')
  const [search, setSearch] = useState('')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('')
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null)
  const [products, setProducts] = useState<CashierProduct[]>([])
  const [bundles, setBundles] = useState<CustomerBundle[]>([])
  const [menuTab, setMenuTab] = useState<'all' | 'products' | 'bundles'>('all')
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('satuang-token')) return
    getCurrentStaff().then((user) => {
      if (!isCashierRole(user)) {
        localStorage.removeItem('satuang-token')
        localStorage.removeItem('satuang-staff')
        setLoginError('Akun ini tidak memiliki akses Kasir.')
        return
      }
      setStaff(user)
    }).catch(() => {
      localStorage.removeItem('satuang-token')
      localStorage.removeItem('satuang-staff')
    }).finally(() => setSessionChecking(false))
  }, [])

  const refreshOrders = useCallback(async (quiet = false) => {
    if (!staff) return
    if (!quiet) setLoadingOrders(true)
    try {
      const response = await getCashierOrders(tab === 'completed', search)
      setOrders(response.orders)
      setError('')
      setSelectedOrderNumber((selected) => selected && response.orders.some((order) => order.order_number === selected) ? selected : response.orders[0]?.order_number ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesanan belum dapat dimuat. Coba muat ulang.')
    } finally {
      setLoadingOrders(false)
    }
  }, [staff, tab, search])

  useEffect(() => {
    if (!staff || view !== 'orders') return
    const timer = window.setTimeout(() => { void refreshOrders() }, search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [staff, view, refreshOrders, search])

  useEffect(() => {
    if (!staff || view !== 'orders') return
    const timer = window.setInterval(() => { void refreshOrders(true) }, 20000)
    return () => window.clearInterval(timer)
  }, [staff, view, refreshOrders])

  useEffect(() => {
    if (!staff || view !== 'menu') return
    let active = true
    getCashierProducts().then((response) => {
      if (active) {
        setProducts(response.products)
        setBundles(response.bundles ?? [])
      }
    })
      .catch((cause: Error) => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoadingProducts(false) })
    return () => { active = false }
  }, [staff, view])

  const filteredOrders = useMemo(() => orders.filter((order) => !queueFilter || order.order_status === queueFilter), [orders, queueFilter])
  const selectedOrder = useMemo(() => orders.find((order) => order.order_number === selectedOrderNumber) ?? null, [orders, selectedOrderNumber])
  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${productTypeLabel(product.item_type)}`.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch])
  const filteredBundles = useMemo(() => bundles.filter((bundle) => `${bundle.name} ${bundle.description ?? ''}`.toLowerCase().includes(productSearch.toLowerCase())), [bundles, productSearch])
  const selectedPreparationGroups = useMemo(() => {
    if (!selectedOrder) return []
    const grouped = new Map<string, StaffOrder['items']>()
    for (const item of selectedOrder.items) {
      const itemType = item.item_type || 'other'
      grouped.set(itemType, [...(grouped.get(itemType) ?? []), item])
    }
    return Array.from(grouped.entries()).map(([itemType, items]) => ({
      itemType,
      label: preparationGroupLabel(itemType),
      items,
      readyCount: items.filter((item) => item.preparation_status === 'SIAP').length,
      status: items.every((item) => item.preparation_status === 'SIAP') ? 'SIAP' : items.some((item) => item.preparation_status !== 'MENUNGGU') ? 'DIPROSES' : 'MENUNGGU',
      allProcessing: items.every((item) => item.preparation_status === 'DIPROSES'),
    }))
  }, [selectedOrder])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError('')
    setLoginBusy(true)
    try {
      const user = await loginStaff(loginEmail.trim(), loginPassword)
      if (!isCashierRole(user)) {
        try { await logoutStaff() } catch { /* access token is cleared by logoutStaff */ }
        throw new Error('Akun ini tidak memiliki akses Kasir.')
      }
      setStaff(user)
      setLoginPassword('')
      setView('orders')
      setNotice('')
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : 'Tidak dapat masuk. Periksa kembali akun dan kata sandi.')
    } finally {
      setLoginBusy(false)
    }
  }

  async function signOut() {
    try { await logoutStaff() } catch { /* logoutStaff always clears local session */ }
    setStaff(null)
    setOrders([])
    setProducts([])
    setSelectedOrderNumber(null)
    setLoginPassword('')
  }

  async function handleConfirmCash(order: StaffOrder) {
    const popup = window.open('', '_blank', 'width=460,height=800')
    setBusyAction(`payment:${order.order_number}`)
    setError('')
    setNotice('')
    try {
      const result = await confirmCashPayment(order.order_number)
      if (popup) {
        popup.document.open()
        popup.document.write(printMarkup(result.order))
        popup.document.close()
      } else {
        setNotice('Pembayaran berhasil dikonfirmasi. Jika dialog cetak tidak muncul, pilih “Cetak invoice + KOT” pada detail pesanan.')
      }
      setSelectedOrderNumber(order.order_number)
      await refreshOrders(true)
    } catch (cause) {
      popup?.close()
      setError(cause instanceof Error ? cause.message : 'Pembayaran belum dapat dikonfirmasi.')
      await refreshOrders(true)
    } finally {
      setBusyAction('')
    }
  }

  async function handlePreparationGroupStatus(orderNumber: string, itemType: string, status: 'DIPROSES' | 'SIAP') {
    setBusyAction(`group:${orderNumber}:${itemType}`)
    setError('')
    try {
      await updatePreparationGroupStatus(orderNumber, itemType, status)
      await refreshOrders(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status kategori belum dapat diperbarui.')
      await refreshOrders(true)
    } finally {
      setBusyAction('')
    }
  }

  async function handleComplete(order: StaffOrder) {
    setBusyAction(`complete:${order.order_number}`)
    setError('')
    setNotice('')
    try {
      await completeCashierOrder(order.order_number)
      setNotice(`Pesanan ${order.order_number} selesai dan dipindahkan ke riwayat.`)
      await refreshOrders(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesanan belum dapat diselesaikan.')
      await refreshOrders(true)
    } finally {
      setBusyAction('')
    }
  }

  async function handleAvailability(product: CashierProduct) {
    setBusyAction(`product:${product.id}`)
    setError('')
    try {
      const response = await updateCashierProductAvailability(product.id, !product.is_available)
      setProducts((current) => current.map((item) => item.id === product.id ? response.product : item))
      setNotice(`${product.name} ${response.product.is_available ? 'tersedia kembali' : 'ditandai habis'}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ketersediaan menu belum dapat diperbarui.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleBundleAvailability(bundle: CustomerBundle) {
    const nextState = !bundle.is_active
    setBusyAction(`bundle:${bundle.id}`)
    setError('')
    try {
      const response = await updateCashierBundleAvailability(bundle.id, nextState)
      setBundles((current) => current.map((item) => item.id === bundle.id ? response.bundle : item))
      setNotice(`Paket ${bundle.name} ${response.bundle.is_active ? 'tersedia kembali' : 'ditandai habis'}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ketersediaan paket menu belum dapat diperbarui.')
    } finally {
      setBusyAction('')
    }
  }

  if (sessionChecking) return <div className="cashier-loading" role="status"><span className="cashier-spinner" />Memeriksa sesi…</div>

  if (!staff) return <main className="cashier-login-page">
    <section className="cashier-login">
      <a className="cashier-brand" href="/" aria-label="SA.TUANG COFFEE"><span className="cashier-brand-mark">S</span><span><strong>SA.TUANG</strong><small>COFFEE · BANJAR WIJAYA</small></span></a>
      <span className="cashier-eyebrow">AKSES OPERASIONAL</span>
      <h1>Masuk Kasir</h1>
      <p className="cashier-login-intro">Gunakan akun staf SA.TUANG COFFEE untuk membuka antrean dan operasional outlet.</p>
      <form onSubmit={submitLogin} className="cashier-login-form">
        <label>Email<input type="email" required autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="nama@contoh.com" /></label>
        <label>Kata sandi<input type="password" required autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Kata sandi" /></label>
        {loginError && <p className="cashier-error" role="alert">{loginError}</p>}
        <button className="cashier-button primary wide" disabled={loginBusy}>{loginBusy ? 'Memeriksa akun…' : 'Masuk ke Kasir'}</button>
      </form>
      <a className="cashier-back-home" href="/">← Kembali ke halaman pelanggan</a>
    </section>
  </main>

  const activeCount = orders.filter((order) => order.order_status === 'MENUNGGU_PEMBAYARAN').length
  return <div className="cashier-app">
    <header className="cashier-topbar">
      <a className="cashier-brand" href="/kasir"><span className="cashier-brand-mark">S</span><span><strong>SA.TUANG</strong><small>COFFEE · BANJAR WIJAYA</small></span></a>
      <div className="cashier-account"><span className="cashier-account-avatar">{staff.name.slice(0, 1).toUpperCase()}</span><span className="cashier-account-copy"><b>{staff.name}</b><small>{staff.role === 'admin' ? 'Administrator' : 'Kasir'}</small></span><button className="cashier-logout" onClick={() => void signOut()}>Keluar</button></div>
    </header>
    <main className="cashier-main">
      <div className="cashier-page-head"><div><span className="cashier-eyebrow">SA.TUANG COFFEE · BANJAR WIJAYA</span><h1>{view === 'orders' ? tab === 'active' ? 'Antrean pesanan' : 'Riwayat pesanan' : 'Ketersediaan menu'}</h1><p>{view === 'orders' ? tab === 'active' ? 'Pantau pembayaran dan alur persiapan setiap pesanan.' : 'Pesanan yang sudah diserahkan kepada pelanggan.' : 'Perbarui status menu sesuai ketersediaan hari ini.'}</p></div><div className="cashier-view-switch"><button className={view === 'orders' ? 'selected' : ''} onClick={() => { setView('orders'); setNotice(''); setError('') }}><span>▤</span> Pesanan</button><button className={view === 'menu' ? 'selected' : ''} onClick={() => { setLoadingProducts(true); setView('menu'); setNotice(''); setError('') }}><span>☕</span> Menu</button></div></div>
      {error && <div className="cashier-alert error" role="alert"><span>!</span>{error}<button aria-label="Tutup pesan" onClick={() => setError('')}>×</button></div>}
      {notice && <div className="cashier-alert success" role="status"><span>✓</span>{notice}<button aria-label="Tutup pesan" onClick={() => setNotice('')}>×</button></div>}

      {view === 'orders' ? <>
        <div className="cashier-summary-row"><div className="cashier-summary-card"><span className="summary-icon amber">◷</span><div><small>PEMBAYARAN CASH</small><strong>{activeCount}</strong></div><span>menunggu</span></div><div className="cashier-summary-card"><span className="summary-icon blue">▤</span><div><small>DI ANTREAN</small><strong>{orders.length}</strong></div><span>{tab === 'active' ? 'pesanan aktif' : 'pesanan selesai'}</span></div><div className="cashier-summary-date"><span>◷</span>{todayLabel}</div></div>
        <div className="cashier-order-tabs"><button className={tab === 'active' ? 'active' : ''} onClick={() => { setTab('active'); setQueueFilter(''); setSelectedOrderNumber(null) }}>Antrean aktif</button><button className={tab === 'completed' ? 'active' : ''} onClick={() => { setTab('completed'); setQueueFilter(''); setSelectedOrderNumber(null) }}>Selesai</button></div>
        <div className="cashier-workspace">
          <section className="cashier-queue-panel" aria-label="Daftar pesanan">
            <div className="queue-panel-head"><div><h2>{tab === 'active' ? 'Antrean hari ini' : 'Pesanan selesai'}</h2><span>{filteredOrders.length} pesanan</span></div><button className="cashier-icon-button" onClick={() => void refreshOrders()} aria-label="Muat ulang pesanan" title="Muat ulang">↻</button></div>
            <label className="cashier-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kode atau nama pelanggan" /></label>
            {tab === 'active' && <div className="cashier-filter-row">{orderFilters.map((filter) => <button key={filter.value || 'all'} className={queueFilter === filter.value ? 'active' : ''} onClick={() => setQueueFilter(filter.value)}>{filter.label}</button>)}</div>}
            <div className="cashier-queue-list">
              {loadingOrders && !orders.length ? <div className="cashier-empty"><span className="cashier-spinner" />Memuat pesanan…</div> : filteredOrders.length ? filteredOrders.map((order) => <button key={order.order_number} className={`cashier-queue-card ${selectedOrderNumber === order.order_number ? 'selected' : ''}`} onClick={() => setSelectedOrderNumber(order.order_number)}><div className="queue-card-top"><strong>{order.order_number}</strong><span className={`cashier-status ${order.order_status.toLowerCase()}`}>{orderStatusLabels[order.order_status] ?? order.order_status}</span></div><div className="queue-customer">{order.customer_name}</div><div className="queue-card-bottom"><span>{order.items.length} item · {dateTime(order.created_at)}</span><b>{rupiah(order.total)}</b></div><div className="queue-payment-line"><span className={`cashier-payment ${order.payment_status === 'BERHASIL' ? 'paid' : ''}`}>{order.payment_method.toUpperCase()} · {paymentStatusLabels[order.payment_status] ?? order.payment_status}</span></div></button>) : <div className="cashier-empty"><span className="empty-cup">☕</span><strong>{search ? 'Pesanan tidak ditemukan' : tab === 'active' ? 'Antrean masih kosong' : 'Belum ada pesanan selesai'}</strong><p>{search ? 'Coba kode antrean atau nama yang berbeda.' : 'Pesanan akan muncul di bagian ini saat tersedia.'}</p></div>}
            </div>
            <div className="queue-auto-refresh"><span className="cashier-live-dot" /> Diperbarui otomatis setiap 20 detik</div>
          </section>
          <section className="cashier-detail-panel" aria-label="Detail pesanan">
            {selectedOrder ? <>
              <div className="detail-topline"><div><span className="cashier-eyebrow">DETAIL PESANAN</span><h2>{selectedOrder.order_number}</h2></div><span className={`cashier-status large ${selectedOrder.order_status.toLowerCase()}`}>{orderStatusLabels[selectedOrder.order_status] ?? selectedOrder.order_status}</span></div>
              <div className="detail-customer"><span className="customer-avatar">{selectedOrder.customer_name.slice(0, 1).toUpperCase()}</span><div><strong>{selectedOrder.customer_name}</strong><small>{selectedOrder.customer_phone || 'Pelanggan'}</small></div><time>{dateTime(selectedOrder.created_at)}</time></div>
              <div className="detail-payment"><div><small>METODE PEMBAYARAN</small><strong>{selectedOrder.payment_method.toUpperCase()}</strong></div><div><small>STATUS PEMBAYARAN</small><strong className={selectedOrder.payment_status === 'BERHASIL' ? 'text-success' : 'text-amber'}>{paymentStatusLabels[selectedOrder.payment_status] ?? selectedOrder.payment_status}</strong></div></div>
              {selectedOrder.payment_method === 'cash' && selectedOrder.payment_status === 'MENUNGGU' && selectedOrder.order_status === 'MENUNGGU_PEMBAYARAN' && <div className="cashier-payment-callout"><span>◉</span><div><strong>Konfirmasi pembayaran tunai</strong><small>Pastikan pembayaran diterima sebelum mengonfirmasi pesanan.</small></div><button className="cashier-button primary" disabled={busyAction === `payment:${selectedOrder.order_number}`} onClick={() => void handleConfirmCash(selectedOrder)}>{busyAction === `payment:${selectedOrder.order_number}` ? 'Menyimpan…' : 'Konfirmasi & cetak'}</button></div>}
              {selectedOrder.payment_status === 'MENUNGGU' && selectedOrder.payment_method !== 'cash' && <div className="cashier-payment-callout waiting"><span>◷</span><div><strong>Menunggu verifikasi pembayaran</strong><small>Pembayaran online akan diproses setelah konfirmasi dari penyedia pembayaran.</small></div></div>}
              <div className="detail-section-head"><div><h3>Item pesanan</h3><span>{selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0)} item</span></div>{selectedOrder.payment_status === 'BERHASIL' && <button className="cashier-button outline compact cashier-print" onClick={() => { if (!openPrintWindow(selectedOrder)) setNotice('Izinkan jendela cetak pada browser untuk mencetak invoice dan KOT.') }}>Cetak invoice + KOT</button>}</div>
              <div className="cashier-order-items">{selectedPreparationGroups.map((group) => {
                const groupActionKey = `group:${selectedOrder.order_number}:${group.itemType}`
                const canUpdateGroup = tab === 'active' && ['PESANAN_DITERIMA', 'SEDANG_DIBUAT', 'SIAP_DIAMBIL'].includes(selectedOrder.order_status)
                return <section className="cashier-preparation-group" key={group.itemType}>
                  <div className="cashier-preparation-head"><div><strong>{group.label}</strong><small>{group.items.length} item · {group.readyCount}/{group.items.length} siap</small></div><div className={`item-preparation ${group.status === 'SIAP' ? 'ready' : group.status === 'DIPROSES' ? 'processing' : ''}`}><span />{group.status === 'SIAP' ? 'Siap' : group.status === 'DIPROSES' ? 'Sedang dibuat' : 'Menunggu persiapan'}</div></div>
                  <div className="cashier-group-items">{group.items.map((item) => <article className="cashier-order-item" key={item.id}><div className="item-type-icon">{item.item_type === 'food' ? '◒' : item.item_type === 'drink' ? '◉' : '◈'}</div><div className="cashier-item-copy"><div className="cashier-item-title"><span>{item.quantity}× {item.product_name_snapshot}</span><span>{rupiah(item.line_total)}</span></div><small>{item.unit_price ? rupiah(item.unit_price) : ''}</small>{item.special_instructions && <p className="item-note">Catatan: {item.special_instructions}</p>}</div></article>)}</div>
                  {canUpdateGroup && <div className="cashier-group-actions">{!group.allProcessing && <button disabled={busyAction === groupActionKey} onClick={() => void handlePreparationGroupStatus(selectedOrder.order_number, group.itemType, 'DIPROSES')}>{group.status === 'SIAP' ? 'Ubah kategori ke proses' : 'Mulai proses'}</button>}{group.readyCount < group.items.length && <button className="ready-action" disabled={busyAction === groupActionKey} onClick={() => void handlePreparationGroupStatus(selectedOrder.order_number, group.itemType, 'SIAP')}>Tandai kategori siap</button>}</div>}
                </section>
              })}</div>
              <div className="cashier-total-box"><div><span>Subtotal</span><span>{rupiah(selectedOrder.subtotal)}</span></div>{Number(selectedOrder.discount_total) + Number(selectedOrder.points_discount) > 0 && <div><span>Diskon</span><span>−{rupiah(Number(selectedOrder.discount_total) + Number(selectedOrder.points_discount))}</span></div>}<div className="grand-total"><strong>Total</strong><strong>{rupiah(selectedOrder.total)}</strong></div></div>
              {tab === 'active' && selectedOrder.order_status === 'SIAP_DIAMBIL' && selectedOrder.payment_status === 'BERHASIL' && <button className="cashier-button complete-order wide" disabled={busyAction === `complete:${selectedOrder.order_number}`} onClick={() => void handleComplete(selectedOrder)}>{busyAction === `complete:${selectedOrder.order_number}` ? 'Menyelesaikan…' : '✓  Tandai pesanan sudah diserahkan'}</button>}
              {selectedOrder.order_status === 'SELESAI' && <div className="order-complete-note"><span>✓</span> Pesanan telah diserahkan kepada pelanggan.</div>}
            </> : <div className="cashier-detail-empty"><span>▤</span><h2>Pilih pesanan</h2><p>Pilih pesanan pada daftar untuk melihat pembayaran, item, dan tindakan yang tersedia.</p></div>}
          </section>
        </div>
      </> : <section className="cashier-menu-page">
        <div className="menu-availability-head">
          <div>
            <h2>Ketersediaan menu & paket</h2>
            <p>Item atau paket yang ditandai habis tidak dapat dipesan oleh pelanggan.</p>
          </div>
          <div className="cashier-menu-filter-row">
            <button className={menuTab === 'all' ? 'active' : ''} onClick={() => setMenuTab('all')}>Semua ({products.length + bundles.length})</button>
            <button className={menuTab === 'products' ? 'active' : ''} onClick={() => setMenuTab('products')}>Menu Satuan ({products.length})</button>
            <button className={menuTab === 'bundles' ? 'active' : ''} onClick={() => setMenuTab('bundles')}>Paket Menu ({bundles.length})</button>
          </div>
          <label className="cashier-search">
            <span>⌕</span>
            <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari menu atau paket" />
          </label>
        </div>
        {loadingProducts ? (
          <div className="cashier-empty"><span className="cashier-spinner" />Memuat menu…</div>
        ) : (filteredProducts.length || filteredBundles.length) ? (
          <div className="cashier-menu-sections">
            {(menuTab === 'all' || menuTab === 'bundles') && filteredBundles.length > 0 && (
              <div className="cashier-menu-group">
                <h3 className="cashier-group-title">🎁 Paket Menu ({filteredBundles.length})</h3>
                <div className="cashier-products-grid">
                  {filteredBundles.map((bundle) => (
                    <article className={`cashier-product-card ${!bundle.is_active ? 'unavailable' : ''}`} key={`bundle-${bundle.id}`}>
                      <div className="cashier-product-icon">🎁</div>
                      <div className="cashier-product-content">
                        <span className="cashier-eyebrow">{bundle.category?.name ? bundle.category.name.toUpperCase() : 'PAKET MENU'}</span>
                        <h3>{bundle.name}</h3>
                        {bundle.components && bundle.components.length > 0 && (
                          <small className="cashier-bundle-hint">
                            {bundle.components.map((c) => `${c.quantity}x ${c.product?.name ?? 'Item'}`).join(', ')}
                          </small>
                        )}
                        <strong>{rupiah(bundle.price)}</strong>
                      </div>
                      <div className="cashier-product-toggle">
                        <span className={bundle.is_active ? 'available' : 'not-available'}>
                          {bundle.is_active ? 'Tersedia' : 'Habis'}
                        </span>
                        <button
                          className={`availability-switch ${bundle.is_active ? 'on' : ''}`}
                          role="switch"
                          aria-checked={bundle.is_active}
                          aria-label={`${bundle.is_active ? 'Tandai habis' : 'Tandai tersedia'}: ${bundle.name}`}
                          disabled={busyAction === `bundle:${bundle.id}`}
                          onClick={() => void handleBundleAvailability(bundle)}
                        >
                          <span />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {(menuTab === 'all' || menuTab === 'products') && filteredProducts.length > 0 && (
              <div className="cashier-menu-group">
                {menuTab === 'all' && filteredBundles.length > 0 && (
                  <h3 className="cashier-group-title">☕ Menu Satuan ({filteredProducts.length})</h3>
                )}
                <div className="cashier-products-grid">
                  {filteredProducts.map((product) => (
                    <article className={`cashier-product-card ${!product.is_available ? 'unavailable' : ''}`} key={product.id}>
                      <div className="cashier-product-icon">
                        {product.item_type === 'food' ? '◒' : product.item_type === 'drink' ? '◉' : '◈'}
                      </div>
                      <div className="cashier-product-content">
                        <span className="cashier-eyebrow">{productTypeLabel(product.item_type)}</span>
                        <h3>{product.name}</h3>
                        <strong>{rupiah(product.price)}</strong>
                      </div>
                      <div className="cashier-product-toggle">
                        <span className={product.is_available ? 'available' : 'not-available'}>
                          {product.is_available ? 'Tersedia' : 'Habis'}
                        </span>
                        <button
                          className={`availability-switch ${product.is_available ? 'on' : ''}`}
                          role="switch"
                          aria-checked={product.is_available}
                          aria-label={`${product.is_available ? 'Tandai habis' : 'Tandai tersedia'}: ${product.name}`}
                          disabled={busyAction === `product:${product.id}`}
                          onClick={() => void handleAvailability(product)}
                        >
                          <span />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="cashier-empty">
            <strong>Menu tidak ditemukan</strong>
            <p>Coba kata kunci lain.</p>
          </div>
        )}
      </section>}
      <footer className="cashier-footer"><span>SA.TUANG COFFEE · BANJAR WIJAYA</span><span>{staff.email}</span></footer>
    </main>
  </div>
}
