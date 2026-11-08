import type { FormEvent } from 'react'
import type { LoyaltySettings } from '../../../api'
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
  paymentMethod: 'cash' | 'midtrans'
  setPaymentMethod: (method: 'cash' | 'midtrans') => void
  loyaltySettings?: LoyaltySettings | null
  usePoints?: boolean
  onToggleUsePoints?: (enable: boolean) => void
  pointsToRedeem?: number
  setPointsToRedeem?: (val: number) => void
  pointsDiscount?: number
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
  paymentMethod,
  setPaymentMethod,
  loyaltySettings,
  usePoints = false,
  onToggleUsePoints,
  pointsToRedeem = 0,
  setPointsToRedeem,
  pointsDiscount = 0,
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
                  disabled={Boolean(appliedPromo) || checkingPromo || (usePoints && pointsToRedeem > 0)}
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
                    disabled={!promoCode.trim() || checkingPromo || (usePoints && pointsToRedeem > 0)}
                    onClick={onApplyPromo}
                  >
                    {checkingPromo ? 'Cek…' : 'Gunakan'}
                  </button>
                )}
              </div>
              {usePoints && pointsToRedeem > 0 && (
                <p className="voucher-msg muted" style={{ color: '#b45309', fontSize: '11px', marginTop: '6px' }}>
                  ℹ Poin loyalitas sedang aktif. Hapus penukaran poin jika ingin memakai kode promo.
                </p>
              )}
              {promoMessage && (
                <p className={`voucher-msg ${appliedPromo ? 'success' : 'error'}`} role="status">
                  {appliedPromo ? '✓ ' : ''}{promoMessage}
                </p>
              )}
            </div>

            {loyaltySettings?.is_active && (
              <div
                className="cart-loyalty-box"
                style={{
                  margin: '12px 16px',
                  padding: '12px 14px',
                  background: usePoints ? '#f0fdf4' : '#faf8f5',
                  border: usePoints ? '1.5px solid #86efac' : '1px solid #e7e2d9',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                {currentMember ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: usePoints ? '10px' : '0' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#d97706', fontSize: '14px' }}>★</span>
                          <strong style={{ fontSize: '13px', color: '#1f2937' }}>Poin Loyalitas Member</strong>
                        </div>
                        <small style={{ color: '#6b7280', fontSize: '11px' }}>
                          Saldo: <strong>{currentMember.points_balance} poin</strong> (setara {rupiah(currentMember.points_balance * loyaltySettings.point_value_rupiah)})
                        </small>
                      </div>

                      {appliedPromo ? (
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                          Promo aktif
                        </span>
                      ) : currentMember.points_balance < loyaltySettings.min_redemption_points ? (
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                          Min. {loyaltySettings.min_redemption_points} poin
                        </span>
                      ) : (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#166534' }}>
                          <input
                            type="checkbox"
                            checked={usePoints}
                            onChange={(e) => onToggleUsePoints && onToggleUsePoints(e.target.checked)}
                            style={{ accentColor: '#166534', width: '16px', height: '16px' }}
                          />
                          Tukarkan
                        </label>
                      )}
                    </div>

                    {appliedPromo && (
                      <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#b45309' }}>
                        ℹ Voucher promo sedang aktif. Poin tidak dapat digabungkan dengan promo demi menjaga ketentuan promosi.
                      </p>
                    )}

                    {usePoints && setPointsToRedeem && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #bbf7d0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#374151' }}>Tukar:</span>
                            <input
                              type="number"
                              min={loyaltySettings.min_redemption_points}
                              max={Math.min(
                                currentMember.points_balance,
                                Math.floor(((loyaltySettings.max_discount_percentage / 100) * subtotal) / loyaltySettings.point_value_rupiah)
                              )}
                              step="1"
                              value={pointsToRedeem}
                              onChange={(e) => setPointsToRedeem(Math.max(0, Number(e.target.value)))}
                              style={{
                                width: '70px',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #86efac',
                                fontSize: '13px',
                                fontWeight: 700,
                                textAlign: 'center',
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#374151' }}>poin</span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '11px', color: '#166534', display: 'block' }}>Hemat</span>
                            <strong style={{ fontSize: '13px', color: '#15803d' }}>- {rupiah(pointsDiscount)}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setPointsToRedeem(loyaltySettings.min_redemption_points)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            Min ({loyaltySettings.min_redemption_points})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const maxPossiblePoints = Math.min(
                                currentMember.points_balance,
                                Math.floor(((loyaltySettings.max_discount_percentage / 100) * subtotal) / loyaltySettings.point_value_rupiah)
                              )
                              setPointsToRedeem(maxPossiblePoints)
                            }}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            Maks ({Math.min(
                              currentMember.points_balance,
                              Math.floor(((loyaltySettings.max_discount_percentage / 100) * subtotal) / loyaltySettings.point_value_rupiah)
                            )})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '12px', color: '#374151', display: 'block' }}>
                        ★ Poin Loyalitas Member
                      </strong>
                      <small style={{ color: '#6b7280', fontSize: '11px' }}>
                        Dapatkan poin cashback di setiap belanjaan Anda!
                      </small>
                    </div>
                    {onSwitchToMember && (
                      <button
                        type="button"
                        onClick={onSwitchToMember}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid #2c221e',
                          background: '#2c221e',
                          color: '#fff',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Masuk Member
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

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
              {usePoints && pointsDiscount > 0 && (
                <div className="summary-row discount">
                  <span>Potongan Poin ({pointsToRedeem} Poin)</span>
                  <strong className="discount-value">- {rupiah(pointsDiscount)}</strong>
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
                <label
                  className={`payment-choice ${paymentMethod === 'cash' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <input
                    type="radio"
                    name="cart_payment_method"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                  />
                  <span>
                    <b>Cash di kasir</b>
                    <small>Bayar tunai di meja kasir setelah pesan</small>
                  </span>
                  <i>{paymentMethod === 'cash' ? '●' : '○'}</i>
                </label>
                <label
                  className={`payment-choice ${paymentMethod === 'midtrans' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('midtrans')}
                >
                  <input
                    type="radio"
                    name="cart_payment_method"
                    value="midtrans"
                    checked={paymentMethod === 'midtrans'}
                    onChange={() => setPaymentMethod('midtrans')}
                  />
                  <span>
                    <b>Online (QRIS & Virtual Account)</b>
                    <small>Bayar instan via Midtrans (GoPay, BCA, Mandiri, dll)</small>
                  </span>
                  <i>{paymentMethod === 'midtrans' ? '●' : '○'}</i>
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
                  : paymentMethod === 'midtrans'
                  ? `Bayar Online · ${rupiah(finalTotal)}`
                  : `Pesan sekarang · ${rupiah(finalTotal)}`}
              </button>

              <p className="checkout-note">
                {paymentMethod === 'cash'
                  ? 'Pesanan akan diproses oleh barista setelah pembayaran tunai dikonfirmasi di kasir.'
                  : 'Jendela pembayaran Midtrans akan terbuka otomatis untuk menyelesaikan pembayaran.'}
              </p>
            </form>
          </>
        )}
      </aside>
    </div>
  )
}
