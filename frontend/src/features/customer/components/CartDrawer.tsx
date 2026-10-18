import type { FormEvent } from 'react'
import type { CustomerBundle, CustomerProfile, Product } from '../../../types'
import { rupiah } from '../../../utils/formatters'

export type CartLine = {
  key: string
  item_type: 'food' | 'drink' | 'bundle'
  product_id?: number
  bundle_id?: number
  name: string
  price: string
  image_path?: string | null
  allow_notes: boolean
  quantity: number
  note: string
  bundle_components?: Array<{ name: string; quantity: number }>
  product?: Product
  bundle?: CustomerBundle
}

export type CartAction =
  | { type: 'add'; product: Product }
  | { type: 'add_bundle'; bundle: CustomerBundle }
  | { type: 'quantity'; key: string; quantity: number }
  | { type: 'note'; key: string; note: string }
  | { type: 'clear' }

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  lines: CartLine[]
  subtotal: number
  discountAmount: number
  finalTotal: number
  itemCount: number
  sessionMode: 'guest' | 'member'
  currentMember: CustomerProfile | null
  checkoutName: string
  setCheckoutName: (val: string) => void
  checkoutPhone: string
  setCheckoutPhone: (val: string) => void
  checkoutError: string
  submitting: boolean
  submitOrder: (event: FormEvent<HTMLFormElement>) => void
  dispatch: (action: CartAction) => void
  promoCode: string
  setPromoCode: (val: string) => void
  appliedPromo?: {
    code: string
    name?: string
    discount_amount?: number
    [key: string]: any
  } | null
  promoMessage: string
  checkingPromo: boolean
  onApplyPromo: () => void
  onRemovePromo: () => void
  onSwitchToMember?: () => void
}

export function CartDrawer({
  isOpen,
  onClose,
  lines,
  subtotal,
  discountAmount,
  finalTotal,
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
  promoCode,
  setPromoCode,
  appliedPromo,
  promoMessage,
  checkingPromo,
  onApplyPromo,
  onRemovePromo,
  onSwitchToMember,
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
            <svg
              viewBox="0 0 24 24"
              width="44"
              height="44"
              fill="none"
              stroke="#88816f"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block', margin: '0 auto 12px' }}
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
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
              {lines.map((line) => (
                <div className="cart-line" key={line.key}>
                  <div className="cart-line-icon">
                    {line.image_path ? (
                      <img
                        src={line.image_path}
                        alt={line.name}
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).style.display =
                            'none'
                          const fallback =
                            e.currentTarget.parentElement?.querySelector(
                              '.cart-line-fallback',
                            )
                          if (fallback)
                            (fallback as HTMLElement).style.display = 'block'
                        }}
                      />
                    ) : null}
                    <svg
                      className="cart-line-fallback"
                      style={{ display: line.image_path ? 'none' : 'block' }}
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#0c0d0e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                      <line x1="6" y1="1" x2="6" y2="4" />
                      <line x1="10" y1="1" x2="10" y2="4" />
                      <line x1="14" y1="1" x2="14" y2="4" />
                    </svg>
                  </div>
                  <div className="cart-line-main">
                    <strong>{line.name}</strong>
                    {line.bundle_components && line.bundle_components.length > 0 && (
                      <small className="cart-bundle-items">
                        Termasuk: {line.bundle_components.map((c) => `${c.quantity}x ${c.name}`).join(', ')}
                      </small>
                    )}
                    <span>{rupiah(line.price)}</span>
                    {line.allow_notes && (
                      <input
                        className="note-input"
                        value={line.note}
                        onChange={(event) =>
                          dispatch({
                            type: 'note',
                            key: line.key,
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
                          key: line.key,
                          quantity: line.quantity - 1,
                        })
                      }
                      aria-label={`Kurangi ${line.name}`}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'quantity',
                          key: line.key,
                          quantity: line.quantity + 1,
                        })
                      }
                      aria-label={`Tambah ${line.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-voucher-box">
              <div className="voucher-input-group">
                <input
                  type="text"
                  className="voucher-input"
                  placeholder="KODE PROMO / VOUCHER"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  disabled={Boolean(appliedPromo) || checkingPromo}
                />
                {appliedPromo ? (
                  <button
                    type="button"
                    className="voucher-btn remove"
                    onClick={onRemovePromo}
                  >
                    Hapus
                  </button>
                ) : (
                  <button
                    type="button"
                    className="voucher-btn apply"
                    disabled={!promoCode.trim() || checkingPromo}
                    onClick={onApplyPromo}
                  >
                    {checkingPromo ? 'Cek…' : 'Gunakan'}
                  </button>
                )}
              </div>
              {promoMessage && (
                <p className={`voucher-msg ${appliedPromo ? 'success' : 'error'}`} role="status">
                  {appliedPromo ? '✓ ' : ''}{promoMessage}
                </p>
              )}
            </div>

            <div className="cart-summary-box">
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{rupiah(subtotal)}</strong>
              </div>
              {appliedPromo && discountAmount > 0 && (
                <div className="summary-row discount">
                  <span>Potongan Voucher ({appliedPromo.code})</span>
                  <strong className="discount-value">- {rupiah(discountAmount)}</strong>
                </div>
              )}
              <div className="summary-row grand-total">
                <span>Total Pembayaran</span>
                <strong>{rupiah(finalTotal)}</strong>
              </div>
            </div>

            <form className="checkout-form" onSubmit={submitOrder}>
              {sessionMode === 'guest' && onSwitchToMember && (
                <div
                  className="cart-guest-switch"
                  style={{
                    padding: '10px 14px',
                    background: '#f6ede0',
                    border: '1.5px dashed var(--accent)',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                    <strong style={{ display: 'block', color: 'var(--ink)' }}>Punya akun Member?</strong>
                    <span style={{ color: '#686760' }}>Masuk untuk kumpulkan poin & cek riwayat.</span>
                  </div>
                  <button
                    type="button"
                    className="button button-dark"
                    style={{ minHeight: '32px', padding: '0 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                    onClick={onSwitchToMember}
                  >
                    Masuk
                  </button>
                </div>
              )}

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
                  : `Pesan sekarang · ${rupiah(finalTotal)}`}
              </button>

              <p className="checkout-note">
                Pesanan akan diproses oleh barista setelah pembayaran tunai dikonfirmasi di kasir.
              </p>
            </form>
          </>
        )}
      </aside>
    </div>
  )
}
