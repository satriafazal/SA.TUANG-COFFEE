import type { MouseEvent } from 'react'
import type { CustomerMode } from '../../../state/prototypeState'

export type Screen =
  | 'landing'
  | 'identity'
  | 'login'
  | 'register'
  | 'member-home'
  | 'member-points'
  | 'order-menu'
  | 'orders'
  | 'tracking'
  | 'recovery'

interface CustomerHeaderProps {
  screen: Screen
  isMember: boolean
  sessionMode: CustomerMode
  itemCount: number
  moveTo: (screen: Screen) => void
  setCartOpen: (open: boolean) => void
  signOutMember: () => void
}

export function CustomerHeader({
  screen,
  isMember,
  sessionMode,
  itemCount,
  moveTo,
  setCartOpen,
  signOutMember,
}: CustomerHeaderProps) {
  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    moveTo('landing')
  }

  return (
    <header className={`site-header customer-header ${isMember ? 'member-header' : ''}`}>
      <a
        className="brand"
        href="#top"
        onClick={handleBrandClick}
        aria-label="SA.TUANG COFFEE beranda"
      >
        <span className="brand-mark">S</span>
        <span className="brand-copy">
          <strong>SA.TUANG</strong>
          <small>COFFEE · BANJAR WIJAYA</small>
        </span>
      </a>

      {screen === 'landing' ? (
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <a className="nav-link" href="#about">
            Tentang
          </a>
          <a className="nav-link" href="#menu-preview">
            Menu
          </a>
          <a className="nav-link" href="#location">
            Lokasi
          </a>
          <button className="nav-link" onClick={() => moveTo('tracking')}>
            Lacak Pesanan
          </button>
        </nav>
      ) : isMember ? (
        <nav className="desktop-nav" aria-label="Navigasi Member">
          <button className="nav-link" onClick={() => moveTo('member-home')}>
            Dashboard
          </button>
          <button className="nav-link" onClick={() => moveTo('order-menu')}>
            Pesan menu
          </button>
          <button className="nav-link" onClick={() => moveTo('orders')}>
            Pesanan saya
          </button>
          <button className="nav-link" onClick={() => moveTo('tracking')}>
            Lacak Pesanan
          </button>
          <button className="nav-link" onClick={() => moveTo('member-points')}>
            Poin
          </button>
        </nav>
      ) : (
        <nav className="desktop-nav" aria-label="Navigasi pemesanan">
          <button className="nav-link" onClick={() => moveTo('landing')}>
            Beranda
          </button>
          <button className="nav-link" onClick={() => moveTo('tracking')}>
            Lacak Pesanan
          </button>
          {sessionMode === 'guest' && (
            <button className="nav-link" onClick={() => moveTo('orders')}>
              Pesanan saya
            </button>
          )}
          {sessionMode === 'guest' && (
            <button className="nav-link" onClick={() => moveTo('identity')}>
              Ganti cara pesan
            </button>
          )}
          {screen === 'identity' && (
            <button className="nav-link" onClick={() => moveTo('recovery')}>
              Lupa kode antrean?
            </button>
          )}
        </nav>
      )}

      {screen === 'order-menu' ? (
        <button
          className="cart-trigger"
          onClick={() => setCartOpen(true)}
          aria-label={`Buka keranjang, ${itemCount} item`}
        >
          <span aria-hidden="true">▱</span>
          <span className="cart-label">Keranjang</span>
          <b className="cart-count">{itemCount}</b>
        </button>
      ) : isMember ? (
        <button className="account-chip" onClick={signOutMember}>
          Keluar
        </button>
      ) : sessionMode === 'guest' ? (
        <button className="account-chip" onClick={() => moveTo('orders')}>
          Guest · Pesanan
        </button>
      ) : null}

      <nav className="mobile-nav" aria-label="Navigasi ponsel">
        {screen === 'landing' ? (
          <>
            <a className="mobile-nav-link" href="#about">
              Tentang
            </a>
            <a className="mobile-nav-link" href="#menu-preview">
              Menu
            </a>
            <a className="mobile-nav-link" href="#location">
              Lokasi
            </a>
            <button
              className="mobile-nav-link"
              onClick={() => moveTo('tracking')}
            >
              Lacak Pesanan
            </button>
          </>
        ) : isMember ? (
          <>
            <button
              className={`mobile-nav-link ${screen === 'member-home' ? 'active' : ''}`}
              onClick={() => moveTo('member-home')}
            >
              Beranda
            </button>
            <button
              className={`mobile-nav-link ${screen === 'order-menu' ? 'active' : ''}`}
              onClick={() => moveTo('order-menu')}
            >
              Menu
            </button>
            <button
              className={`mobile-nav-link ${screen === 'orders' ? 'active' : ''}`}
              onClick={() => moveTo('orders')}
            >
              Pesanan
            </button>
            <button
              className={`mobile-nav-link ${screen === 'tracking' ? 'active' : ''}`}
              onClick={() => moveTo('tracking')}
            >
              Lacak
            </button>
            <button
              className={`mobile-nav-link ${screen === 'member-points' ? 'active' : ''}`}
              onClick={() => moveTo('member-points')}
            >
              Poin
            </button>
          </>
        ) : (
          <>
            <button
              className="mobile-nav-link"
              onClick={() => moveTo('landing')}
            >
              Beranda
            </button>
            <button
              className={`mobile-nav-link ${screen === 'tracking' ? 'active' : ''}`}
              onClick={() => moveTo('tracking')}
            >
              Lacak Pesanan
            </button>
            {sessionMode === 'guest' && (
              <button
                className={`mobile-nav-link ${screen === 'orders' ? 'active' : ''}`}
                onClick={() => moveTo('orders')}
              >
                Pesanan Saya
              </button>
            )}
            {sessionMode === 'guest' && (
              <button
                className={`mobile-nav-link ${screen === 'order-menu' ? 'active' : ''}`}
                onClick={() => moveTo('order-menu')}
              >
                Menu
              </button>
            )}
          </>
        )}
      </nav>
    </header>
  )
}
