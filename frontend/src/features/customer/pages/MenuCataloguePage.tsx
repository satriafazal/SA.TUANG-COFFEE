import type { CustomerMode } from '../../../state/prototypeState'
import type { Category, Product } from '../../../types'
import { rupiah } from '../../../utils/formatters'
import type { CartAction } from '../components/CartDrawer'

interface MenuCataloguePageProps {
  sessionMode: CustomerMode
  itemCount: number
  category: string
  setCategory: (cat: string) => void
  query: string
  setQuery: (q: string) => void
  categories: Category[]
  filtered: Product[]
  loading: boolean
  loadError: string
  setGuestOfferOpen: (open: boolean) => void
  setCartOpen: (open: boolean) => void
  dispatch: (action: CartAction) => void
}

export function MenuCataloguePage({
  sessionMode,
  itemCount,
  category,
  setCategory,
  query,
  setQuery,
  categories,
  filtered,
  loading,
  loadError,
  setGuestOfferOpen,
  setCartOpen,
  dispatch,
}: MenuCataloguePageProps) {
  return (
    <section className="catalogue-page">
      <div className="catalogue-heading">
        <div>
          <span className="eyebrow">
            {sessionMode === 'member' ? 'PEMESANAN MEMBER' : 'PEMESANAN GUEST'} ·
            BANJAR WIJAYA
          </span>
          <h1>
            Pilih yang
            <br />
            <em>kamu suka.</em>
          </h1>
          <p>
            {sessionMode === 'member'
              ? 'Pesanan ini akan tersimpan di riwayat Member.'
              : 'Kamu memesan tanpa akun. Riwayat pesanan tersimpan di browser ini.'}
          </p>
        </div>
        <div className="catalogue-actions">
          {sessionMode === 'guest' && (
            <button
              className="text-button"
              onClick={() => setGuestOfferOpen(true)}
            >
              Daftar Member
            </button>
          )}
          <button
            className="button button-dark"
            onClick={() => setCartOpen(true)}
          >
            Keranjang ({itemCount}) <span>↗</span>
          </button>
        </div>
      </div>

      <section className="menu-section order-menu-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow light">DARI BAR KAMI</span>
            <h2>
              Menu pilihan<span className="accent-dot">.</span>
            </h2>
            <p>Tambahkan menu ke keranjang untuk memesan.</p>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari minuman atau makanan"
              aria-label="Cari menu"
            />
          </label>
        </div>

        <div className="category-row" aria-label="Filter kategori">
          <button
            className={
              category === 'semua' ? 'category-chip selected' : 'category-chip'
            }
            onClick={() => setCategory('semua')}
          >
            Semua menu
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              className={
                category === item.slug
                  ? 'category-chip selected'
                  : 'category-chip'
              }
              onClick={() => setCategory(item.slug)}
            >
              {item.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="notice">Menyiapkan daftar menu…</div>
        ) : loadError ? (
          <div className="notice error">
            <strong>Menu belum bisa dimuat.</strong>
            <span>{loadError}</span>
            <button
              className="text-button"
              onClick={() => location.reload()}
            >
              Coba lagi
            </button>
          </div>
        ) : filtered.length ? (
          <div className="product-grid">
            {filtered.map((product, index) => (
              <article className="product-card" key={product.id}>
                <div className={`product-visual visual-${index % 6}`}>
                  {product.image_path ? (
                    <img
                      src={product.image_path}
                      alt={product.name}
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display =
                          'none'
                      }}
                    />
                  ) : null}
                  <span className="product-emoji" aria-hidden="true">
                    {product.item_type === 'drink'
                      ? product.name.toLowerCase().includes('matcha')
                        ? '🍵'
                        : '☕'
                      : '🥐'}
                  </span>
                </div>
                <div className="product-info">
                  <div className="product-category">
                    {product.category?.name ??
                      (product.item_type === 'drink' ? 'Minuman' : 'Makanan')}
                  </div>
                  <h3>{product.name}</h3>
                  <p>
                    {product.description || 'Diracik untuk dinikmati kapan saja.'}
                  </p>
                  <div className="product-buy">
                    <strong>{rupiah(product.price)}</strong>
                    <button
                      className="add-button"
                      disabled={!product.is_available}
                      onClick={() => dispatch({ type: 'add', product })}
                      aria-label={`Tambah ${product.name} ke keranjang`}
                    >
                      {product.is_available ? '+' : 'Habis'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="notice">Menu belum tersedia di kategori ini.</div>
        )}

        <p className="menu-footnote">
          Harga dan ketersediaan divalidasi kembali sebelum pesanan dibuat.
        </p>
      </section>
    </section>
  )
}
