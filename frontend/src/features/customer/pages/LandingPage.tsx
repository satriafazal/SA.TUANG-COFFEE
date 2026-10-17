import type { CustomerBanner, CustomerBundle, Product } from '../../../types'
import { BannerCarousel } from '../components/BannerCarousel'
import type { Screen } from '../components/CustomerHeader'

interface LandingPageProps {
  banners: CustomerBanner[]
  menu: Product[]
  bundles?: CustomerBundle[]
  loading: boolean
  loadError: string
  startOrdering: () => void
  moveTo: (screen: Screen) => void
}

export function LandingPage({
  banners,
  menu,
  bundles = [],
  loading,
  loadError,
  startOrdering,
  moveTo,
}: LandingPageProps) {
  return (
    <section className="landing-page">
      <div className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">
            <i /> BANJAR WIJAYA · TANGERANG
          </span>
          <h1>
            Satu tuang,
            <br />
            <em>satu jeda.</em>
          </h1>
          <p>
            Ruang singgah untuk menikmati kopi, makanan, dan waktu bersama.
            Temukan suasana SA.TUANG COFFEE Banjar Wijaya.
          </p>
          <div className="landing-actions">
            <button className="button button-accent" onClick={startOrdering}>
              Pesan Sekarang <span>↗</span>
            </button>
            <button
              className="button button-outline landing-track-button"
              onClick={() => moveTo('tracking')}
            >
              Lacak Pesanan <span>⌕</span>
            </button>
            <a className="button button-outline" href="#about">
              Kenali SA.TUANG <span>↓</span>
            </a>
          </div>
          <div className="landing-meta">
            <span>SA.TUANG COFFEE</span>
            <span>INDUSTRIAL · OUTDOOR · EVERYDAY</span>
          </div>
        </div>

        <div
          className="landing-art"
          role="img"
          aria-label="Ilustrasi kopi dalam suasana industrial"
        >
          <span className="art-label">
            ONE
            <br />
            POUR
          </span>
          <div className="landing-sun" />
          <div className="landing-cup">
            <span>✳</span>
          </div>
          <span className="art-caption">BREWED FOR A LITTLE PAUSE</span>
          <span className="art-side">BANJAR WIJAYA · TANGERANG</span>
        </div>
      </div>

      {banners.length > 0 && (
        <BannerCarousel
          banners={banners}
          onActionClick={(link) => {
            if (link.includes('menu') || link === 'order') startOrdering()
          }}
        />
      )}

      <section id="about" className="landing-about">
        <div className="section-kicker">01 — TENTANG KAMI</div>
        <div>
          <h2>
            Ruang untuk
            <br />
            <em>berhenti sebentar.</em>
          </h2>
          <p>
            SA.TUANG menghadirkan kopi dan sajian untuk menemani jeda—dengan suasana
            industrial dan area terbuka di Banjar Wijaya. Datang untuk secangkir
            kopi, tinggal untuk kebersamaan.
          </p>
          <p className="small-copy">
            “Sa.Tuang” dimaknai sebagai “One Pour”—satu tuang yang membuka ruang
            untuk menikmati momen.
          </p>
        </div>
      </section>

      <section id="menu-preview" className="landing-menu">
        <div className="landing-menu-head">
          <div>
            <span className="eyebrow light">DARI BAR KAMI</span>
            <h2>
              Kenali menu pilihan<span className="accent-dot">.</span>
            </h2>
            <p>Jelajahi sajian sebelum memulai pemesanan.</p>
          </div>
          <button
            className="button button-outline-light"
            onClick={startOrdering}
          >
            Lihat menu pemesanan <span>↗</span>
          </button>
        </div>

        {loading ? (
          <div className="notice">Menyiapkan pilihan menu…</div>
        ) : loadError ? (
          <div className="notice error">Menu belum dapat dimuat. {loadError}</div>
        ) : (
          <>
            {bundles.length > 0 && (
              <div className="landing-bundle-section">
                <div className="landing-section-subhead">
                  <span className="eyebrow light">🎁 PAKET HEMAT PILIHAN</span>
                  <p>Kombinasi menu hemat spesial untuk waktu jeda kamu.</p>
                </div>
                <div className="landing-menu-grid">
                  {bundles.slice(0, 3).map((bundle, index) => (
                    <article
                      className="preview-card bundle-preview-card"
                      key={`bundle-${bundle.id}`}
                      onClick={startOrdering}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={`preview-visual visual-${(index + 3) % 6}`}>
                        {bundle.image_path ? (
                          <img
                            src={bundle.image_path}
                            alt={bundle.name}
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : null}
                        <span className="product-emoji" aria-hidden="true">🎁</span>
                      </div>
                      <div className="preview-info">
                        <span className="bundle-badge">
                          {bundle.category?.name ? `PAKET · ${bundle.category.name.toUpperCase()}` : 'PAKET HEMAT'}
                        </span>
                        <h3>{bundle.name}</h3>
                        <p>{bundle.description || 'Kombinasi menu favorit dengan harga lebih hemat.'}</p>
                        {bundle.components && bundle.components.length > 0 && (
                          <div className="bundle-contents">
                            <strong>Termasuk:</strong>
                            <span>
                              {bundle.components
                                .map((c) => `${c.quantity}x ${c.product?.name ?? 'Menu'}`)
                                .join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="preview-price-row">
                          <strong className="preview-price">Rp {Number(bundle.price).toLocaleString('id-ID')}</strong>
                          <span className="preview-cta">Pesan Paket ↗</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="landing-products-section">
              {bundles.length > 0 && (
                <div className="landing-section-subhead">
                  <span className="eyebrow light">☕ PILIHAN MENU FAVORIT</span>
                  <p>Pilihan kopi dan sajian teman ngopi harian.</p>
                </div>
              )}
              <div className="landing-menu-grid">
                {menu.slice(0, 3).map((product, index) => (
                  <article
                    className="preview-card"
                    key={product.id}
                    onClick={startOrdering}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={`preview-visual visual-${index % 6}`}>
                      {product.image_path ? (
                        <img
                          src={product.image_path}
                          alt={product.name}
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : null}
                      <span>{product.item_type === 'drink' ? '☕' : '🥐'}</span>
                    </div>
                    <div className="preview-info">
                      <small>{product.category?.name ?? 'Menu'}</small>
                      <h3>{product.name}</h3>
                      <p>{product.description || 'Sajian dari SA.TUANG COFFEE.'}</p>
                      <div className="preview-price-row">
                        <strong className="preview-price">Rp {Number(product.price).toLocaleString('id-ID')}</strong>
                        <span className="preview-cta">Pesan ↗</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <section id="location" className="landing-location">
        <div>
          <span className="eyebrow">KUNJUNGI KAMI</span>
          <h2>
            SA.TUANG COFFEE
            <br />
            <em>Banjar Wijaya</em>
          </h2>
          <p>Jl. Wijaya Kusuma, Banjar Wijaya, Cipondoh, Kota Tangerang</p>
          <div className="location-actions">
            <a
              className="button button-dark"
              href="https://maps.google.com/?q=SA.TUANG+COFFEE+Banjar+Wijaya"
              target="_blank"
              rel="noreferrer"
            >
              Buka peta <span>↗</span>
            </a>
            <a
              className="text-link"
              href="https://www.instagram.com/sa.tuangcoffee/"
              target="_blank"
              rel="noreferrer"
            >
              Instagram @sa.tuangcoffee
            </a>
          </div>
        </div>
        <div className="location-note">
          <span>SA.TUANG</span>
          <strong>
            Banjar Wijaya
            <br />
            Tangerang
          </strong>
          <small>Ruang kopi, jeda, dan cerita.</small>
        </div>
      </section>

      <section className="landing-last-cta">
        <span className="eyebrow light">SIAP MENIKMATI JEDA?</span>
        <h2>
          Pilih cara memesan
          <br />
          yang paling nyaman.
        </h2>
        <button className="button button-accent" onClick={startOrdering}>
          Pesan Sekarang <span>↗</span>
        </button>
      </section>
    </section>
  )
}
