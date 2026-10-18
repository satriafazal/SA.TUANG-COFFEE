import type { FormEvent } from 'react'
import type { TrackedOrder } from '../../../types'
import { orderStatusLabels, paymentStatusLabels } from '../../../utils/constants'
import { orderDateFormatter } from '../../../utils/formatters'
import { groupOrderItemsByCategory } from '../../../utils/orderGroups'
import type { Screen } from '../components/CustomerHeader'

interface OrderTrackingPageProps {
  lookupOrderNumber: string
  setLookupOrderNumber: (val: string) => void
  lookupName: string
  setLookupName: (val: string) => void
  lookupError: string
  lookupBusy: boolean
  lookupResult: TrackedOrder['order'] | null
  lookupOrder: (event: FormEvent<HTMLFormElement>) => void
  moveTo: (screen: Screen) => void
  onCompleteOrder?: (orderNumber: string) => Promise<void> | void
  completingOrderNumber?: string | null
}

export function OrderTrackingPage({
  lookupOrderNumber,
  setLookupOrderNumber,
  lookupName,
  setLookupName,
  lookupError,
  lookupBusy,
  lookupResult,
  lookupOrder,
  moveTo,
  onCompleteOrder,
  completingOrderNumber,
}: OrderTrackingPageProps) {
  const prepGroups = lookupResult ? groupOrderItemsByCategory(lookupResult.items) : []
  const isReadyForPickup = lookupResult?.order_status === 'SIAP_DIAMBIL'
  const isCompleted = lookupResult?.order_status === 'SELESAI'

  return (
    <section className="tracking-page">
      <div className="flow-heading">
        <span className="eyebrow">LACAK PESANAN · TANPA LOGIN</span>
        <h1>
          Temukan status
          <br />
          <em>pesananmu.</em>
        </h1>
        <p>
          Masukkan kode antrean dan nama yang tercantum saat checkout. Pencarian
          ini tidak memerlukan sesi Guest di browser.
        </p>
      </div>

      <form className="customer-form tracking-form" onSubmit={lookupOrder}>
        <label>
          Kode antrean
          <input
            autoComplete="off"
            required
            maxLength={64}
            value={lookupOrderNumber}
            onChange={(event) => setLookupOrderNumber(event.target.value)}
            placeholder="Contoh: ST-XXXXXXXX"
          />
        </label>
        <label>
          Nama pada pesanan
          <input
            autoComplete="name"
            required
            maxLength={160}
            value={lookupName}
            onChange={(event) => setLookupName(event.target.value)}
            placeholder="Nama yang digunakan saat checkout"
          />
        </label>
        <p className="field-help">
          Kode antrean diperlukan untuk mencari pesanan. Jika lupa kodenya, pilih
          pemulihan nomor HP; pemulihan melalui nomor HP hanya mencakup riwayat
          pada perangkat ini.
        </p>

        {lookupError && (
          <p className="form-error" role="alert">
            {lookupError}
          </p>
        )}

        <button className="button button-dark full" disabled={lookupBusy}>
          {lookupBusy ? 'Mencari pesanan…' : 'Lacak Pesanan'}
        </button>

        <button
          className="text-button"
          type="button"
          onClick={() => moveTo('recovery')}
        >
          Lupa kode antrean?
        </button>
      </form>

      {lookupResult && (
        <article className="tracking-result">
          <div className="tracking-result-head">
            <div>
              <div className="order-ticket-row">
                <span className="eyebrow" style={{ margin: 0 }}>NO. ANTREAN</span>
                {lookupResult.daily_ticket_number && (
                  <span className="order-ticket-badge">
                    <span className="ticket-label">TICKET</span>
                    <span className="ticket-num">{lookupResult.daily_ticket_number}</span>
                  </span>
                )}
              </div>
              <strong>{lookupResult.order_number}</strong>
              <small>
                {orderDateFormatter.format(Date.parse(lookupResult.created_at))}
              </small>
            </div>
            <span
              className={`status-pill ${
                lookupResult.order_status === 'SELESAI'
                  ? 'success'
                  : lookupResult.order_status === 'SIAP_DIAMBIL'
                  ? 'ready'
                  : lookupResult.order_status === 'DIBATALKAN'
                  ? 'danger'
                  : ''
              }`}
            >
              {orderStatusLabels[lookupResult.order_status] ??
                lookupResult.order_status}
            </span>
          </div>

          <p className="tracking-payment">
            Pembayaran ·{' '}
            {paymentStatusLabels[lookupResult.payment_status] ??
              orderStatusLabels[lookupResult.payment_status] ??
              lookupResult.payment_status}
          </p>

          {/* Status berdasarkan kategori persiapan item */}
          <div className="saved-order-prep-groups" style={{ marginTop: '12px' }}>
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
                disabled={completingOrderNumber === lookupResult.order_number}
                onClick={() => onCompleteOrder?.(lookupResult.order_number)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {completingOrderNumber === lookupResult.order_number
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
        </article>
      )}

      <button className="back-link" onClick={() => moveTo('landing')}>
        ← Kembali ke beranda
      </button>
    </section>
  )
}
