import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  completeCustomerOrder,
  createCashOrder,
  getLoyaltySettings,
  getMemberMe,
  getMenu,
  getMyOrders,
  loginMember,
  logoutMember,
  registerMember,
  trackOrder,
  validatePromoCode,
  type CustomerBanner,
  type LoyaltySettings,
  type PromoValidationResult,
} from '../../../api'
import type {
  Category,
  CustomerBundle,
  CustomerOrderRecord,
  CustomerProfile,
  Product,
  TrackedOrder,
} from '../../../types'
import {
  forceResetDeviceSession,
  getOrCreateDeviceToken,
  getTodayDateString,
} from '../../../utils/deviceToken'
import { generateUUID } from '../../../utils/uuid'
import type { CartAction, CartLine } from '../components/CartDrawer'
import type { CustomerMode, Screen } from '../components/CustomerHeader'
import type { CartToastItem } from '../components/CartToastCard'

export const SCREEN_TO_PATH: Record<Screen, string> = {
  landing: '/',
  identity: '/pilih-akses',
  'order-menu': '/menu',
  login: '/masuk',
  register: '/daftar',
  orders: '/pesanan',
  tracking: '/lacak',
  recovery: '/lupa-kode',
  'member-home': '/member',
  'member-points': '/member/poin',
}

export function pathToScreen(pathname: string): Screen {
  if (pathname === '/pilih-akses' || pathname === '/identity') return 'identity'
  if (pathname === '/menu' || pathname === '/order-menu') return 'order-menu'
  if (pathname === '/masuk' || pathname === '/login') return 'login'
  if (pathname === '/daftar' || pathname === '/register') return 'register'
  if (pathname === '/pesanan' || pathname === '/orders') return 'orders'
  if (pathname === '/lacak' || pathname === '/tracking') return 'tracking'
  if (pathname === '/lupa-kode' || pathname === '/recovery') return 'recovery'
  if (pathname === '/member/poin') return 'member-points'
  if (pathname === '/member' || pathname.startsWith('/member/')) return 'member-home'
  return 'landing'
}

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

interface CustomerContextType {
  // Navigation
  screen: Screen
  moveTo: (screen: Screen) => void

  // Session & Auth
  deviceToken: string
  guestName: string
  setGuestName: (val: string) => void
  member: CustomerProfile | null
  isMember: boolean
  sessionMode: CustomerMode
  isOrderingSession: boolean
  activeOrderingSession: boolean
  hasEntered: boolean
  signOutMember: () => Promise<void>
  handleConfirmGuestName: (name: string) => void
  resetGuestSession: () => void
  handleResetGuestSession: () => void
  startOrdering: () => void
  chooseMember: () => void

  // Auth Form Fields
  authName: string
  setAuthName: (val: string) => void
  authEmail: string
  setAuthEmail: (val: string) => void
  authPhone: string
  setAuthPhone: (val: string) => void
  authPassword: string
  setAuthPassword: (val: string) => void
  authConfirm: string
  setAuthConfirm: (val: string) => void
  authError: string
  setAuthError: (val: string) => void
  authNotice: string
  setAuthNotice: (val: string) => void
  submitLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>
  submitRegister: (event: FormEvent<HTMLFormElement>) => Promise<void>
  passwordResetNotice: () => void

  // Catalog
  menu: Product[]
  bundles: CustomerBundle[]
  categories: Category[]
  banners: CustomerBanner[]
  loading: boolean
  loadError: string
  category: string
  setCategory: (val: string) => void
  query: string
  setQuery: (val: string) => void
  filtered: Product[]

  // Cart
  cart: Record<string, CartLine>
  lines: CartLine[]
  itemCount: number
  subtotal: number
  finalTotal: number
  dispatch: Dispatch<CartAction>
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  closeCartAndNavigate: (screenName: Screen) => void
  cartToast: CartToastItem | null
  setCartToast: (toast: CartToastItem | null) => void
  showCartToast: (item: { name: string; price: number; image_path?: string | null }) => void

