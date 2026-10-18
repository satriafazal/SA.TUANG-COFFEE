import type { MouseEvent } from 'react'
import type { CustomerProfile } from '../../../types'

export type CustomerMode = 'guest' | 'member'

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
  isOrderingSession: boolean
  guestName?: string
  currentMember?: CustomerProfile | null
  sessionMode: CustomerMode
  itemCount: number
  hasEntered: boolean
  moveTo: (screen: Screen) => void
  setCartOpen: (open: boolean) => void
  signOutMember: () => void
  resetGuestSession?: () => void
}

export function CustomerHeader({
  screen,
  isMember,
  isOrderingSession,
  guestName,
  currentMember,
  sessionMode: _sessionMode,
  itemCount,
  hasEntered,
  moveTo,
  setCartOpen,
  signOutMember,
  resetGuestSession,
}: CustomerHeaderProps) {
  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    moveTo('landing')
  }

  const showActiveOrderTabs = isOrderingSession || isMember || screen === 'orders'

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

      {/* Navigasi Utama: Beranda & Menu untuk semua, Pesanan hanya saat sesi pesan aktif */}
      <nav className="desktop-nav" aria-label="Navigasi utama">
        <button
          type="button"
          className={`nav-link ${screen === 'landing' ? 'active' : ''}`}
          onClick={() => moveTo('landing')}
        >
          Beranda
        </button>
        <button
          type="button"
          className={`nav-link ${screen === 'order-menu' ? 'active' : ''}`}
          onClick={() => moveTo('order-menu')}
        >
          Menu
        </button>
        {showActiveOrderTabs && (
          <button
            type="button"
            className={`nav-link ${screen === 'orders' ? 'active' : ''}`}
            onClick={() => moveTo('orders')}
          >
            Pesanan
          </button>
        )}
      </nav>

      {/* Area Kanan: Akun Member/Guest dan Keranjang (hanya saat aktif memesan) */}
      <div className="header-actions">
        {isMember ? (
          <div className="member-profile-chip">
            <button
              type="button"
              className="profile-btn"
              onClick={() => moveTo('member-home')}
              title="Buka Dashboard Member"
            >
              <span className="member-badge">M</span>
              <span className="member-name">{currentMember?.name || 'Member'}</span>
              <span className="member-pts">{currentMember?.points_balance ?? 0} pts</span>
            </button>
            <button
              type="button"
              className="sign-out-btn"
              onClick={signOutMember}
              title="Keluar dari akun"
            >
              Keluar
            </button>
          </div>
        ) : isOrderingSession && guestName ? (
          <div className="guest-profile-chip">
            <div className="guest-btn" title="Memesan sebagai Guest">
              <span className="guest-badge">Guest</span>
              <span className="guest-name">{guestName}</span>
            </div>
            {resetGuestSession && (
              <button
                type="button"
                className="sign-out-btn"
                onClick={resetGuestSession}
                title="Ganti nama atau akhiri sesi pesan"
              >
                Ganti
              </button>
            )}
          </div>
        ) : null}

        {/* Keranjang HANYA muncul jika sudah masuk sebagai member atau guest yang aktif memesan */}
        {showActiveOrderTabs && hasEntered && (
          <button
            type="button"
            className="cart-trigger header-cart-trigger"
            onClick={() => setCartOpen(true)}
            aria-label={`Buka keranjang belanja (${itemCount} item)`}
          >
            <span role="img" aria-hidden="true">🛒</span>
            <span className="cart-label">Keranjang</span>
            <span className="cart-count">{itemCount}</span>
          </button>
        )}
      </div>

      {/* Navigasi Ponsel */}
      <nav className="mobile-nav" aria-label="Navigasi ponsel">
        <button
          type="button"
          className={`mobile-nav-link ${screen === 'landing' ? 'active' : ''}`}
          onClick={() => moveTo('landing')}
        >
          Beranda
        </button>
        <button
          type="button"
          className={`mobile-nav-link ${screen === 'order-menu' ? 'active' : ''}`}
          onClick={() => moveTo('order-menu')}
        >
          Menu
        </button>
        {showActiveOrderTabs && (
          <button
            type="button"
            className={`mobile-nav-link ${screen === 'orders' ? 'active' : ''}`}
            onClick={() => moveTo('orders')}
          >
            Pesanan
          </button>
        )}
        {isMember && (
          <button
            type="button"
            className={`mobile-nav-link ${screen === 'member-home' || screen === 'member-points' ? 'active' : ''}`}
            onClick={() => moveTo('member-home')}
          >
            Member
          </button>
        )}
      </nav>
    </header>
  )
}

