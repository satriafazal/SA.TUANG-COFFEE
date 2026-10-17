import type { FormEvent } from 'react'
import type { CustomerMode, PrototypeMember } from '../../../state/prototypeState'
import type { Product } from '../../../types'
import { rupiah } from '../../../utils/formatters'

export type CartLine = { product: Product; quantity: number; note: string }
export type CartAction =
  | { type: 'add'; product: Product }
  | { type: 'quantity'; id: number; quantity: number }
  | { type: 'note'; id: number; note: string }
  | { type: 'clear' }

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  lines: CartLine[]
  total: number
  itemCount: number
  sessionMode: CustomerMode
  currentMember: PrototypeMember | null
  checkoutName: string
  setCheckoutName: (val: string) => void
  checkoutPhone: string
  setCheckoutPhone: (val: string) => void
  checkoutError: string
  submitting: boolean
  submitOrder: (event: FormEvent<HTMLFormElement>) => void
  dispatch: (action: CartAction) => void
}

export function CartDrawer({
  isOpen,
  onClose,
  lines,
  total,
  itemCount,
  sessionMode,
  currentMember,
  checkoutName,
  setCheckoutName,
  checkoutPhone,
  setCheckoutPhone,
  checkoutError,
  submitting,
  submitOrder,
  dispatch,
}: CartDrawerProps) {
  if (!isOpen) return null

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        className="cart-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keranjang belanja"
      >
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              {sessionMode === 'member' ? 'PESANAN MEMBER' : 'PESANAN GUEST'}
            </span>
            <h2>
              Keranjang <span className="accent-dot">({itemCount})</span>
            </h2>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Tutup keranjang"
          >
            ×
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="empty-cart">
            <span>☕</span>
            <h3>Keranjangmu masih kosong</h3>
            <p>Tambahkan menu yang ingin kamu nikmati.</p>
            <button
              className="button button-dark"
              onClick={onClose}
            >
              Kembali ke menu
            </button>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {lines.map(({ product, quantity, note }) => (
                <div className="cart-line" key={product.id}>
                  <div className="cart-line-icon">
                    {product.item_type === 'food' ? '🥐' : '☕'}
                  </div>
                  <div className="cart-line-main">
                    <strong>{product.name}</strong>
                    <span>{rupiah(product.price)}</span>
                    {product.allow_notes && (
                      <input
                        className="note-input"
                        value={note}
                        onChange={(event) =>
                          dispatch({
                            type: 'note',
                            id: product.id,
                            note: event.target.value,
                          })
                        }
                        placeholder="Catatan untuk barista (opsional)"
                      />
                    )}
                  </div>
                  <div className="quantity-control">
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'quantity',
                          id: product.id,
                          quantity: quantity - 1,
                        })
                      }
                      aria-label={`Kurangi ${product.name}`}
                    >
                      −
                    </button>
                    <span>{quantity}</span>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'quantity',
                          id: product.id,
                          quantity: quantity + 1,
                        })
                      }
                      aria-label={`Tambah ${product.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-total">
              <span>Total sementara</span>
              <strong>{rupiah(total)}</strong>
            </div>

            <form className="checkout-form" onSubmit={submitOrder}>
              <label>
                Nama untuk pesanan
                <input
                  required
                  maxLength={160}
                  value={
                    sessionMode === 'member'
                      ? (currentMember?.name ?? '')
                      : checkoutName
                  }
                  onChange={(event) => setCheckoutName(event.target.value)}
                  placeholder="Nama kamu"
                  readOnly={sessionMode === 'member'}
                />
              </label>

              {sessionMode === 'guest' && (
                <label>
                  Nomor HP <span className="optional-label">(opsional)</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={32}
                    value={checkoutPhone}
                    onChange={(event) => setCheckoutPhone(event.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                  <small className="field-help">
                    Mohon simpan kode antrean. Nomor HP dapat digunakan untuk
                    memulihkan kode antrean.
                  </small>
                </label>
              )}

              <fieldset>
                <legend>Metode pembayaran</legend>
                <label className="payment-choice selected">
                  <input type="radio" checked readOnly />
                  <span>
                    <b>Cash di kasir</b>
                    <small>Bayar setelah menunjukkan kode antrean</small>
                  </span>
                  <i>●</i>
                </label>
                <label className="payment-choice disabled">
                  <input type="radio" disabled />
                  <span>
                    <b>VA / QRIS</b>
                    <small>Belum tersedia — gateway belum dikonfigurasi</small>
                  </span>
                  <i>◌</i>
                </label>
              </fieldset>

              {checkoutError && (
                <p className="form-error" role="alert">
                  {checkoutError}
                </p>
              )}

              <button
                className="button button-accent full"
                disabled={submitting || !lines.length}
              >
                {submitting
                  ? 'Mencatat pesanan…'
                  : `Pesan sekarang · ${rupiah(total)}`}
              </button>

              <p className="checkout-note">
                Harga dan ketersediaan akan divalidasi kembali sebelum pesanan
                dibuat. Data checkout masih menggunakan backend katalog prototipe.
              </p>
            </form>
          </>
        )}
      </aside>
    </div>
  )
}
