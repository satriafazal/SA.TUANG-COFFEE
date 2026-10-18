import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  createCashOrder,
  getMemberMe,
  getMenu,
  getMyOrders,
  loginMember,
  logoutMember,
  registerMember,
  trackOrder,
  completeCustomerOrder,
  validatePromoCode,
  type CustomerBanner,
  type PromoValidationResult,
} from '../../api'
import type {
  Category,
  CustomerBundle,
  CustomerOrderRecord,
  CustomerProfile,
  Product,
  TrackedOrder,
} from '../../types'
import { getOrCreateDeviceToken } from '../../utils/deviceToken'

import {
  CartDrawer,
  type CartAction,
  type CartLine,
} from './components/CartDrawer'
import { CustomerFooter } from './components/CustomerFooter'
import { CustomerHeader, type CustomerMode, type Screen } from './components/CustomerHeader'
import { GuestOfferModal } from './components/GuestOfferModal'
import { FloatingCartButton } from './components/FloatingCartButton'
import { CartToastCard, type CartToastItem } from './components/CartToastCard'
import { CustomerAuthPage } from './pages/CustomerAuthPage'
import { IdentityChoicePage } from './pages/IdentityChoicePage'
import { LandingPage } from './pages/LandingPage'
import { MemberDashboardPage } from './pages/MemberDashboardPage'
import { MemberPointsPage } from './pages/MemberPointsPage'
import { MenuCataloguePage } from './pages/MenuCataloguePage'
import { OrderRecoveryPage } from './pages/OrderRecoveryPage'
import { OrderTrackingPage } from './pages/OrderTrackingPage'
import { SavedOrdersPage } from './pages/SavedOrdersPage'

function readCart(): Record<string, CartLine> {
  try {
    const raw = JSON.parse(
      localStorage.getItem('satuang-cart') ?? '{}',
    ) as Record<string, any>
    const normalized: Record<string, CartLine> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (!v) continue
      const key = v.key || (v.product ? `p-${v.product.id}` : k)
      normalized[key] = {
        key,
        item_type: v.item_type || v.product?.item_type || 'drink',
        product_id: v.product_id ?? v.product?.id,
        bundle_id: v.bundle_id,
        name: v.name || v.product?.name || 'Item',
        price: v.price || v.product?.price || '0',
        image_path: v.image_path ?? v.product?.image_path ?? v.bundle?.image_path ?? null,
        allow_notes: v.allow_notes ?? v.product?.allow_notes ?? false,
        quantity: v.quantity || 1,
        note: v.note || '',
        bundle_components: v.bundle_components,
        product: v.product,
        bundle: v.bundle,
      }
    }
    return normalized
  } catch {
    return {}
  }
}

function cartReducer(state: Record<string, CartLine>, action: CartAction): Record<string, CartLine> {
  if (action.type === 'clear') return {}
  if (action.type === 'add') {
    const key = `p-${action.product.id}`
    const previous = state[key]
    return {
      ...state,
      [key]: {
        key,
        item_type: action.product.item_type,
        product_id: action.product.id,
        name: action.product.name,
        price: action.product.price,
        image_path: action.product.image_path ?? null,
        allow_notes: action.product.allow_notes,
        quantity: (previous?.quantity ?? 0) + 1,
        note: previous?.note ?? '',
        product: action.product,
      },
    }
  }
  if (action.type === 'add_bundle') {
    const key = `b-${action.bundle.id}`
    const previous = state[key]
    return {
      ...state,
      [key]: {
        key,
        item_type: 'bundle',
        bundle_id: action.bundle.id,
        name: action.bundle.name,
        price: action.bundle.price,
        image_path: action.bundle.image_path ?? null,
        allow_notes: false,
        quantity: (previous?.quantity ?? 0) + 1,
        note: '',
        bundle_components: action.bundle.components?.map((c) => ({
          name: c.product?.name || 'Menu',
          quantity: c.quantity,
        })),
        bundle: action.bundle,
      },
    }
  }
  if (action.type === 'quantity') {
    if (action.quantity < 1) {
      const next = { ...state }
      delete next[action.key]
      return next
    }
    return {
      ...state,
      [action.key]: { ...state[action.key], quantity: action.quantity },
    }
  }
  if (action.type === 'note') {
    if (!state[action.key]) return state
    return { ...state, [action.key]: { ...state[action.key], note: action.note } }
  }
  return state
}

function startingScreen(): Screen {
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('satuang-customer-token')) {
      return 'member-home'
    }
    if (window.location.pathname === '/menu' || window.location.hash === '#menu') {
      return 'order-menu'
    }
  }
  return 'landing'
}

