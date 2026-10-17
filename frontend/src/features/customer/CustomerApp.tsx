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
  getMenu,
  trackOrder,
  validatePromoCode,
  type CustomerBanner,
  type PromoValidationResult,
} from '../../api'
import {
  hashPrototypePassword,
  newGuestSession,
  readPrototypeMembers,
  readPrototypeOrders,
  readPrototypeSession,
  replacePrototypeOrder,
  savePrototypeMembers,
  savePrototypeOrder,
  savePrototypeSession,
  verifyPrototypePassword,
  type CustomerMode,
  type PrototypeMember,
  type PrototypeOrder,
  type PrototypeOrderItem,
  type PrototypeSession,
} from '../../state/prototypeState'
import type { Category, CustomerBundle, Product, TrackedOrder } from '../../types'

import {
  CartDrawer,
  type CartAction,
  type CartLine,
} from './components/CartDrawer'
import { CustomerFooter } from './components/CustomerFooter'
import { CustomerHeader, type Screen } from './components/CustomerHeader'
import { GuestOfferModal } from './components/GuestOfferModal'
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
        allow_notes: v.allow_notes ?? v.product?.allow_notes ?? false,
        quantity: v.quantity || 1,
        note: v.note || '',
        bundle_components: v.bundle_components,
        product: v.product,
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
        allow_notes: false,
        quantity: (previous?.quantity ?? 0) + 1,
        note: '',
        bundle_components: action.bundle.components?.map((c) => ({
          name: c.product?.name || 'Menu',
          quantity: c.quantity,
        })),
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

function startingScreen(session: PrototypeSession | null): Screen {
  if (session?.mode === 'member') return 'member-home'
  if (session?.mode === 'guest') {
    return readPrototypeOrders().some(
      (order) => order.mode === 'guest' && order.guestToken === session.token,
    )
      ? 'orders'
      : 'order-menu'
  }
  return 'landing'
}