  // Checkout
  checkoutName: string
  setCheckoutName: (val: string) => void
  checkoutPhone: string
  setCheckoutPhone: (val: string) => void
  checkoutError: string
  setCheckoutError: (val: string) => void
  submitting: boolean
  paymentMethod: 'cash' | 'midtrans'
  setPaymentMethod: (val: 'cash' | 'midtrans') => void
  submitOrder: (event: FormEvent<HTMLFormElement>) => Promise<void>

  // Promo
  promoCode: string
  setPromoCode: (val: string) => void
  appliedPromo: PromoValidationResult['promo'] | null
  promoDiscount: number
  promoMessage: string
  checkingPromo: boolean
  handleApplyPromo: () => Promise<void>
  handleRemovePromo: () => void

  // Loyalty Points
  loyaltySettings: LoyaltySettings | null
  usePoints: boolean
  pointsToRedeem: number
  setPointsToRedeem: (pts: number) => void
  pointsDiscount: number
  handleToggleUsePoints: (enable: boolean) => void

  // Orders
  orders: CustomerOrderRecord[]
  isRefreshingOrders: boolean
  fetchOrders: (tokenArg?: unknown) => Promise<void>
  completingOrderNumber: string | null
  handleCompleteOrder: (orderNumber: string, customerName?: string) => Promise<void>
  triggerSnapPayment: (snapToken: string) => void
  copyOrderNumber: (num: string) => void

  // Modals
  guestOfferOpen: boolean
  setGuestOfferOpen: (val: boolean) => void

  // Tracking
  lookupOrderNumber: string
  setLookupOrderNumber: (val: string) => void
  lookupName: string
  setLookupName: (val: string) => void
  lookupError: string
  lookupBusy: boolean
  lookupResult: TrackedOrder['order'] | null
  setLookupResult: (val: TrackedOrder['order'] | null) => void
  lookupOrder: (event: FormEvent<HTMLFormElement>) => Promise<void>

  // Recovery
  recoveryPhone: string
  setRecoveryPhone: (val: string) => void
  recoveryError: string
  recoveredOrder: CustomerOrderRecord | null
  recoverOrder: (event: FormEvent<HTMLFormElement>) => void
}

