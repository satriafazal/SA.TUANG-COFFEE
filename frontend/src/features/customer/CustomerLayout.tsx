import { Outlet, useLocation } from 'react-router-dom'
import { CartDrawer } from './components/CartDrawer'
import { CartToastCard } from './components/CartToastCard'
import { CustomerFooter } from './components/CustomerFooter'
import { CustomerHeader } from './components/CustomerHeader'
import { FloatingCartButton } from './components/FloatingCartButton'
import { GuestOfferModal } from './components/GuestOfferModal'
import { useCustomer } from './context/CustomerContext'

export function CustomerLayout() {
  const c = useCustomer()
  const location = useLocation()
  const isMenuRoute = location.pathname === '/menu' || location.pathname === '/order-menu'

  return (
    <div className={`customer-shell screen-${c.screen}`}>
      <CustomerHeader
        screen={c.screen}
        isMember={c.isMember}
        isOrderingSession={c.activeOrderingSession}
        guestName={c.guestName}
        currentMember={c.member}
        sessionMode={c.sessionMode}
        itemCount={c.itemCount}
        hasEntered={c.hasEntered}
        moveTo={c.moveTo}
        setCartOpen={c.setCartOpen}
        signOutMember={c.signOutMember}
        resetGuestSession={c.resetGuestSession}
      />

      <main className="customer-main" id="top">
        <Outlet />
      </main>

      <CustomerFooter screen={c.screen} moveTo={c.moveTo} />

      <GuestOfferModal
        isOpen={c.guestOfferOpen}
        onClose={() => c.setGuestOfferOpen(false)}
        onRegister={() => {
          c.setGuestOfferOpen(false)
          c.moveTo('register')
        }}
        onLogin={() => {
          c.setGuestOfferOpen(false)
          c.moveTo('login')
        }}
        onConfirmGuestName={(name) => {
          c.setGuestOfferOpen(false)
          c.handleConfirmGuestName(name)
        }}
        initialGuestName={c.guestName}
      />

      <CartToastCard
        toast={c.cartToast}
        onClose={() => c.setCartToast(null)}
        onViewCart={() => {
          c.setCartToast(null)
          c.setCartOpen(true)
        }}
      />

      <FloatingCartButton
        itemCount={c.itemCount}
        subtotal={c.subtotal}
        onClick={() => c.setCartOpen(true)}
        visible={c.activeOrderingSession && isMenuRoute && !c.cartOpen && c.itemCount > 0}
      />

      <CartDrawer
        isOpen={c.cartOpen}
        onClose={() => c.setCartOpen(false)}
        lines={c.lines}
        subtotal={c.subtotal}
        discountAmount={c.promoDiscount}
        finalTotal={c.finalTotal}
        itemCount={c.itemCount}
        sessionMode={c.sessionMode}
        currentMember={c.member}
        checkoutName={c.checkoutName}
        setCheckoutName={c.setCheckoutName}
        checkoutPhone={c.checkoutPhone}
        setCheckoutPhone={c.setCheckoutPhone}
        checkoutError={c.checkoutError}
        submitting={c.submitting}
        submitOrder={c.submitOrder}
        dispatch={c.dispatch}
        promoCode={c.promoCode}
        setPromoCode={c.setPromoCode}
        appliedPromo={c.appliedPromo}
        checkingPromo={c.checkingPromo}
        promoMessage={c.promoMessage}
        onApplyPromo={c.handleApplyPromo}
        onRemovePromo={c.handleRemovePromo}
        paymentMethod={c.paymentMethod}
        setPaymentMethod={c.setPaymentMethod}
        loyaltySettings={c.loyaltySettings}
        usePoints={c.usePoints}
        onToggleUsePoints={c.handleToggleUsePoints}
        pointsToRedeem={c.pointsToRedeem}
        setPointsToRedeem={c.setPointsToRedeem}
        pointsDiscount={c.pointsDiscount}
        onSwitchToMember={() => {
          c.closeCartAndNavigate('login')
        }}
      />
    </div>
  )
}

