import type { CustomerOrderRecord } from '../../../types'
import { orderStatusLabels, paymentStatusLabels } from '../../../utils/constants'
import { orderDateFormatter, rupiah } from '../../../utils/formatters'
import { groupOrderItemsByCategory } from '../../../utils/orderGroups'
import type { Screen } from '../components/CustomerHeader'

interface SavedOrdersPageProps {
  isMember: boolean
  sessionMode: 'guest' | 'member'
  currentOrders: CustomerOrderRecord[]
  copyOrderNumber: (num: string) => void
  refreshOrders: () => void
  isRefreshing?: boolean
  moveTo: (screen: Screen) => void
  onCompleteOrder?: (orderNumber: string) => Promise<void> | void
  completingOrderNumber?: string | null
}

export function SavedOrdersPage({
  isMember,
  sessionMode: _sessionMode,
  currentOrders,
  copyOrderNumber,
  refreshOrders,
  isRefreshing,
  moveTo,
  onCompleteOrder,
  completingOrderNumber,
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
              ? 'Riwayat pesanan yang tertaut ke akun Member ini di server pusat.'
              : 'Pesananmu otomatis tersimpan di server pusat dan terhubung ke perangkat ini.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="button button-outline"
            onClick={refreshOrders}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Memuat…' : '↻ Perbarui'}
          </button>
          <button
            className="button button-accent"
            onClick={() => moveTo('order-menu')}
          >
            Pesan lagi <span>↗</span>
          </button>
        </div>
      </div>

      {currentOrders.length ? (
        <div className="orders-list">
          {currentOrders.map((order) => {
            const prepGroups = groupOrderItemsByCategory(order.items)
            const isReadyForPickup = order.order_status === 'SIAP_DIAMBIL'
            const isCompleted = order.order_status === 'SELESAI'

            return (
              <article
                className="saved-order-card"
                key={order.order_number}
              >
                <div className="saved-order-top">
                  <div>
                    <div className="order-ticket-row">
                      <span className="eyebrow" style={{ margin: 0 }}>NO. ANTREAN</span>
                      {order.daily_ticket_number && (
                        <span className="order-ticket-badge">
                          <span className="ticket-label">TICKET</span>
                          <span className="ticket-num">{order.daily_ticket_number}</span>
                        </span>
                      )}
                    </div>
                    <strong className="saved-order-number">
                      {order.order_number}
                    </strong>
                    <small>
                      {orderDateFormatter.format(
                        Date.parse(order.created_at),
                      )}
                    </small>
                  </div>
                  <span
                    className={`status-pill ${
                      order.order_status === 'SELESAI'
                        ? 'success'
                        : order.order_status === 'SIAP_DIAMBIL'
                        ? 'ready'
                        : order.order_status === 'DIBATALKAN'
                        ? 'danger'
                        : ''
                    }`}
                  >
                    {orderStatusLabels[order.order_status] ?? order.order_status}
                  </span>
                </div>

                {/* Status berdasarkan kategori persiapan item */}
                <div className="saved-order-prep-groups">
                  {prepGroups.map((group) => (
                    <div className="customer-prep-group" key={group.itemType}>
                      <div className="customer-prep-head">
                        <div className="customer-prep-title">
                          <div className="customer-prep-icon-box" aria-hidden="true">
                            {group.itemType === 'food' ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8" />
                                <path d="M4 8h16" />
                                <path d="M12 4v4" />
                                <path d="M8 4h8" />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                                <line x1="6" y1="1" x2="6" y2="4" />
                                <line x1="10" y1="1" x2="10" y2="4" />
                                <line x1="14" y1="1" x2="14" y2="4" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <strong>{group.label}</strong>
                            <small>
                              {group.items.length} item · {group.readyCount}/{group.totalCount} siap
                            </small>
                          </div>
                        </div>
                        <span
                          className={`customer-prep-status-pill ${
                            group.status === 'SIAP'
                              ? 'ready'
                              : group.status === 'DIPROSES'
                              ? 'processing'
                              : 'waiting'
                          }`}
                        >
                          <span className="prep-dot" />
                          {group.status === 'SIAP'
                            ? 'Siap'
                            : group.status === 'DIPROSES'
                            ? 'Sedang dibuat'
                            : 'Menunggu'}
                        </span>
                      </div>

                      <div className="customer-prep-items">
                        {group.items.map((item, itemIdx) => (
                          <div className="customer-prep-item" key={item.id ?? itemIdx}>
                            <div className="prep-item-main">
                              <span className="prep-item-qty">{item.quantity}×</span>
                              <div className="prep-item-name-box">
                                <span className="prep-item-name">{item.name}</span>
                                {item.special_instructions && (
                                  <span className="prep-item-note">
                                    Catatan: {item.special_instructions}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="prep-item-meta">
                              {item.line_total !== undefined && (
                                <span className="prep-item-price">
                                  {rupiah(Number(item.line_total))}
                                </span>
                              )}
                              <span
                                className={`prep-item-chip ${
                                  item.preparation_status === 'SIAP'
                                    ? 'ready'
                                    : item.preparation_status === 'DIPROSES'
                                    ? 'processing'
                                    : 'waiting'
                                }`}
                              >
                                {item.preparation_status === 'SIAP'
                                  ? 'Siap'
                                  : item.preparation_status === 'DIPROSES'
                                  ? 'Diproses'
                                  : 'Menunggu'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Banner / Button siap diambil */}
                {isReadyForPickup && (
                  <div className="customer-pickup-callout">
                    <div className="pickup-callout-top">
                      <span className="pickup-eyebrow">STATUS · SIAP DIAMBIL</span>
                    </div>
                    <div className="pickup-callout-copy">
                      <div className="pickup-callout-icon-box" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                      </div>
                      <div>
                        <strong>Semua pesanan sudah siap diambil!</strong>
                        <p>Silakan menuju meja penyerahan / bar untuk mengambil pesananmu.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button button-pickup-complete"
                      disabled={completingOrderNumber === order.order_number}
                      onClick={() => onCompleteOrder?.(order.order_number)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {completingOrderNumber === order.order_number
                        ? 'Menyelesaikan…'
                        : 'Pesanan Selesai / Sudah Diambil'}
                    </button>
                  </div>
                )}

                {/* Banner pesanan selesai */}
                {isCompleted && (
                  <div className="customer-order-finished-banner">
                    <div className="finished-icon-box" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <strong>Pesanan Selesai</strong>
                      <p>Pesanan telah diserahkan dan selesai. Terima kasih telah berkunjung ke SA.TUANG COFFEE!</p>
                    </div>
                  </div>
                )}

                <div className="saved-order-total">
                  <span>
                    Total ·{' '}
                    {paymentStatusLabels[order.payment_status] ??
                      orderStatusLabels[order.payment_status] ??
                      order.payment_status}
                  </span>
                  <strong>{rupiah(order.total)}</strong>
                </div>

                <div className="saved-order-actions">
                  <button
                    className="button button-outline"
                    onClick={() => copyOrderNumber(order.order_number)}
                  >
                    Salin kode
                  </button>
                  <button
                    className="button button-dark"
                    disabled={isRefreshing}
                    onClick={refreshOrders}
                  >
                    {isRefreshing ? 'Memperbarui…' : 'Perbarui status'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-orders">
          <div className="empty-orders-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>
          <h2>Belum ada pesanan tersimpan</h2>
          <p>
            Setelah kamu membuat pesanan, nomor tiket antrean dan statusnya akan
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

      <div className="orders-lookup-help">
        <div className="lookup-help-text">
          <strong>Pesanan dibuat di HP lain atau tidak muncul?</strong>
          <p>
            Kamu bisa mencari status pesanan menggunakan kode antrean atau memulihkannya dengan nomor HP.
          </p>
        </div>
        <button
          type="button"
          className="button button-outline"
          onClick={() => moveTo('tracking')}
        >
          Lacak Kode / Pulihkan <span>↗</span>
        </button>
      </div>
    </section>
  )
}
