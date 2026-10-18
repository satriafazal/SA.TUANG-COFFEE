import { useMemo, useState } from 'react'
import type { CustomerMode } from '../components/CustomerHeader'
import type { Category, CustomerBundle, Product } from '../../../types'
import { rupiah } from '../../../utils/formatters'
import type { CartAction } from '../components/CartDrawer'

interface MenuCataloguePageProps {
  sessionMode: CustomerMode
  isViewOnly?: boolean
  onStartOrder?: () => void
  itemCount: number
  category?: string
  setCategory?: (cat: string) => void
  query: string
  setQuery: (q: string) => void
  categories: Category[]
  filtered?: Product[]
  products?: Product[]
  bundles?: CustomerBundle[]
  loading: boolean
  loadError: string
  setGuestOfferOpen: (open: boolean) => void
  setCartOpen: (open: boolean) => void
  dispatch: (action: CartAction) => void
  onAddToCart?: (item: {
    name: string
    price: number
    image_path?: string | null
  }) => void
}

export function MenuCataloguePage({
  sessionMode,
  isViewOnly = false,
  onStartOrder,
  itemCount: _itemCount,
  category: _category,
  setCategory: _setCategory,
  query,
  setQuery,
  categories,
  filtered,
  products = [],
  bundles: _bundles = [],
  loading,
  loadError,
  setGuestOfferOpen,
  setCartOpen: _setCartOpen,
  dispatch,
  onAddToCart,
}: MenuCataloguePageProps) {
  const [activeParentId, setActiveParentId] = useState<number | 'all'>('all')
  const [subCategory, setSubCategory] = useState<string>('semua')

  const rawProducts = products.length ? products : (filtered ?? [])

  // Kategori Induk: kategori tanpa parent_id (atau fallback jika kategori lama)
  const parentCategories = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id)
    if (parents.length > 0) return parents

    // Fallback sintetis jika data lama belum memiliki parent_id
    const hasDrink = categories.some((c) => c.item_type === 'drink')
    const hasFood = categories.some((c) => c.item_type === 'food')
    const synthetic: Category[] = []
    if (hasDrink) synthetic.push({ id: -1, name: 'Minuman', slug: 'minuman', item_type: 'drink' })
    if (hasFood) synthetic.push({ id: -2, name: 'Makanan', slug: 'makanan', item_type: 'food' })
    return synthetic
  }, [categories])

  // Sub-kategori yang sesuai dengan Kategori Induk yang sedang aktif
  const relevantSubCategories = useMemo(() => {
    if (activeParentId === 'all') {
      const subs = categories.filter((c) => Boolean(c.parent_id))
      return subs.length ? subs : categories
    }
    return categories.filter((c) => c.parent_id === activeParentId)
  }, [activeParentId, categories])

  // Hitungan jumlah item per Kategori Induk
  const parentCounts = useMemo(() => {
    const counts: Record<string | number, number> = { all: rawProducts.length }
    parentCategories.forEach((p) => {
      const count = rawProducts.filter((prod) => {
        if (prod.category_id === p.id) return true
        if (prod.category?.parent_id === p.id) return true
        if (p.item_type && prod.item_type === p.item_type) return true
        return false
      }).length
      counts[p.id] = count
    })
    return counts
  }, [parentCategories, rawProducts])

  // Filter Produk
  const displayedProducts = useMemo(() => {
    return rawProducts.filter((product) => {
      // 1. Filter Kategori Induk
      if (activeParentId !== 'all') {
        const parent = parentCategories.find((p) => p.id === activeParentId)
        const matchesParent =
          product.category_id === activeParentId ||
          product.category?.parent_id === activeParentId ||
          (parent?.item_type && product.item_type === parent.item_type)
        if (!matchesParent) return false
      }

      // 2. Filter Sub-Kategori
      if (subCategory !== 'semua') {
        const itemCatSlug = (product.category?.slug ?? '').toLowerCase()
        if (itemCatSlug !== subCategory.toLowerCase()) return false
      }

      // 3. Filter Kata Kunci Pencarian
      if (query.trim()) {
        const match = `${product.name} ${product.description ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
        if (!match) return false
      }

      return true
    })
  }, [rawProducts, activeParentId, parentCategories, subCategory, query])

  const totalVisibleItems = displayedProducts.length

  function handleParentTabChange(id: number | 'all') {
    setActiveParentId(id)
    setSubCategory('semua')
  }

  return (
    <section className="catalogue-page">
      <div className="catalogue-heading">
        <div>
          <span className="eyebrow">
            {isViewOnly
              ? 'KATALOG MENU · SA.TUANG BANJAR WIJAYA'
              : sessionMode === 'member'
              ? 'PEMESANAN MEMBER · BANJAR WIJAYA'
              : 'PEMESANAN GUEST · BANJAR WIJAYA'}
          </span>
          <h1>
            {isViewOnly ? (
              <>
                Jelajahi sajian
                <br />
                <em>kopi & rasa.</em>
              </>
            ) : (
              <>
                Pilih yang
                <br />
                <em>kamu suka.</em>
              </>
            )}
          </h1>
          <p>
            {isViewOnly
              ? 'Temukan ragam minuman dan sajian SA.TUANG. Klik tombol Pesan untuk mulai memesan.'
              : sessionMode === 'member'
              ? 'Pesanan ini akan tersimpan di riwayat Member.'
              : 'Kamu memesan tanpa akun. Riwayat pesanan tersimpan di browser ini.'}
          </p>
        </div>
        <div className="catalogue-actions">
          {isViewOnly ? (
            <button
              className="button button-accent"
              onClick={onStartOrder}
            >
              Mulai Pesan <span>↗</span>
            </button>
          ) : sessionMode === 'guest' ? (
            <button
              className="text-button"
              onClick={() => setGuestOfferOpen(true)}
            >
              Daftar Member
            </button>
          ) : null}
        </div>
      </div>

      <section className="menu-section order-menu-section">
        {isViewOnly && (
          <div className="catalogue-view-only-banner">
            <div className="view-only-text">
              <strong>Katalog Menu SA.TUANG</strong>
              <span>Kamu sedang dalam mode tinjau katalog. Klik "Pesan" pada sajian untuk mulai memesan.</span>
            </div>
            <button className="button button-dark btn-sm" onClick={onStartOrder}>
              Pesan Sekarang <span>↗</span>
            </button>
          </div>
        )}

        <div className="section-heading">
          <div>
            <span className="eyebrow light">DARI BAR KAMI</span>
            <h2>
              Menu pilihan<span className="accent-dot">.</span>
            </h2>
            <p>
              {isViewOnly
                ? 'Pilih varian rasa sebelum memesan.'
                : 'Tambahkan menu ke keranjang untuk memesan.'}
            </p>
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

        {/* TWO-TIER FILTER TABS: Kategori Induk & Sub-Kategori (Text-Only, Bebas Icon) */}
        <div className="catalogue-filter-container">
          {/* Baris 1: Tab Kategori Induk */}
          <div className="catalogue-main-tabs" role="tablist" aria-label="Kategori Utama Menu">
            <button
              type="button"
              role="tab"
              aria-selected={activeParentId === 'all'}
              className={`main-tab-button ${activeParentId === 'all' ? 'active' : ''}`}
              onClick={() => handleParentTabChange('all')}
            >
              <span>Semua Menu</span>
              <span className="tab-count">{parentCounts.all ?? 0}</span>
            </button>

            {parentCategories.map((parent) => (
              <button
                key={parent.id}
                type="button"
                role="tab"
                aria-selected={activeParentId === parent.id}
                className={`main-tab-button ${activeParentId === parent.id ? 'active' : ''}`}
                onClick={() => handleParentTabChange(parent.id)}
              >
                <span>{parent.name}</span>
                <span className="tab-count">{parentCounts[parent.id] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Baris 2: Sub-Kategori Chip Dinamis (Text-Only) */}
          {relevantSubCategories.length > 0 && (
            <div className="catalogue-sub-chips" aria-label="Filter Sub-Kategori">
              <button
                type="button"
                className={`sub-chip-button ${subCategory === 'semua' ? 'active' : ''}`}
                onClick={() => setSubCategory('semua')}
              >
                {activeParentId === 'all'
                  ? 'Semua Menu'
                  : `Semua ${parentCategories.find((p) => p.id === activeParentId)?.name ?? ''}`}
              </button>

              {relevantSubCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`sub-chip-button ${subCategory === cat.slug ? 'active' : ''}`}
                  onClick={() => setSubCategory(cat.slug)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
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
        ) : totalVisibleItems > 0 ? (
          <div className="product-grid">
            {displayedProducts.map((product, index) => (
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
                  ) : (
                    <div className="product-visual-icon" aria-hidden="true">
                      {product.item_type === 'food' ? (
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8" />
                          <path d="M4 8h16" />
                          <path d="M12 4v4" />
                          <path d="M8 4h8" />
                        </svg>
                      ) : (
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                          <line x1="6" y1="1" x2="6" y2="4" />
                          <line x1="10" y1="1" x2="10" y2="4" />
                          <line x1="14" y1="1" x2="14" y2="4" />
                        </svg>
                      )}
                    </div>
                  )}
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
                    {isViewOnly ? (
                      <button
                        className="order-cta-btn"
                        disabled={!product.is_available}
                        onClick={onStartOrder}
                        title="Mulai memesan menu ini"
                      >
                        {product.is_available ? 'Pesan ↗' : 'Habis'}
                      </button>
                    ) : (
                      <button
                        className="add-button"
                        disabled={!product.is_available}
                        onClick={() => {
                          dispatch({ type: 'add', product })
                          onAddToCart?.({
                            name: product.name,
                            price: Number(product.price),
                            image_path: product.image_path,
                          })
                        }}
                        aria-label={`Tambah ${product.name} ke keranjang`}
                      >
                        {product.is_available ? '+' : 'Habis'}
                      </button>
                    )}
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
