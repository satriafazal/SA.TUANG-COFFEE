import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useCustomer } from './context/CustomerContext'
import { CustomerAuthPage } from './pages/CustomerAuthPage'
import { IdentityChoicePage } from './pages/IdentityChoicePage'
import { LandingPage } from './pages/LandingPage'
import { MemberDashboardPage } from './pages/MemberDashboardPage'
import { MemberPointsPage } from './pages/MemberPointsPage'
import { MenuCataloguePage } from './pages/MenuCataloguePage'
import { OrderRecoveryPage } from './pages/OrderRecoveryPage'
import { OrderTrackingPage } from './pages/OrderTrackingPage'
import { SavedOrdersPage } from './pages/SavedOrdersPage'

export function LandingRoute() {
  const c = useCustomer()
  return (
    <LandingPage
      banners={c.banners}
      menu={c.menu}
      bundles={c.bundles}
      loading={c.loading}
      loadError={c.loadError}
      startOrdering={c.startOrdering}
      moveTo={c.moveTo}
    />
  )
}

export function IdentityRoute() {
  const c = useCustomer()
  return (
    <IdentityChoicePage
      chooseMember={c.chooseMember}
      setGuestOfferOpen={c.setGuestOfferOpen}
      moveTo={c.moveTo}
    />
  )
}

export function MenuRoute() {
  const c = useCustomer()
  return (
    <MenuCataloguePage
      sessionMode={c.sessionMode}
      isViewOnly={!c.activeOrderingSession}
      onStartOrder={c.startOrdering}
      itemCount={c.itemCount}
      category={c.category}
      setCategory={c.setCategory}
      query={c.query}
      setQuery={c.setQuery}
      categories={c.categories}
      filtered={c.filtered}
      products={c.menu}
      bundles={c.bundles}
      loading={c.loading}
      loadError={c.loadError}
      setGuestOfferOpen={c.setGuestOfferOpen}
      setCartOpen={c.setCartOpen}
      dispatch={c.dispatch}
      onAddToCart={c.showCartToast}
    />
  )
}

export function LoginRoute() {
  const c = useCustomer()
  if (c.member) {
    return <Navigate to="/member" replace />
  }
  return (
    <CustomerAuthPage
      screen="login"
      authName={c.authName}
      setAuthName={c.setAuthName}
      authEmail={c.authEmail}
      setAuthEmail={c.setAuthEmail}
      authPhone={c.authPhone}
      setAuthPhone={c.setAuthPhone}
      authPassword={c.authPassword}
      setAuthPassword={c.setAuthPassword}
      authConfirm={c.authConfirm}
      setAuthConfirm={c.setAuthConfirm}
      authError={c.authError}
      setAuthError={c.setAuthError}
      authNotice={c.authNotice}
      setAuthNotice={c.setAuthNotice}
      submitLogin={c.submitLogin}
      submitRegister={c.submitRegister}
      passwordResetNotice={c.passwordResetNotice}
      moveTo={c.moveTo}
    />
  )
}

export function RegisterRoute() {
  const c = useCustomer()
  if (c.member) {
    return <Navigate to="/member" replace />
  }
  return (
    <CustomerAuthPage
      screen="register"
      authName={c.authName}
      setAuthName={c.setAuthName}
      authEmail={c.authEmail}
      setAuthEmail={c.setAuthEmail}
      authPhone={c.authPhone}
      setAuthPhone={c.setAuthPhone}
      authPassword={c.authPassword}
      setAuthPassword={c.setAuthPassword}
      authConfirm={c.authConfirm}
      setAuthConfirm={c.setAuthConfirm}
      authError={c.authError}
      setAuthError={c.setAuthError}
      authNotice={c.authNotice}
      setAuthNotice={c.setAuthNotice}
      submitLogin={c.submitLogin}
      submitRegister={c.submitRegister}
      passwordResetNotice={c.passwordResetNotice}
      moveTo={c.moveTo}
    />
  )
}

export function OrdersRoute() {
  const c = useCustomer()
  return (
    <SavedOrdersPage
      isMember={c.isMember}
      sessionMode={c.sessionMode}
      currentOrders={c.orders}
      copyOrderNumber={c.copyOrderNumber}
      refreshOrders={c.fetchOrders}
      isRefreshing={c.isRefreshingOrders}
      moveTo={c.moveTo}
      onCompleteOrder={c.handleCompleteOrder}
      completingOrderNumber={c.completingOrderNumber}
      onResetGuestSession={c.handleResetGuestSession}
      onPaySnap={c.triggerSnapPayment}
    />
  )
}

export function TrackingRoute() {
  const c = useCustomer()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const orderParam = searchParams.get('order')
    const nameParam = searchParams.get('name')
    if (orderParam && !c.lookupOrderNumber) {
      c.setLookupOrderNumber(orderParam)
    }
    if (nameParam && !c.lookupName) {
      c.setLookupName(nameParam)
    }
  }, [searchParams, c])

  return (
    <OrderTrackingPage
      lookupOrderNumber={c.lookupOrderNumber}
      setLookupOrderNumber={c.setLookupOrderNumber}
      lookupName={c.lookupName}
      setLookupName={c.setLookupName}
      lookupError={c.lookupError}
      lookupBusy={c.lookupBusy}
      lookupResult={c.lookupResult}
      lookupOrder={c.lookupOrder}
      moveTo={c.moveTo}
      onCompleteOrder={(orderNum) => c.handleCompleteOrder(orderNum, c.lookupName)}
      completingOrderNumber={c.completingOrderNumber}
    />
  )
}

export function RecoveryRoute() {
  const c = useCustomer()
  return (
    <OrderRecoveryPage
      sessionMode={c.sessionMode}
      recoveryPhone={c.recoveryPhone}
      setRecoveryPhone={c.setRecoveryPhone}
      recoveryError={c.recoveryError}
      recoveredOrder={c.recoveredOrder}
      recoverOrder={c.recoverOrder}
      setLookupOrderNumber={c.setLookupOrderNumber}
      setLookupName={c.setLookupName}
      setLookupResult={c.setLookupResult}
      moveTo={c.moveTo}
    />
  )
}

export function MemberDashboardRoute() {
  const c = useCustomer()
  if (!c.member) {
    return <Navigate to="/masuk" replace />
  }
  return (
    <MemberDashboardPage
      currentMember={c.member}
      currentOrders={c.orders}
      moveTo={c.moveTo}
    />
  )
}

export function MemberPointsRoute() {
  const c = useCustomer()
  if (!c.member) {
    return <Navigate to="/masuk" replace />
  }
  return (
    <MemberPointsPage
      currentMember={c.member}
      moveTo={c.moveTo}
    />
  )
}

export function NotFoundRoute() {
  const c = useCustomer()
  return (
    <section className="flow-page" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
      <span className="eyebrow">404 · HALAMAN TIDAK DITEMUKAN</span>
      <h1 style={{ marginTop: '0.5rem' }}>
        Halaman yang kamu cari
        <br />
        <em>tidak tersedia.</em>
      </h1>
      <p style={{ maxWidth: '420px', margin: '1rem auto 2rem' }}>
        Tautan mungkin telah berpindah atau salah ketik. Silakan kembali ke menu untuk memesan kopi favoritmu.
      </p>
      <button
        type="button"
        className="button button-accent"
        onClick={() => c.moveTo('order-menu')}
        style={{ margin: '0 auto' }}
      >
        Lihat Daftar Menu <span>↗</span>
      </button>
    </section>
  )
}

