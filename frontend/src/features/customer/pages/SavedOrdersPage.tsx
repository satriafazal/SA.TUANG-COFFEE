import type { CustomerMode, PrototypeOrder } from '../../../state/prototypeState'
import type { TrackedOrder } from '../../../types'
import { orderStatusLabels, paymentStatusLabels } from '../../../utils/constants'
import { orderDateFormatter, rupiah } from '../../../utils/formatters'
import type { Screen } from '../components/CustomerHeader'

interface SavedOrdersPageProps {
  isMember: boolean
  sessionMode: CustomerMode
  currentOrders: PrototypeOrder[]
  tracked: Record<string, TrackedOrder['order']>
  trackingOrder: string
  trackError: string
  authNotice: string
  copyOrderNumber: (num: string) => void
  refreshOrder: (order: PrototypeOrder) => void
  moveTo: (screen: Screen) => void
}

export function SavedOrdersPage({
  isMember,
  sessionMode,
  currentOrders,
  tracked,
  trackingOrder,
  trackError,
  authNotice,
  copyOrderNumber,
  refreshOrder,
  moveTo,
}: SavedOrdersPageProps) {
  return (
    <section
      className={`orders-page ${isMember ? 'member-orders-page' : 'guest-orders-page'}`}
    >
      <div className="orders-heading">
        <div>
          <span className="eyebrow">
            {isMember ? 'AREA MEMBER' : 'AREA GUEST'} · PESANAN TERSIMPAN
          </span>
          <h1>{isMember ? 'Pesanan Member.' : 'Pesanan saya.'}</h1>
          <p>
            {isMember
              ? 'Riwayat pesanan yang tertaut ke akun Member ini.'
              : 'Pesananmu akan tetap muncul di browser ini setelah halaman di-refresh.'}
          </p>
        </div>
        <button
          className="button button-accent"
          onClick={() => moveTo('order-menu')}
        >
          Pesan lagi <span>↗</span>
        </button>
      </div>

      {trackError && (
        <p className="form-error" role="alert">
          {trackError}
        </p>
      )}

      {authNotice && (
        <p className="form-notice" role="status">
          {authNotice}
        </p>
      )}

      {currentOrders.length ? (
        <div className="orders-list">
          {currentOrders.map((order) => {
            const live = tracked[order.orderNumber]
            const orderStatus = live?.order_status ?? order.orderStatus
            const paymentStatus = live?.payment_status ?? order.paymentStatus

            return (
              <article
                className="saved-order-card"
                key={order.orderNumber}
              >
                <div className="saved-order-top">
                  <div>
                    <span className="eyebrow">KODE ANTREAN</span>
                    <strong className="saved-order-number">
                      {order.orderNumber}
                    </strong>
                    <small>
                      {orderDateFormatter.format(
                        Date.parse(order.createdAt),
                      )}
                    </small>
                  </div>
                  <span
                    className={`status-pill ${
                      orderStatus === 'SELESAI' ? 'success' : ''
                    }`}
                  >
                    {orderStatusLabels[orderStatus] ?? orderStatus}
                  </span>
                </div>

                <div className="saved-order-items">
                  {order.items.map((item, index) => (
                    <div
                      className="saved-order-item"
                      key={`${order.orderNumber}-${index}`}
                    >
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <span>
                        {rupiah(Number(item.price) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="saved-order-total">
                  <span>
                    Total ·{' '}
                    {paymentStatusLabels[paymentStatus] ??
                      orderStatusLabels[paymentStatus] ??
                      paymentStatus}
                  </span>
                  <strong>{rupiah(order.total)}</strong>
                </div>

                <div className="saved-order-actions">
                  <button
                    className="button button-outline"
                    onClick={() => copyOrderNumber(order.orderNumber)}
                  >
                    Salin kode
                  </button>
                  <button
                    className="button button-dark"
                    disabled={trackingOrder === order.orderNumber}
                    onClick={() => refreshOrder(order)}
                  >
                    {trackingOrder === order.orderNumber
                      ? 'Memperbarui…'
                      : 'Perbarui status'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-orders">
          <span>☕</span>
          <h2>Belum ada pesanan tersimpan</h2>
          <p>
            Setelah kamu membuat pesanan, kode antrean dan statusnya akan
            muncul di sini.
          </p>
          <button
            className="button button-accent"
            onClick={() => moveTo('order-menu')}
          >
            Mulai pesan <span>↗</span>
          </button>
        </div>
      )}

      {sessionMode === 'guest' && (
        <div className="guest-recovery-inline">
          <span className="eyebrow">TIDAK MENEMUKAN KODE?</span>
          <p>
            Jika memasukkan nomor HP saat checkout, gunakan nomor yang sama untuk
            mencari pesanan.
          </p>
          <button
            className="text-button"
            onClick={() => moveTo('recovery')}
          >
            Lupa kode antrean?
          </button>
        </div>
      )}
    </section>
  )
}
