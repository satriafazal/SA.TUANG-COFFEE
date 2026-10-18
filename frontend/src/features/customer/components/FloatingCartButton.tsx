interface FloatingCartButtonProps {
  itemCount: number
  subtotal: number
  onClick: () => void
  visible: boolean
}

export function FloatingCartButton({
  itemCount,
  subtotal,
  onClick,
  visible,
}: FloatingCartButtonProps) {
  if (!visible) return null

  return (
    <button
      type="button"
      className="floating-cart-btn"
      onClick={onClick}
      aria-label={`Buka keranjang belanja, ${itemCount} item, total Rp ${subtotal.toLocaleString('id-ID')}`}
    >
      <div className="floating-cart-left">
        <span className="floating-cart-icon" aria-hidden="true">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </span>
        <span className="floating-cart-badge">{itemCount}</span>
        <span className="floating-cart-title">Keranjang</span>
      </div>
      {itemCount > 0 ? (
        <div className="floating-cart-right">
          <span className="floating-cart-price">
            Rp {subtotal.toLocaleString('id-ID')}
          </span>
          <span className="floating-cart-action">Checkout ↗</span>
        </div>
      ) : (
        <span className="floating-cart-empty-hint">Kosong</span>
      )}
    </button>
  )
}
