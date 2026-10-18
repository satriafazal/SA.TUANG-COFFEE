import type { FormEvent } from 'react'
import type { CustomerOrderRecord } from '../../../types'
import { orderStatusLabels } from '../../../utils/constants'
import type { CustomerMode, Screen } from '../components/CustomerHeader'

interface OrderRecoveryPageProps {
  sessionMode: CustomerMode
  recoveryPhone: string
  setRecoveryPhone: (val: string) => void
  recoveryError: string
  recoveredOrder: CustomerOrderRecord | null
  recoverOrder: (event: FormEvent<HTMLFormElement>) => void
  setLookupOrderNumber: (val: string) => void
  setLookupName: (val: string) => void
  setLookupResult: (val: null) => void
  moveTo: (screen: Screen) => void
}

export function OrderRecoveryPage({
  sessionMode,
  recoveryPhone,
  setRecoveryPhone,
  recoveryError,
  recoveredOrder,
  recoverOrder,
  setLookupOrderNumber,
  setLookupName,
  setLookupResult,
  moveTo,
}: OrderRecoveryPageProps) {
  return (
    <section className="recovery-page">
      <div className="flow-heading">
        <span className="eyebrow">PEMULIHAN KODE ANTREAN</span>
        <h1>
          Temukan kode
          <br />
          <em>pesananmu.</em>
        </h1>
        <p>
          Masukkan nomor HP yang dicantumkan saat checkout. Pencarian mencakup
          pesanan yang tersimpan pada perangkat ini.
        </p>
      </div>

      <form
        className="customer-form recovery-form"
        onSubmit={recoverOrder}
      >
        <label>
          Nomor HP
          <input
            type="tel"
            inputMode="tel"
            required
            value={recoveryPhone}
            onChange={(event) => setRecoveryPhone(event.target.value)}
            placeholder="Nomor HP yang digunakan"
          />
        </label>
        <p className="field-help">
          Riwayat yang tersimpan pada perangkat ini dapat dicari di sini. Untuk
          bantuan pada perangkat lain, hubungi outlet.
        </p>

        {recoveryError && (
          <p className="form-error" role="alert">
            {recoveryError}
          </p>
        )}

        <button className="button button-dark full">Cari pesanan</button>

        {recoveredOrder && (
          <div className="recovered-order">
            <span className="eyebrow">KODE ANTREAN DITEMUKAN</span>
            <strong>{recoveredOrder.order_number}</strong>
            <span>
              {recoveredOrder.customer_name} ·{' '}
              {orderStatusLabels[recoveredOrder.order_status] ??
                recoveredOrder.order_status}
            </span>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setLookupOrderNumber(recoveredOrder.order_number)
                setLookupName(recoveredOrder.customer_name)
                setLookupResult(null)
                moveTo('tracking')
              }}
            >
              Lacak pesanan ini
            </button>
          </div>
        )}

        <button
          type="button"
          className="back-link"
          onClick={() =>
            moveTo(sessionMode === 'member' ? 'member-home' : 'tracking')
          }
        >
          ← Kembali
        </button>
      </form>
    </section>
  )
}