export function CustomerApp() {
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
  const [checkoutName, setCheckoutName] = useState('')
  const [checkoutPhone, setCheckoutPhone] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [guestOfferOpen, setGuestOfferOpen] = useState(false)

  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult['promo'] | null>(null)
  const [promoDiscount, setPromoDiscount] = useState<number>(0)
  const [promoMessage, setPromoMessage] = useState('')
  const [checkingPromo, setCheckingPromo] = useState(false)
  const [session, setSession] = useState<PrototypeSession | null>(() =>
    readPrototypeSession(),
  )
  const [members, setMembers] = useState<PrototypeMember[]>(() =>
    readPrototypeMembers(),
  )
  const [orders, setOrders] = useState<PrototypeOrder[]>(() =>
    readPrototypeOrders(),
  )
  const [screen, setScreen] = useState<Screen>(() =>
    startingScreen(readPrototypeSession()),
  )
  const [tracked, setTracked] = useState<
    Record<string, TrackedOrder['order']>
  >({})
  const [trackingOrder, setTrackingOrder] = useState('')
  const [trackError, setTrackError] = useState('')
  const [lookupOrderNumber, setLookupOrderNumber] = useState('')
  const [lookupName, setLookupName] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupResult, setLookupResult] = useState<
    TrackedOrder['order'] | null
  >(null)
  const [recoveryPhone, setRecoveryPhone] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveredOrder, setRecoveredOrder] = useState<PrototypeOrder | null>(
    null,
  )
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authConfirm, setAuthConfirm] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const idempotencyKey = useRef(crypto.randomUUID())

  const currentMember =
    session?.mode === 'member'
      ? members.find((member) => member.email === session.email) ?? null
      : null

  const currentOrders = useMemo(() => {
    if (session?.mode === 'member') {
      return orders.filter(
        (order) =>
          order.mode === 'member' && order.memberEmail === session.email,
      )
    }
    if (session?.mode === 'guest') {
      return orders.filter(
        (order) =>
          order.mode === 'guest' && order.guestToken === session.token,
      )
    }
    return []
  }, [orders, session])

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
      setPromoMessage(
        `Subtotal di bawah min. belanja Rp ${appliedPromo.min_spend.toLocaleString('id-ID')}`,
      )
      setPromoDiscount(0)
      return
    }
    let disc = 0
    if (appliedPromo.discount_type === 'percent') {
      disc = Math.round(subtotal * (appliedPromo.discount_value / 100))
      if (appliedPromo.max_discount && appliedPromo.max_discount > 0) {
        disc = Math.min(disc, appliedPromo.max_discount)
      }
    } else {
      disc = appliedPromo.discount_value
    }
    disc = Math.min(disc, subtotal)
    setPromoDiscount(disc)
    setPromoMessage(`Kode promo ${appliedPromo.code} aktif`)
  }, [appliedPromo, subtotal])

  const finalTotal = Math.max(0, subtotal - promoDiscount)

  async function handleApplyPromo() {
    if (!promoCode.trim()) return
    setCheckingPromo(true)
    setPromoMessage('')
    try {
      const res = await validatePromoCode(promoCode.trim(), subtotal)
      if (res.valid && res.promo) {
        setAppliedPromo(res.promo)
        setPromoDiscount(res.discount_amount ?? 0)
        setPromoMessage(res.message)
      } else {
        setPromoMessage(res.message || 'Kode promo tidak valid.')
      }
    } catch (err) {
      setPromoMessage(err instanceof Error ? err.message : 'Kode promo tidak valid.')
      setAppliedPromo(null)
      setPromoDiscount(0)
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

  const filtered = useMemo(() => {
    return menu.filter((product) => {
      const inCategory =
        category === 'semua' || product.category?.slug === category
      const matches = `${product.name} ${product.description ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase())
      return inCategory && matches
    })
  }, [menu, category, query])

  useEffect(() => {
    localStorage.setItem('satuang-cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    getMenu()
      .then((data) => {
        setMenu(data.products)
        setBundles(data.bundles ?? [])
        setCategories(data.categories)
        setBanners(data.banners ?? [])
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false))
  }, [])

  function moveTo(screenName: Screen) {
    setScreen(screenName)
    setAuthError('')
    setAuthNotice('')
  }

  function startOrdering() {
    if (session?.mode === 'member') moveTo('member-home')
    else if (session?.mode === 'guest') {
      moveTo(currentOrders.length ? 'orders' : 'order-menu')
    } else moveTo('identity')
  }

  function chooseGuest() {
    if (session?.mode !== 'guest') {
      const guest = newGuestSession()
      setSession(guest)
    }
    setGuestOfferOpen(false)
    setCheckoutName('')
    setCheckoutPhone('')
    moveTo('order-menu')
  }

  function chooseMember() {
    if (session?.mode === 'member') moveTo('member-home')
    else moveTo('login')
  }

  function signOutMember() {
    savePrototypeSession(null)
    setSession(null)
    moveTo('landing')
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    const email = authEmail.trim().toLowerCase()
    if (!authName.trim()) return setAuthError('Nama wajib diisi.')
    if (!email.includes('@')) {
      return setAuthError('Masukkan alamat email yang valid.')
    }
    if (authPassword.length < 8) {
      return setAuthError('Kata sandi minimal 8 karakter.')
    }
    if (authPassword !== authConfirm) {
      return setAuthError('Konfirmasi kata sandi belum cocok.')
    }
    if (members.some((member) => member.email === email)) {
      return setAuthError('Email ini sudah terdaftar. Silakan masuk.')
    }

    try {
      const credential = await hashPrototypePassword(authPassword)
      const member: PrototypeMember = {
        id: crypto.randomUUID(),
        name: authName.trim(),
        email,
        points: 0,
        passwordSalt: credential.salt,
        passwordHash: credential.hash,
      }
      const updated = [member, ...members]
      savePrototypeMembers(updated)
      setMembers(updated)
      const nextSession: PrototypeSession = { mode: 'member', email }
      savePrototypeSession(nextSession)
      setSession(nextSession)
      setAuthPassword('')
      setAuthConfirm('')
      moveTo('member-home')
    } catch {
      setAuthError('Pendaftaran belum dapat diselesaikan. Silakan coba lagi.')
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    const email = authEmail.trim().toLowerCase()
    if (!email.includes('@') || !authPassword) {
      return setAuthError('Masukkan email dan kata sandi.')
    }
    const member = members.find((item) => item.email === email)
    if (!member) {
      return setAuthError(
        'Akun belum ditemukan. Silakan daftar Member terlebih dahulu.',
      )
    }
    if (!member.passwordSalt || !member.passwordHash) {
      return setAuthError(
        'Akun ini belum memiliki kata sandi. Silakan daftar Member terlebih dahulu.',
      )
    }

    try {
      if (!(await verifyPrototypePassword(authPassword, member))) {
        return setAuthError('Kata sandi tidak cocok.')
      }
    } catch {
      return setAuthError('Login belum dapat diselesaikan. Silakan coba lagi.')
    }

    const nextSession: PrototypeSession = {
      mode: 'member',
      email: member.email,
    }
    savePrototypeSession(nextSession)
    setSession(nextSession)
    setAuthPassword('')
    moveTo('member-home')
  }

  function passwordResetNotice() {
    setAuthNotice('Fitur reset kata sandi belum tersedia. Silakan hubungi outlet.')
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCheckoutError('')
    if (session?.mode === 'member' && !currentMember) {
      return setCheckoutError(
        'Sesi Member tidak ditemukan. Silakan masuk kembali.',
      )
    }
    setSubmitting(true)

    try {
      const result = await createCashOrder(
        {
          customer_name:
            session?.mode === 'member' && currentMember
              ? currentMember.name.trim()
              : checkoutName.trim(),
          ...(session?.mode === 'guest' && checkoutPhone.trim()
            ? { customer_phone: checkoutPhone.trim() }
            : {}),
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

      const snapshot: PrototypeOrder = {
        orderNumber: result.order.order_number,
        customerName: result.order.customer_name,
        customerPhone:
          session?.mode === 'guest' ? checkoutPhone.trim() || null : null,
        total: result.order.total,
        createdAt: result.order.created_at,
        orderStatus: result.order.order_status,
        paymentStatus: result.order.payment_status,
        mode: session?.mode ?? 'guest',
        ...(session?.mode === 'guest' ? { guestToken: session.token } : {}),
        ...(session?.mode === 'member' ? { memberEmail: session.email } : {}),
        items: lines.map((line) => ({
          name: line.name,
          itemType: line.item_type,
          quantity: line.quantity,
          price: line.price,
        })) as PrototypeOrderItem[],
      }

      savePrototypeOrder(snapshot)
      setOrders(readPrototypeOrders())
      dispatch({ type: 'clear' })
      handleRemovePromo()
      idempotencyKey.current = crypto.randomUUID()
      setCheckoutName(currentMember?.name ?? '')
      setCheckoutPhone('')
      setCartOpen(false)
      moveTo('orders')
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : 'Pesanan belum dapat dibuat.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function refreshOrder(order: PrototypeOrder) {
    setTrackingOrder(order.orderNumber)
    setTrackError('')
    try {
      const result = await trackOrder(order.orderNumber, order.customerName)
      setTracked((previous) => ({
        ...previous,
        [order.orderNumber]: result.order,
      }))
      const updated = {
        ...order,
        orderStatus: result.order.order_status,
        paymentStatus: result.order.payment_status,
      }
      replacePrototypeOrder(updated)
      setOrders(readPrototypeOrders())
    } catch (error) {
      setTrackError(
        error instanceof Error
          ? error.message
          : 'Status pesanan belum dapat diperbarui.',
      )
    } finally {
      setTrackingOrder('')
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
        error instanceof Error
          ? error.message
          : 'Pesanan belum ditemukan atau data belum cocok.',
      )
    } finally {
      setLookupBusy(false)
    }
  }

  function recoverOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecoveryError('')
    setRecoveredOrder(null)
    const match = orders.find(
      (order) =>
        order.customerPhone &&
        order.customerPhone.replace(/\D/g, '') ===
          recoveryPhone.replace(/\D/g, ''),
    )
    if (!match) {
      return setRecoveryError(
        'Tidak ditemukan pesanan dengan nomor HP tersebut pada perangkat ini.',
      )
    }
    setRecoveredOrder(match)
  }

  async function copyOrderNumber(orderNumber: string) {
    try {
      await navigator.clipboard.writeText(orderNumber)
      setAuthNotice('Kode antrean berhasil disalin.')
    } catch {
      setAuthNotice(`Kode antrean: ${orderNumber}`)
    }
  }

  const isMember = session?.mode === 'member' && currentMember !== null
  const sessionMode: CustomerMode = session?.mode ?? 'guest'

  return (
    <div className="app-shell customer-app">
      <CustomerHeader
        screen={screen}
        isMember={isMember}
        sessionMode={sessionMode}
        itemCount={itemCount}
        moveTo={moveTo}
        setCartOpen={setCartOpen}
        signOutMember={signOutMember}
      />

      <main id="top">
        {screen === 'landing' && (
          <LandingPage
            banners={banners}
            menu={menu}
            loading={loading}
            loadError={loadError}
            startOrdering={startOrdering}
            moveTo={moveTo}
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

        {screen === 'member-home' && isMember && currentMember && (
          <MemberDashboardPage
            currentMember={currentMember}
            currentOrders={currentOrders}
            moveTo={moveTo}
          />
        )}

        {screen === 'member-points' && isMember && currentMember && (
          <MemberPointsPage
            currentMember={currentMember}
            moveTo={moveTo}
          />
        )}

        {screen === 'order-menu' && (
          <MenuCataloguePage
            sessionMode={sessionMode}
            itemCount={itemCount}
            category={category}
            setCategory={setCategory}
            query={query}
            setQuery={setQuery}
            categories={categories}
            filtered={filtered}
            bundles={bundles}
            loading={loading}
            loadError={loadError}
            setGuestOfferOpen={setGuestOfferOpen}
            setCartOpen={setCartOpen}
            dispatch={dispatch}
          />
        )}

        {screen === 'orders' && (
          <SavedOrdersPage
            isMember={isMember}
            sessionMode={sessionMode}
            currentOrders={currentOrders}
            tracked={tracked}
            trackingOrder={trackingOrder}
            trackError={trackError}
            authNotice={authNotice}
            copyOrderNumber={copyOrderNumber}
            refreshOrder={refreshOrder}
            moveTo={moveTo}
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
        onContinueGuest={chooseGuest}
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
        currentMember={currentMember}
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
        promoMessage={promoMessage}
        checkingPromo={checkingPromo}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={handleRemovePromo}
      />
    </div>
  )
}

export default CustomerApp
