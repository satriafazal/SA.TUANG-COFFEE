import type { FormEvent } from 'react'
import type { TrackedOrder } from '../../../types'
import { orderStatusLabels, paymentStatusLabels } from '../../../utils/constants'
import { orderDateFormatter } from '../../../utils/formatters'
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
}: OrderTrackingPageProps) {
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
              <span className="eyebrow">KODE ANTREAN</span>
              <strong>{lookupResult.order_number}</strong>
              <small>
                {orderDateFormatter.format(Date.parse(lookupResult.created_at))}
              </small>
            </div>
            <span
              className={`status-pill ${
                lookupResult.order_status === 'SELESAI' ? 'success' : ''
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

          <div className="tracking-items">
            {lookupResult.items.map((item, index) => (
              <div
                className="tracking-item"
                key={`${lookupResult.order_number}-${index}`}
              >
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span>
                  {orderStatusLabels[item.preparation_status] ??
                    item.preparation_status}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}

      <button className="back-link" onClick={() => moveTo('landing')}>
        ← Kembali ke beranda
      </button>
    </section>
  )
}