export function CustomerApp() {
  const deviceToken = useRef(getOrCreateDeviceToken()).current
  const [menu, setMenu] = useState<Product[]>([])
  const [bundles, setBundles] = useState<CustomerBundle[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [banners, setBanners] = useState<CustomerBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cart, dispatch] = useReducer(cartReducer, undefined, readCart)
  const [category, setCategory] = useState('semua')
  const [query, setQuery] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem('satuang-guest-name') || ''
  })
  const [isOrderingSession, setIsOrderingSession] = useState(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('satuang-customer-token')) return true
      return sessionStorage.getItem('satuang-ordering-session') === 'true'
    }
    return false
  })
  const [checkoutName, setCheckoutName] = useState(() => {
    return localStorage.getItem('satuang-guest-name') || ''
  })
  const [checkoutPhone, setCheckoutPhone] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [guestOfferOpen, setGuestOfferOpen] = useState(false)
  const [cartToast, setCartToast] = useState<CartToastItem | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  function showCartToast(item: {
    name: string
    price: number
    image_path?: string | null
  }) {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    const toastItem: CartToastItem = {
      ...item,
      id: Date.now(),
    }
    setCartToast(toastItem)
    toastTimeoutRef.current = window.setTimeout(() => {
      setCartToast(null)
    }, 3500)
  }

  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult['promo'] | null>(null)
  const [promoDiscount, setPromoDiscount] = useState<number>(0)
  const [promoMessage, setPromoMessage] = useState('')
  const [checkingPromo, setCheckingPromo] = useState(false)

  // Real backend member & orders state
  const [member, setMember] = useState<CustomerProfile | null>(null)
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([])
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false)

  const [screen, setScreen] = useState<Screen>(() => startingScreen())
  const [lookupOrderNumber, setLookupOrderNumber] = useState('')
  const [lookupName, setLookupName] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupResult, setLookupResult] = useState<TrackedOrder['order'] | null>(null)
  const [recoveryPhone, setRecoveryPhone] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveredOrder, setRecoveredOrder] = useState<CustomerOrderRecord | null>(null)

  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authConfirm, setAuthConfirm] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const idempotencyKey = useRef(crypto.randomUUID())

  const isMember = Boolean(member)
  const activeOrderingSession = isMember || isOrderingSession
  const sessionMode: CustomerMode = member ? 'member' : 'guest'
  const hasEntered = activeOrderingSession

  async function fetchOrders() {
    setIsRefreshingOrders(true)
    try {
      const res = await getMyOrders(deviceToken)
      setOrders(res.orders)
    } catch {
      // silently handle network error
    } finally {
      setIsRefreshingOrders(false)
    }
  }

  // Check existing token on mount and fetch menu + orders
  useEffect(() => {
    const token = localStorage.getItem('satuang-customer-token')
    if (token) {
      getMemberMe()
        .then((res) => {
          setMember(res.customer)
          setIsOrderingSession(true)
        })
        .catch(() => {
          localStorage.removeItem('satuang-customer-token')
          setMember(null)
        })
    }
    fetchOrders()
  }, [])

  const lines = Object.values(cart)
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.price) * line.quantity,
    0,
  )

  useEffect(() => {
    if (!appliedPromo) {
      setPromoDiscount(0)
      return
    }
    if (subtotal < appliedPromo.min_spend) {
      setAppliedPromo(null)
      setPromoDiscount(0)
      setPromoMessage(`Promo ${appliedPromo.code} dibatalkan karena subtotal kurang dari minimal belanja.`)
      return
    }
    if (appliedPromo.discount_type === 'percent') {
      let discount = Math.round(subtotal * (appliedPromo.discount_value / 100))
      if (appliedPromo.max_discount && discount > appliedPromo.max_discount) {
        discount = appliedPromo.max_discount
      }
      setPromoDiscount(Math.min(discount, subtotal))
    } else {
      setPromoDiscount(Math.min(appliedPromo.discount_value, subtotal))
    }
  }, [subtotal, appliedPromo])

  async function handleApplyPromo() {
    if (!promoCode.trim()) {
      setPromoMessage('Masukkan kode promo.')
      return
    }
    setCheckingPromo(true)
    setPromoMessage('')
    try {
      const result = await validatePromoCode(promoCode.trim(), subtotal)
      if (result.valid && result.promo) {
        setAppliedPromo(result.promo)
        setPromoDiscount(result.discount_amount ?? 0)
        setPromoMessage(result.message)
      } else {
        setAppliedPromo(null)
        setPromoDiscount(0)
        setPromoMessage(result.message || 'Kode promo tidak valid.')
      }
    } catch (err) {
      setAppliedPromo(null)
      setPromoDiscount(0)
      setPromoMessage(err instanceof Error ? err.message : 'Gagal memvalidasi promo.')
    } finally {
      setCheckingPromo(false)
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null)
    setPromoDiscount(0)
    setPromoCode('')
    setPromoMessage('')
  }

  const finalTotal = Math.max(0, subtotal - promoDiscount)

  useEffect(() => {
    try {
      localStorage.setItem('satuang-cart', JSON.stringify(cart))
    } catch {
      // storage unavailable
    }
  }, [cart])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    getMenu()
      .then((data) => {
        if (!active) return
        setMenu(data.products)
        setBundles(data.bundles ?? [])
        setCategories(data.categories)
        setBanners(data.banners ?? [])
      })
      .catch((error) => {
        if (!active) return
        setLoadError(
          error instanceof Error ? error.message : 'Katalog gagal dimuat.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    return menu.filter((item) => {
      const matchCategory =
        category === 'semua'
          ? true
          : (item.category?.slug ?? '').toLowerCase() === category.toLowerCase()
      const matchQuery =
        !query.trim() ||
        item.name.toLowerCase().includes(query.trim().toLowerCase())
      return matchCategory && matchQuery
    })
  }, [menu, category, query])

  function moveTo(screenName: Screen) {
    setScreen(screenName)
    setAuthError('')
    setAuthNotice('')
    if (screenName === 'orders') {
      fetchOrders()
    }
  }

  function startOrdering() {
    if (member) {
      setIsOrderingSession(true)
      sessionStorage.setItem('satuang-ordering-session', 'true')
      moveTo('order-menu')
    } else if (isOrderingSession && guestName) {
      moveTo('order-menu')
    } else {
      moveTo('identity')
    }
  }

  function handleConfirmGuestName(name: string) {
    setGuestName(name)
    setCheckoutName(name)
    localStorage.setItem('satuang-guest-name', name)
    sessionStorage.setItem('satuang-ordering-session', 'true')
    setIsOrderingSession(true)
    moveTo('order-menu')
  }

  function resetGuestSession() {
    sessionStorage.removeItem('satuang-ordering-session')
    setIsOrderingSession(false)
    moveTo('identity')
  }


  function chooseMember() {
    if (member) moveTo('member-home')
    else moveTo('login')
  }

  async function signOutMember() {
    try {
      await logoutMember()
    } catch {
      // ignore
    }
    localStorage.removeItem('satuang-customer-token')
    sessionStorage.removeItem('satuang-ordering-session')
    setMember(null)
    setIsOrderingSession(false)
    fetchOrders()
    moveTo('landing')
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    const name = authName.trim()
    const email = authEmail.trim().toLowerCase()
    const phone = authPhone.trim()

    if (!name) return setAuthError('Nama lengkap wajib diisi.')
    if (!email.includes('@')) return setAuthError('Masukkan alamat email yang valid.')
    if (!/^08[0-9]{8,12}$/.test(phone)) {
      return setAuthError('Nomor HP/WA tidak valid. Format: 08xxxxxxxxxx (10-14 digit).')
    }
    if (authPassword.length < 8) {
      return setAuthError('Kata sandi minimal 8 karakter.')
    }
    if (authPassword !== authConfirm) {
      return setAuthError('Konfirmasi kata sandi belum cocok.')
    }

    try {
      const res = await registerMember({
        name,
        email,
        phone,
        password: authPassword,
        password_confirmation: authConfirm,
      })
      localStorage.setItem('satuang-customer-token', res.token)
      sessionStorage.setItem('satuang-ordering-session', 'true')
      setIsOrderingSession(true)
      setMember(res.customer)
      setAuthPassword('')
      setAuthConfirm('')
      setAuthPhone('')
      fetchOrders()
      moveTo('member-home')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Pendaftaran Member gagal.')
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    const identifier = authEmail.trim()
    if (!identifier || !authPassword) {
      return setAuthError('Masukkan email/nomor HP dan kata sandi.')
    }

    try {
      const res = await loginMember({
        identifier,
        password: authPassword,
      })
      localStorage.setItem('satuang-customer-token', res.token)
      sessionStorage.setItem('satuang-ordering-session', 'true')
      setIsOrderingSession(true)
      setMember(res.customer)
      setAuthPassword('')
      fetchOrders()
      moveTo('member-home')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Email/No. HP atau kata sandi tidak cocok.')
    }
  }

  function passwordResetNotice() {
    setAuthNotice('Untuk reset kata sandi, silakan hubungi kasir atau barista di outlet SA.TUANG.')
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCheckoutError('')
    setSubmitting(true)

    try {
      await createCashOrder(
        {
          customer_name: member ? member.name.trim() : checkoutName.trim(),
          ...(member?.phone
            ? { customer_phone: member.phone }
            : checkoutPhone.trim()
            ? { customer_phone: checkoutPhone.trim() }
            : {}),
          guest_device_token: deviceToken,
          payment_method: 'cash',
          ...(appliedPromo && promoDiscount > 0 ? { promo_code: appliedPromo.code } : {}),
          items: lines.map((line) => ({
            ...(line.bundle_id ? { bundle_id: line.bundle_id } : { product_id: line.product_id }),
            quantity: line.quantity,
            ...(line.note ? { special_instructions: line.note } : {}),
          })),
        },
        idempotencyKey.current,
      )

      dispatch({ type: 'clear' })
      handleRemovePromo()
      idempotencyKey.current = crypto.randomUUID()
      setCheckoutName(member?.name ?? '')
      setCheckoutPhone('')
      setCartOpen(false)
      await fetchOrders()
      moveTo('orders')
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : 'Pesanan belum dapat dibuat.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function copyOrderNumber(num: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num).catch(() => {})
      setAuthNotice(`Kode antrean ${num} berhasil disalin ke clipboard.`)
    }
  }

  async function lookupOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLookupError('')
    setLookupResult(null)
    setLookupBusy(true)
    try {
      const result = await trackOrder(
        lookupOrderNumber.trim(),
        lookupName.trim(),
      )
      setLookupResult(result.order)
    } catch (error) {
      setLookupError(
        error instanceof Error ? error.message : 'Pesanan tidak ditemukan.',
      )
    } finally {
      setLookupBusy(false)
    }
  }

  function recoverOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecoveryError('')
    setRecoveredOrder(null)
    const phone = recoveryPhone.trim()
    const match = orders.find(
      (order) => order.customer_phone && order.customer_phone.trim() === phone,
    )
    if (!match) {
      setRecoveryError(
        'Tidak ada pesanan aktif dengan nomor HP tersebut pada perangkat ini.',
      )
      return
    }
    setRecoveredOrder(match)
  }

  const [completingOrderNumber, setCompletingOrderNumber] = useState<string | null>(null)

  async function handleCompleteOrder(orderNumber: string, customerName?: string) {
    setCompletingOrderNumber(orderNumber)
    try {
      const res = await completeCustomerOrder(orderNumber, deviceToken, customerName)
      setAuthNotice(res.message || 'Pesanan berhasil diselesaikan. Terima kasih!')
      await fetchOrders()
      if (lookupResult && lookupResult.order_number === orderNumber) {
        setLookupResult({
          ...lookupResult,
          order_status: 'SELESAI',
        })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Pesanan belum dapat diselesaikan.')
    } finally {
      setCompletingOrderNumber(null)
    }
  }

  return (
    <div className={`customer-shell screen-${screen}`}>
      <CustomerHeader
        screen={screen}
        isMember={isMember}
        isOrderingSession={activeOrderingSession}
        guestName={guestName}
        currentMember={member}
        sessionMode={sessionMode}
        itemCount={itemCount}
        hasEntered={hasEntered}
        moveTo={moveTo}
        setCartOpen={setCartOpen}
        signOutMember={signOutMember}
        resetGuestSession={resetGuestSession}
      />

      <main className="customer-main" id="top">
        {screen === 'landing' && (
          <LandingPage
            banners={banners}
            menu={menu}
            bundles={bundles}
            loading={loading}
            loadError={loadError}
            startOrdering={startOrdering}
            moveTo={moveTo}
          />
        )}

        {screen === 'identity' && (
          <IdentityChoicePage
            chooseMember={chooseMember}
            setGuestOfferOpen={setGuestOfferOpen}
            moveTo={moveTo}
          />
        )}

        {(screen === 'login' || screen === 'register') && (
          <CustomerAuthPage
            screen={screen}
            authName={authName}
            setAuthName={setAuthName}
            authEmail={authEmail}
            setAuthEmail={setAuthEmail}
            authPhone={authPhone}
            setAuthPhone={setAuthPhone}
            authPassword={authPassword}
            setAuthPassword={setAuthPassword}
            authConfirm={authConfirm}
            setAuthConfirm={setAuthConfirm}
            authError={authError}
            setAuthError={setAuthError}
            authNotice={authNotice}
            setAuthNotice={setAuthNotice}
            submitLogin={submitLogin}
            submitRegister={submitRegister}
            passwordResetNotice={passwordResetNotice}
            moveTo={moveTo}
          />
        )}

        {screen === 'member-home' && isMember && member && (
          <MemberDashboardPage
            currentMember={member}
            currentOrders={orders}
            moveTo={moveTo}
          />
        )}

        {screen === 'member-points' && isMember && member && (
          <MemberPointsPage
            currentMember={member}
            moveTo={moveTo}
          />
        )}

        {screen === 'order-menu' && (
          <MenuCataloguePage
            sessionMode={sessionMode}
            isViewOnly={!activeOrderingSession}
            onStartOrder={startOrdering}
            itemCount={itemCount}
            category={category}
            setCategory={setCategory}
            query={query}
            setQuery={setQuery}
            categories={categories}
            filtered={filtered}
            products={menu}
            bundles={bundles}
            loading={loading}
            loadError={loadError}
            setGuestOfferOpen={setGuestOfferOpen}
            setCartOpen={setCartOpen}
            dispatch={dispatch}
            onAddToCart={showCartToast}
          />
        )}

        {screen === 'orders' && (
          <SavedOrdersPage
            isMember={isMember}
            sessionMode={sessionMode}
            currentOrders={orders}
            copyOrderNumber={copyOrderNumber}
            refreshOrders={fetchOrders}
            isRefreshing={isRefreshingOrders}
            moveTo={moveTo}
            onCompleteOrder={handleCompleteOrder}
            completingOrderNumber={completingOrderNumber}
          />
        )}

        {screen === 'tracking' && (
          <OrderTrackingPage
            lookupOrderNumber={lookupOrderNumber}
            setLookupOrderNumber={setLookupOrderNumber}
            lookupName={lookupName}
            setLookupName={setLookupName}
            lookupError={lookupError}
            lookupBusy={lookupBusy}
            lookupResult={lookupResult}
            lookupOrder={lookupOrder}
            moveTo={moveTo}
            onCompleteOrder={(orderNum) => handleCompleteOrder(orderNum, lookupName)}
            completingOrderNumber={completingOrderNumber}
          />
        )}

        {screen === 'recovery' && (
          <OrderRecoveryPage
            sessionMode={sessionMode}
            recoveryPhone={recoveryPhone}
            setRecoveryPhone={setRecoveryPhone}
            recoveryError={recoveryError}
            recoveredOrder={recoveredOrder}
            recoverOrder={recoverOrder}
            setLookupOrderNumber={setLookupOrderNumber}
            setLookupName={setLookupName}
            setLookupResult={setLookupResult}
            moveTo={moveTo}
          />
        )}
      </main>

      <CustomerFooter screen={screen} moveTo={moveTo} />

      <GuestOfferModal
        isOpen={guestOfferOpen}
        onClose={() => setGuestOfferOpen(false)}
        onRegister={() => {
          setGuestOfferOpen(false)
          moveTo('register')
        }}
        onLogin={() => {
          setGuestOfferOpen(false)
          moveTo('login')
        }}
        onConfirmGuestName={(name) => {
          setGuestOfferOpen(false)
          handleConfirmGuestName(name)
        }}
        initialGuestName={guestName}
      />

      <CartToastCard
        toast={cartToast}
        onClose={() => setCartToast(null)}
        onViewCart={() => {
          setCartToast(null)
          setCartOpen(true)
        }}
      />

      <FloatingCartButton
        itemCount={itemCount}
        subtotal={subtotal}
        onClick={() => setCartOpen(true)}
        visible={activeOrderingSession && screen === 'order-menu' && !cartOpen && itemCount > 0}
      />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={lines}
        subtotal={subtotal}
        discountAmount={promoDiscount}
        finalTotal={finalTotal}
        itemCount={itemCount}
        sessionMode={sessionMode}
        currentMember={member}
        checkoutName={checkoutName}
        setCheckoutName={setCheckoutName}
        checkoutPhone={checkoutPhone}
        setCheckoutPhone={setCheckoutPhone}
        checkoutError={checkoutError}
        submitting={submitting}
        submitOrder={submitOrder}
        dispatch={dispatch}
        promoCode={promoCode}
        setPromoCode={setPromoCode}
        appliedPromo={appliedPromo}
        checkingPromo={checkingPromo}
        promoMessage={promoMessage}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={handleRemovePromo}
        onSwitchToMember={() => {
          setCartOpen(false)
          moveTo('login')
        }}
      />
    </div>
  )
}
export default CustomerApp
