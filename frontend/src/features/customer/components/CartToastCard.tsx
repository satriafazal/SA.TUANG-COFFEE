export interface CartToastItem {
  id: number
  name: string
  price: number
  image_path?: string | null
}

interface CartToastCardProps {
  toast: CartToastItem | null
  onClose: () => void
  onViewCart: () => void
}

export function CartToastCard({
  toast,
  onClose,
  onViewCart,
}: CartToastCardProps) {
  if (!toast) return null

  return (
    <aside
      className="cart-toast-card"
      role="status"
      aria-live="polite"
      aria-label={`Menu ${toast.name} dimasukkan ke keranjang`}
    >
      <div className="cart-toast-thumb">
        {toast.image_path ? (
          <img
            src={toast.image_path}
            alt={toast.name}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              const fallback = e.currentTarget.parentElement?.querySelector(
                '.cart-toast-fallback-icon',
              )
              if (fallback) (fallback as HTMLElement).style.display = 'block'
            }}
          />
        ) : null}
        <svg
          className="cart-toast-fallback-icon"
          style={{ display: toast.image_path ? 'none' : 'block' }}
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
      <div className="cart-toast-content">
        <div className="cart-toast-kicker">
          <span className="cart-toast-check">✓</span> Masuk ke Keranjang
        </div>
        <h4 className="cart-toast-title" title={toast.name}>
          {toast.name}
        </h4>
        <div className="cart-toast-meta">
          <strong>Rp {Number(toast.price).toLocaleString('id-ID')}</strong>
          <button
            type="button"
            className="cart-toast-view-btn"
            onClick={onViewCart}
          >
            Lihat Keranjang ↗
          </button>
        </div>
      </div>
      <button
        type="button"
        className="cart-toast-close"
        onClick={onClose}
        aria-label="Tutup notifikasi"
      >
        ×
      </button>
    </aside>
  )
}