const CustomerContext = createContext<CustomerContextType | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const screen = useMemo(() => pathToScreen(location.pathname), [location.pathname])

  const [deviceToken, setDeviceToken] = useState<string>(() => getOrCreateDeviceToken())
  const lastActiveDateRef = useRef(getTodayDateString())

  const [menu, setMenu] = useState<Product[]>([])
  const [bundles, setBundles] = useState<CustomerBundle[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [banners, setBanners] = useState<CustomerBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [cart, dispatch] = useReducer(cartReducer, undefined, readCart)
  const [category, setCategory] = useState('semua')
  const [query, setQuery] = useState('')
  const [cartOpen, setCartOpenState] = useState(false)
  const [guestOfferOpen, setGuestOfferOpenState] = useState(false)

  // Mobile-first back button handler for CartDrawer & Modal:
  // When cart or modal opens, push a history entry.
  // When user swipes back on phone, intercept popstate to close modal instead of exiting!
  const isClosingModalViaPopstate = useRef(false)

  const setCartOpen = useCallback((open: boolean) => {
    if (open) {
      window.history.pushState({ modal: 'cart' }, '')
      setCartOpenState(true)
    } else {
      if (window.history.state?.modal === 'cart') {
        isClosingModalViaPopstate.current = true
        window.history.back()
      }
      setCartOpenState(false)
    }
  }, [])

  const closeCartAndNavigate = useCallback((screenName: Screen) => {
    isClosingModalViaPopstate.current = true
    setCartOpenState(false)
    const targetPath = SCREEN_TO_PATH[screenName] || '/'
    if (window.history.state?.modal === 'cart') {
      navigate(targetPath, { replace: true })
    } else {
      navigate(targetPath)
    }
  }, [navigate])

  const setGuestOfferOpen = useCallback((open: boolean) => {
    if (open) {
      window.history.pushState({ modal: 'guest-offer' }, '')
      setGuestOfferOpenState(true)
    } else {
      if (window.history.state?.modal === 'guest-offer') {
        isClosingModalViaPopstate.current = true
        window.history.back()
      }
      setGuestOfferOpenState(false)
    }
  }, [])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If closing via back(), state was already updated
      if (isClosingModalViaPopstate.current) {
        isClosingModalViaPopstate.current = false
        return
      }
      // If user pressed mobile hardware back button while cart or modal was open:
      if (cartOpen) {
        setCartOpenState(false)
        event.stopImmediatePropagation()
      } else if (guestOfferOpen) {
        setGuestOfferOpenState(false)
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [cartOpen, guestOfferOpen])

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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'midtrans'>('cash')

  const [cartToast, setCartToast] = useState<CartToastItem | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  const showCartToast = useCallback((item: {
    name: string
    price: number
    image_path?: string | null
  }) => {
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
  }, [])

  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult['promo'] | null>(null)
  const [promoDiscount, setPromoDiscount] = useState<number>(0)
  const [promoMessage, setPromoMessage] = useState('')
  const [checkingPromo, setCheckingPromo] = useState(false)

  // Loyalty Settings & Redemption State
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null)
  const [usePoints, setUsePoints] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)

  useEffect(() => {
    getLoyaltySettings()
      .then((res) => setLoyaltySettings(res.settings))
      .catch(() => {})
  }, [])

  // Real backend member & orders state
  const [member, setMember] = useState<CustomerProfile | null>(null)
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([])
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false)

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
  const idempotencyKey = useRef(generateUUID())

  const isMember = Boolean(member)
  const activeOrderingSession = isMember || isOrderingSession
  const sessionMode: CustomerMode = member ? 'member' : 'guest'
  const hasEntered = activeOrderingSession

  const fetchOrders = useCallback(async (tokenArg?: unknown) => {
    const validToken = typeof tokenArg === 'string' && tokenArg.trim() !== ''
      ? tokenArg.trim()
      : deviceToken

    const isMemberLoggedIn = Boolean(localStorage.getItem('satuang-customer-token'))

    setIsRefreshingOrders(true)
    try {
      const res = await getMyOrders(isMemberLoggedIn ? undefined : validToken)
      setOrders(res.orders)
    } catch {
      // silently handle network error
    } finally {
      setIsRefreshingOrders(false)
    }
  }, [deviceToken])

  // Auto-reset when date rolls over past midnight (00:00)
  useEffect(() => {
    function checkMidnightRollover() {
      const today = getTodayDateString()
      if (lastActiveDateRef.current !== today) {
        lastActiveDateRef.current = today
        const newToken = getOrCreateDeviceToken()
        setDeviceToken(newToken)
        dispatch({ type: 'clear' })
        setGuestName('')
        setIsOrderingSession(Boolean(localStorage.getItem('satuang-customer-token')))
        fetchOrders(newToken)
      }
    }

    const intervalId = setInterval(checkMidnightRollover, 30000)
    document.addEventListener('visibilitychange', checkMidnightRollover)
    window.addEventListener('focus', checkMidnightRollover)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', checkMidnightRollover)
      window.removeEventListener('focus', checkMidnightRollover)
    }
  }, [deviceToken, fetchOrders])

  const moveTo = useCallback((screenName: Screen) => {
    const targetPath = SCREEN_TO_PATH[screenName] || '/'
    setAuthError('')
    setAuthNotice('')
    if (screenName === 'orders') {
      fetchOrders()
    }
    navigate(targetPath)
  }, [navigate, fetchOrders])

  const handleResetGuestSession = useCallback(() => {
    const newToken = forceResetDeviceSession()
    setDeviceToken(newToken)
    dispatch({ type: 'clear' })
    setGuestName('')
    sessionStorage.removeItem('satuang-ordering-session')
    setIsOrderingSession(false)
    setOrders([])
    setAuthNotice('Sesi perangkat diperbarui. Halaman kembali segar.')
    moveTo('landing')
  }, [moveTo])

  // Check existing token on mount and fetch menu + orders
  useEffect(() => {
    const token = localStorage.getItem('satuang-customer-token')
    if (token) {
      getMemberMe()
        .then((res) => {
          setMember(res.customer)
          setIsOrderingSession(true)
          void fetchOrders()
        })
        .catch(() => {
          localStorage.removeItem('satuang-customer-token')
          setMember(null)
          void fetchOrders()
        })
    } else {
      void fetchOrders()
    }
  }, [fetchOrders])

  const triggerSnapPayment = useCallback((snapToken: string) => {
    if (typeof window !== 'undefined' && (window as any).snap && typeof (window as any).snap.pay === 'function') {
      ;(window as any).snap.pay(snapToken, {
        onSuccess: async () => {
          setAuthNotice('Pembayaran berhasil diterima! Pesanan sedang disiapkan.')
          await fetchOrders()
        },
        onPending: async () => {
          setAuthNotice('Menunggu verifikasi pembayaran. Silakan selesaikan transaksi Anda.')
          await fetchOrders()
        },
        onError: async () => {
          setAuthNotice('Pembayaran gagal diproses atau kedaluwarsa.')
          await fetchOrders()
        },
        onClose: async () => {
          await fetchOrders()
        },
      })
    } else {
      setAuthNotice('Jendela pembayaran siap. Silakan klik tombol Bayar Sekarang pada tab pesanan.')
    }
  }, [fetchOrders])

  // Polling for active pending online orders
  useEffect(() => {
    const hasPendingOnline = orders.some(
      (o) => o.payment_status === 'MENUNGGU' && (o.payment_method === 'midtrans' || o.payment_method === 'qris' || o.payment_method === 'va')
    )
    if (!hasPendingOnline) return

    const timer = setInterval(() => {
      fetchOrders()
    }, 4000)

    return () => clearInterval(timer)
  }, [orders, fetchOrders])

  const lines = useMemo(() => Object.values(cart), [cart])
  const itemCount = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines])
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0),
    [lines],
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

  const handleApplyPromo = useCallback(async () => {
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
        setUsePoints(false)
        setPointsToRedeem(0)
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
  }, [promoCode, subtotal])

  const handleRemovePromo = useCallback(() => {
    setAppliedPromo(null)
    setPromoDiscount(0)
    setPromoCode('')
    setPromoMessage('')
  }, [])

  const handleToggleUsePoints = useCallback((enable: boolean) => {
    if (enable) {
      handleRemovePromo()
      setUsePoints(true)
      const minPts = loyaltySettings?.min_redemption_points ?? 5
      const available = member?.points_balance ?? 0
      if (available >= minPts) {
        setPointsToRedeem(minPts)
      } else {
        setPointsToRedeem(available)
      }
    } else {
      setUsePoints(false)
      setPointsToRedeem(0)
    }
  }, [handleRemovePromo, loyaltySettings, member])

  const pointsDiscount = useMemo(() => {
    if (!usePoints || !loyaltySettings || !loyaltySettings.is_active || pointsToRedeem <= 0 || !member) {
      return 0
    }
    const nominal = pointsToRedeem * loyaltySettings.point_value_rupiah
    const maxDiscount = (loyaltySettings.max_discount_percentage / 100) * subtotal
    return Math.min(nominal, maxDiscount, subtotal)
  }, [usePoints, loyaltySettings, pointsToRedeem, member, subtotal])

  const finalTotal = Math.max(0, subtotal - promoDiscount - pointsDiscount)

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

  const startOrdering = useCallback(() => {
    if (member) {
      setIsOrderingSession(true)
      sessionStorage.setItem('satuang-ordering-session', 'true')
      moveTo('order-menu')
    } else if (isOrderingSession && guestName) {
      moveTo('order-menu')
    } else {
      moveTo('identity')
    }
  }, [member, isOrderingSession, guestName, moveTo])

  const handleConfirmGuestName = useCallback((name: string) => {
    setGuestName(name)
    setCheckoutName(name)
    localStorage.setItem('satuang-guest-name', name)
    sessionStorage.setItem('satuang-ordering-session', 'true')
    setIsOrderingSession(true)
    moveTo('order-menu')
  }, [moveTo])

  const resetGuestSession = useCallback(() => {
    sessionStorage.removeItem('satuang-ordering-session')
    setIsOrderingSession(false)
    moveTo('identity')
  }, [moveTo])

  const chooseMember = useCallback(() => {
    if (member) moveTo('member-home')
    else moveTo('login')
  }, [member, moveTo])

  const signOutMember = useCallback(async () => {
    try {
      await logoutMember()
    } catch {
      // ignore
    }
    localStorage.removeItem('satuang-customer-token')
    sessionStorage.removeItem('satuang-ordering-session')
    setMember(null)
    setIsOrderingSession(false)
    setOrders([])
    await fetchOrders()
    moveTo('landing')
  }, [fetchOrders, moveTo])

  const submitRegister = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
      setOrders([])
      setAuthPassword('')
      setAuthConfirm('')
      setAuthPhone('')
      await fetchOrders()
      moveTo('member-home')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Pendaftaran Member gagal.')
    }
  }, [authName, authEmail, authPhone, authPassword, authConfirm, fetchOrders, moveTo])

  const submitLogin = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
      setOrders([])
      setAuthPassword('')
      await fetchOrders()
      moveTo('member-home')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Email/No. HP atau kata sandi tidak cocok.')
    }
  }, [authEmail, authPassword, fetchOrders, moveTo])

  const passwordResetNotice = useCallback(() => {
    setAuthNotice('Untuk reset kata sandi, silakan hubungi kasir atau barista di outlet SA.TUANG.')
  }, [])

  const submitOrder = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCheckoutError('')
    setSubmitting(true)

    try {
      const res = await createCashOrder(
        {
          customer_name: member ? member.name.trim() : checkoutName.trim(),
          ...(member?.phone
            ? { customer_phone: member.phone }
            : checkoutPhone.trim()
            ? { customer_phone: checkoutPhone.trim() }
            : {}),
          ...(member ? {} : { guest_device_token: deviceToken }),
          payment_method: paymentMethod,
          ...(appliedPromo && promoDiscount > 0 ? { promo_code: appliedPromo.code } : {}),
          ...(usePoints && pointsToRedeem > 0 ? { points_redeemed: pointsToRedeem } : {}),
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
      setUsePoints(false)
      setPointsToRedeem(0)
      idempotencyKey.current = generateUUID()
      setCheckoutName(member?.name ?? '')
      setCheckoutPhone('')
      setCartOpen(false)
      await fetchOrders()
      moveTo('orders')

      if (paymentMethod === 'midtrans' && res.order.snap_token) {
        triggerSnapPayment(res.order.snap_token)
      }
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : 'Pesanan belum dapat dibuat.',
      )
    } finally {
      setSubmitting(false)
    }
  }, [
    member,
    checkoutName,
    checkoutPhone,
    deviceToken,
    paymentMethod,
    appliedPromo,
    promoDiscount,
    usePoints,
    pointsToRedeem,
    lines,
    handleRemovePromo,
    setCartOpen,
    fetchOrders,
    moveTo,
    triggerSnapPayment,
  ])

  const copyOrderNumber = useCallback((num: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num).catch(() => {})
      setAuthNotice(`Kode antrean ${num} berhasil disalin ke clipboard.`)
    }
  }, [])

  const lookupOrder = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
  }, [lookupOrderNumber, lookupName])

  const recoverOrder = useCallback((event: FormEvent<HTMLFormElement>) => {
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
  }, [recoveryPhone, orders])

  const [completingOrderNumber, setCompletingOrderNumber] = useState<string | null>(null)

  const handleCompleteOrder = useCallback(async (orderNumber: string, customerName?: string) => {
    setCompletingOrderNumber(orderNumber)
    try {
      const res = await completeCustomerOrder(orderNumber, deviceToken, customerName)
      setAuthNotice(res.message || 'Pesanan berhasil diselesaikan. Terima kasih!')
      await fetchOrders()
      setLookupResult((prev) => {
        if (prev && prev.order_number === orderNumber) {
          return { ...prev, order_status: 'SELESAI' }
        }
        return prev
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Pesanan belum dapat diselesaikan.')
    } finally {
      setCompletingOrderNumber(null)
    }
  }, [deviceToken, fetchOrders])

  const value = useMemo(
    () => ({
      screen,
      moveTo,
      deviceToken,
      guestName,
      setGuestName,
      member,
      isMember,
      sessionMode,
      isOrderingSession,
      activeOrderingSession,
      hasEntered,
      signOutMember,
      handleConfirmGuestName,
      resetGuestSession,
      handleResetGuestSession,
      startOrdering,
      chooseMember,
      authName,
      setAuthName,
      authEmail,
      setAuthEmail,
      authPhone,
      setAuthPhone,
      authPassword,
      setAuthPassword,
      authConfirm,
      setAuthConfirm,
      authError,
      setAuthError,
      authNotice,
      setAuthNotice,
      submitLogin,
      submitRegister,
      passwordResetNotice,
      menu,
      bundles,
      categories,
      banners,
      loading,
      loadError,
      category,
      setCategory,
      query,
      setQuery,
      filtered,
      cart,
      lines,
      itemCount,
      subtotal,
      finalTotal,
      dispatch,
      cartOpen,
      setCartOpen,
      closeCartAndNavigate,
      cartToast,
      setCartToast,
      showCartToast,
      checkoutName,
      setCheckoutName,
      checkoutPhone,
      setCheckoutPhone,
      checkoutError,
      setCheckoutError,
      submitting,
      paymentMethod,
      setPaymentMethod,
      submitOrder,
      promoCode,
      setPromoCode,
      appliedPromo,
      promoDiscount,
      promoMessage,
      checkingPromo,
      handleApplyPromo,
      handleRemovePromo,
      loyaltySettings,
      usePoints,
      pointsToRedeem,
      setPointsToRedeem,
      pointsDiscount,
      handleToggleUsePoints,
      orders,
      isRefreshingOrders,
      fetchOrders,
      completingOrderNumber,
      handleCompleteOrder,
      triggerSnapPayment,
      copyOrderNumber,
      guestOfferOpen,
      setGuestOfferOpen,
      lookupOrderNumber,
      setLookupOrderNumber,
      lookupName,
      setLookupName,
      lookupError,
      lookupBusy,
      lookupResult,
      setLookupResult,
      lookupOrder,
      recoveryPhone,
      setRecoveryPhone,
      recoveryError,
      recoveredOrder,
      recoverOrder,
    }),
    [
      screen,
      moveTo,
      deviceToken,
      guestName,
      member,
      isMember,
      sessionMode,
      isOrderingSession,
      activeOrderingSession,
      hasEntered,
      signOutMember,
      handleConfirmGuestName,
      resetGuestSession,
      handleResetGuestSession,
      startOrdering,
      chooseMember,
      authName,
      authEmail,
      authPhone,
      authPassword,
      authConfirm,
      authError,
      authNotice,
      submitLogin,
      submitRegister,
      passwordResetNotice,
      menu,
      bundles,
      categories,
      banners,
      loading,
      loadError,
      category,
      query,
      filtered,
      cart,
      lines,
      itemCount,
      subtotal,
      finalTotal,
      dispatch,
      cartOpen,
      setCartOpen,
      closeCartAndNavigate,
      cartToast,
      showCartToast,
      checkoutName,
      checkoutPhone,
      checkoutError,
      submitting,
      paymentMethod,
      submitOrder,
      promoCode,
      appliedPromo,
      promoDiscount,
      promoMessage,
      checkingPromo,
      handleApplyPromo,
      handleRemovePromo,
      loyaltySettings,
      usePoints,
      pointsToRedeem,
      pointsDiscount,
      handleToggleUsePoints,
      orders,
      isRefreshingOrders,
      fetchOrders,
      completingOrderNumber,
      handleCompleteOrder,
      triggerSnapPayment,
      copyOrderNumber,
      guestOfferOpen,
      setGuestOfferOpen,
      lookupOrderNumber,
      lookupName,
      lookupError,
      lookupBusy,
      lookupResult,
      setLookupResult,
      lookupOrder,
      recoveryPhone,
      recoveryError,
      recoveredOrder,
      recoverOrder,
    ],
  )

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

export function useCustomer() {
  const context = useContext(CustomerContext)
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider')
  }
  return context
}
