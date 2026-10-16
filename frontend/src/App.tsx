import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'
import { createCashOrder, getMenu, trackOrder } from './api'
import type { Product, TrackedOrder } from './types'
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
} from './prototypeState'

type Screen = 'landing' | 'identity' | 'login' | 'register' | 'member-home' | 'member-points' | 'order-menu' | 'orders' | 'tracking' | 'recovery'
type CartLine = { product: Product; quantity: number; note: string }
type CartAction =
  | { type: 'add'; product: Product }
  | { type: 'quantity'; id: number; quantity: number }
  | { type: 'note'; id: number; note: string }
  | { type: 'clear' }

function readCart(): Record<number, CartLine> {
  try { return JSON.parse(localStorage.getItem('satuang-cart') ?? '{}') as Record<number, CartLine> }
  catch { return {} }
}

function cartReducer(state: Record<number, CartLine>, action: CartAction) {
  if (action.type === 'clear') return {}
  if (action.type === 'add') {
    const previous = state[action.product.id]
    return { ...state, [action.product.id]: { product: action.product, quantity: (previous?.quantity ?? 0) + 1, note: previous?.note ?? '' } }
  }
  if (action.type === 'quantity') {
    if (action.quantity < 1) {
      const next = { ...state }
      delete next[action.id]
      return next
    }
    return { ...state, [action.id]: { ...state[action.id], quantity: action.quantity } }
  }
  return { ...state, [action.id]: { ...state[action.id], note: action.note } }
}

const rupiah = (value: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value))
const orderDateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
const statusLabel: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: 'Menunggu pembayaran', PESANAN_DITERIMA: 'Pesanan diterima',
  SEDANG_DIBUAT: 'Sedang dibuat', SIAP_DIAMBIL: 'Siap diambil', SELESAI: 'Selesai',
  MENUNGGU: 'Menunggu', BERHASIL: 'Terkonfirmasi', SIAP: 'Siap', DIPROSES: 'Sedang dibuat',
}

function startingScreen(session: PrototypeSession | null): Screen {
  if (session?.mode === 'member') return 'member-home'
  if (session?.mode === 'guest') {
    return readPrototypeOrders().some((order) => order.mode === 'guest' && order.guestToken === session.token) ? 'orders' : 'order-menu'
  }
  return 'landing'
}

function App() {
  const [menu, setMenu] = useState<Product[]>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string; slug: string }>>([])
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
  const [session, setSession] = useState<PrototypeSession | null>(() => readPrototypeSession())
  const [members, setMembers] = useState<PrototypeMember[]>(() => readPrototypeMembers())
  const [orders, setOrders] = useState<PrototypeOrder[]>(() => readPrototypeOrders())
  const [screen, setScreen] = useState<Screen>(() => startingScreen(readPrototypeSession()))
  const [tracked, setTracked] = useState<Record<string, TrackedOrder['order']>>({})
  const [trackingOrder, setTrackingOrder] = useState('')
  const [trackError, setTrackError] = useState('')
  const [lookupOrderNumber, setLookupOrderNumber] = useState('')
  const [lookupName, setLookupName] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupResult, setLookupResult] = useState<TrackedOrder['order'] | null>(null)
  const [recoveryPhone, setRecoveryPhone] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveredOrder, setRecoveredOrder] = useState<PrototypeOrder | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authConfirm, setAuthConfirm] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const idempotencyKey = useRef(crypto.randomUUID())

  const currentMember = session?.mode === 'member' ? members.find((member) => member.email === session.email) ?? null : null
  const currentOrders = useMemo(() => {
    if (session?.mode === 'member') return orders.filter((order) => order.mode === 'member' && order.memberEmail === session.email)
    if (session?.mode === 'guest') return orders.filter((order) => order.mode === 'guest' && order.guestToken === session.token)
    return []
  }, [orders, session])
  const lines = Object.values(cart)
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0)
  const filtered = useMemo(() => menu.filter((product) => {
    const inCategory = category === 'semua' || product.category?.slug === category
    const matches = `${product.name} ${product.description ?? ''}`.toLowerCase().includes(query.toLowerCase())
    return inCategory && matches
  }), [menu, category, query])

  useEffect(() => { localStorage.setItem('satuang-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => {
    getMenu().then((data) => { setMenu(data.products); setCategories(data.categories) })
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
    else if (session?.mode === 'guest') moveTo(currentOrders.length ? 'orders' : 'order-menu')
    else moveTo('identity')
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
    if (!email.includes('@')) return setAuthError('Masukkan alamat email yang valid.')
    if (authPassword.length < 8) return setAuthError('Kata sandi minimal 8 karakter.')
    if (authPassword !== authConfirm) return setAuthError('Konfirmasi kata sandi belum cocok.')
    if (members.some((member) => member.email === email)) return setAuthError('Email ini sudah terdaftar. Silakan masuk.')
    try {
      const credential = await hashPrototypePassword(authPassword)
      const member: PrototypeMember = { id: crypto.randomUUID(), name: authName.trim(), email, points: 0, passwordSalt: credential.salt, passwordHash: credential.hash }
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
    if (!email.includes('@') || !authPassword) return setAuthError('Masukkan email dan kata sandi.')
    const member = members.find((item) => item.email === email)
    if (!member) return setAuthError('Akun belum ditemukan. Silakan daftar Member terlebih dahulu.')
    if (!member.passwordSalt || !member.passwordHash) return setAuthError('Akun ini belum memiliki kata sandi. Silakan daftar Member terlebih dahulu.')
    try {
      if (!await verifyPrototypePassword(authPassword, member)) return setAuthError('Kata sandi tidak cocok.')
    } catch {
      return setAuthError('Login belum dapat diselesaikan. Silakan coba lagi.')
    }
    const nextSession: PrototypeSession = { mode: 'member', email: member.email }
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
    if (session?.mode === 'member' && !currentMember) return setCheckoutError('Sesi Member tidak ditemukan. Silakan masuk kembali.')
    setSubmitting(true)
    try {
      const result = await createCashOrder({
        customer_name: session?.mode === 'member' && currentMember ? currentMember.name.trim() : checkoutName.trim(),
        ...(session?.mode === 'guest' && checkoutPhone.trim() ? { customer_phone: checkoutPhone.trim() } : {}),
        payment_method: 'cash',
        items: lines.map(({ product, quantity, note }) => ({ product_id: product.id, quantity, ...(note ? { special_instructions: note } : {}) })),
      }, idempotencyKey.current)
      const snapshot: PrototypeOrder = {
        orderNumber: result.order.order_number,
        customerName: result.order.customer_name,
        customerPhone: session?.mode === 'guest' ? checkoutPhone.trim() || null : null,
        total: result.order.total,
        createdAt: result.order.created_at,
        orderStatus: result.order.order_status,
        paymentStatus: result.order.payment_status,
        mode: session?.mode ?? 'guest',
        ...(session?.mode === 'guest' ? { guestToken: session.token } : {}),
        ...(session?.mode === 'member' ? { memberEmail: session.email } : {}),
        items: lines.map(({ product, quantity }) => ({ name: product.name, itemType: product.item_type, quantity, price: product.price })) as PrototypeOrderItem[],
      }
      savePrototypeOrder(snapshot)
      setOrders(readPrototypeOrders())
      dispatch({ type: 'clear' })
      idempotencyKey.current = crypto.randomUUID()
      setCheckoutName(currentMember?.name ?? '')
      setCheckoutPhone('')
      setCartOpen(false)
      moveTo('orders')
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Pesanan belum dapat dibuat.')
    } finally { setSubmitting(false) }
  }

  async function refreshOrder(order: PrototypeOrder) {
    setTrackingOrder(order.orderNumber)
    setTrackError('')
    try {
      const result = await trackOrder(order.orderNumber, order.customerName)
      setTracked((previous) => ({ ...previous, [order.orderNumber]: result.order }))
      const updated = { ...order, orderStatus: result.order.order_status, paymentStatus: result.order.payment_status }
      replacePrototypeOrder(updated)
      setOrders(readPrototypeOrders())
    } catch (error) {
      setTrackError(error instanceof Error ? error.message : 'Status pesanan belum dapat diperbarui.')
    } finally { setTrackingOrder('') }
  }

  async function lookupOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLookupError('')
    setLookupResult(null)
    setLookupBusy(true)
    try {
      const result = await trackOrder(lookupOrderNumber.trim(), lookupName.trim())
      setLookupResult(result.order)
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Pesanan belum ditemukan atau data belum cocok.')
    } finally {
      setLookupBusy(false)
    }
  }

  function recoverOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecoveryError('')
    setRecoveredOrder(null)
    const match = orders.find((order) => order.customerPhone && order.customerPhone.replace(/\D/g, '') === recoveryPhone.replace(/\D/g, ''))
    if (!match) return setRecoveryError('Tidak ditemukan pesanan dengan nomor HP tersebut pada perangkat ini.')
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
  const sessionMode: CustomerMode | null = session?.mode ?? null

  return <div className="app-shell customer-app">
    <header className={`site-header customer-header ${isMember ? 'member-header' : ''}`}>
      <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); moveTo('landing') }} aria-label="SA.TUANG COFFEE beranda">
        <span className="brand-mark">S</span><span className="brand-copy"><strong>SA.TUANG</strong><small>COFFEE · BANJAR WIJAYA</small></span>
      </a>
      {screen === 'landing' ? <nav className="desktop-nav" aria-label="Navigasi utama">
        <a className="nav-link" href="#about">Tentang</a><a className="nav-link" href="#menu-preview">Menu</a><a className="nav-link" href="#location">Lokasi</a><button className="nav-link" onClick={() => moveTo('tracking')}>Lacak Pesanan</button>
      </nav> : isMember ? <nav className="desktop-nav" aria-label="Navigasi Member">
        <button className="nav-link" onClick={() => { moveTo('member-home') }}>Dashboard</button>
        <button className="nav-link" onClick={() => moveTo('order-menu')}>Pesan menu</button>
        <button className="nav-link" onClick={() => moveTo('orders')}>Pesanan saya</button>
        <button className="nav-link" onClick={() => moveTo('tracking')}>Lacak Pesanan</button>
        <button className="nav-link" onClick={() => moveTo('member-points')}>Poin</button>
      </nav> : <nav className="desktop-nav" aria-label="Navigasi pemesanan">
        <button className="nav-link" onClick={() => moveTo('landing')}>Beranda</button>
        <button className="nav-link" onClick={() => moveTo('tracking')}>Lacak Pesanan</button>
        {sessionMode === 'guest' && <button className="nav-link" onClick={() => moveTo('orders')}>Pesanan saya</button>}
        {sessionMode === 'guest' && <button className="nav-link" onClick={() => moveTo('identity')}>Ganti cara pesan</button>}
        {screen === 'identity' && <button className="nav-link" onClick={() => moveTo('recovery')}>Lupa kode antrean?</button>}
      </nav>}
      {screen === 'landing' ? <button className="button button-accent header-order-button" onClick={startOrdering}>Pesan Sekarang <span>↗</span></button> : screen === 'order-menu' ? <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Buka keranjang, ${itemCount} item`}><span aria-hidden="true">▱</span><span className="cart-label">Keranjang</span><b className="cart-count">{itemCount}</b></button> : isMember ? <button className="account-chip" onClick={signOutMember}>Keluar</button> : sessionMode === 'guest' ? <button className="account-chip" onClick={() => moveTo('orders')}>Guest · Pesanan</button> : <button className="account-chip" onClick={startOrdering}>Pesan Sekarang</button>}
      <nav className="mobile-nav" aria-label="Navigasi ponsel">
        {screen === 'landing' ? <><a className="mobile-nav-link" href="#about">Tentang</a><a className="mobile-nav-link" href="#location">Lokasi</a><button className="mobile-nav-link" onClick={() => moveTo('tracking')}>Lacak Pesanan</button><button className="mobile-nav-link active" onClick={startOrdering}>Pesan Sekarang</button></> : isMember ? <><button className="mobile-nav-link" onClick={() => moveTo('member-home')}>Beranda Member</button><button className="mobile-nav-link" onClick={() => moveTo('order-menu')}>Menu</button><button className="mobile-nav-link" onClick={() => moveTo('orders')}>Pesanan</button><button className="mobile-nav-link" onClick={() => moveTo('tracking')}>Lacak Pesanan</button><button className="mobile-nav-link" onClick={() => moveTo('member-points')}>Poin</button></> : <><button className="mobile-nav-link" onClick={() => moveTo('landing')}>Beranda</button><button className="mobile-nav-link" onClick={() => moveTo('tracking')}>Lacak Pesanan</button>{sessionMode === 'guest' && <button className="mobile-nav-link" onClick={() => moveTo('orders')}>Pesanan Saya</button>}{sessionMode === 'guest' && <button className="mobile-nav-link" onClick={() => moveTo('order-menu')}>Menu</button>}</>}
      </nav>
    </header>

    <main id="top">
      {screen === 'landing' && <section className="landing-page">
      <div className="landing-hero">
      <div className="landing-copy"><span className="eyebrow"><i /> BANJAR WIJAYA · TANGERANG</span><h1>Satu tuang,<br /><em>satu jeda.</em></h1><p>Ruang singgah untuk menikmati kopi, makanan, dan waktu bersama. Temukan suasana SA.TUANG COFFEE Banjar Wijaya.</p><div className="landing-actions"><button className="button button-accent" onClick={startOrdering}>Pesan Sekarang <span>↗</span></button><button className="button button-outline landing-track-button" onClick={() => moveTo('tracking')}>Lacak Pesanan <span>⌕</span></button><a className="button button-outline" href="#about">Kenali SA.TUANG <span>↓</span></a></div><div className="landing-meta"><span>SA.TUANG COFFEE</span><span>INDUSTRIAL · OUTDOOR · EVERYDAY</span></div></div>
      <div className="landing-art" role="img" aria-label="Ilustrasi kopi dalam suasana industrial"><span className="art-label">ONE<br />POUR</span><div className="landing-sun"/><div className="landing-cup"><span>✳</span></div><span className="art-caption">BREWED FOR A LITTLE PAUSE</span><span className="art-side">BANJAR WIJAYA · TANGERANG</span></div>
      </div>
      <section id="about" className="landing-about"><div className="section-kicker">01 — TENTANG KAMI</div><div><h2>Ruang untuk<br /><em>berhenti sebentar.</em></h2><p>SA.TUANG menghadirkan kopi dan sajian untuk menemani jeda—dengan suasana industrial dan area terbuka di Banjar Wijaya. Datang untuk secangkir kopi, tinggal untuk kebersamaan.</p><p className="small-copy">“Sa.Tuang” dimaknai sebagai “One Pour”—satu tuang yang membuka ruang untuk menikmati momen.</p></div></section>
      <section id="menu-preview" className="landing-menu"><div className="landing-menu-head"><div><span className="eyebrow light">DARI BAR KAMI</span><h2>Kenali menu pilihan<span className="accent-dot">.</span></h2><p>Jelajahi sajian sebelum memulai pemesanan.</p></div><button className="button button-outline-light" onClick={startOrdering}>Lihat menu pemesanan <span>↗</span></button></div>
      {loading ? <div className="notice">Menyiapkan pilihan menu…</div> : loadError ? <div className="notice error">Menu belum dapat dimuat. {loadError}</div> : <div className="landing-menu-grid">{menu.slice(0, 3).map((product, index) => <article className="preview-card" key={product.id}><div className={`preview-visual visual-${index % 6}`}><span>{product.item_type === 'drink' ? '☕' : '🥐'}</span></div><div className="preview-info"><small>{product.category?.name ?? 'Menu'}</small><h3>{product.name}</h3><p>{product.description || 'Sajian dari SA.TUANG COFFEE.'}</p></div></article>)}</div>}
      </section>
      <section id="location" className="landing-location"><div><span className="eyebrow">KUNJUNGI KAMI</span><h2>SA.TUANG COFFEE<br /><em>Banjar Wijaya</em></h2><p>Jl. Wijaya Kusuma, Banjar Wijaya, Cipondoh, Kota Tangerang</p><div className="location-actions"><a className="button button-dark" href="https://maps.google.com/?q=SA.TUANG+COFFEE+Banjar+Wijaya" target="_blank" rel="noreferrer">Buka peta <span>↗</span></a><a className="text-link" href="https://www.instagram.com/sa.tuangcoffee/" target="_blank" rel="noreferrer">Instagram @sa.tuangcoffee</a></div></div><div className="location-note"><span>SA.TUANG</span><strong>Banjar Wijaya<br />Tangerang</strong><small>Ruang kopi, jeda, dan cerita.</small></div></section>
      <section className="landing-last-cta"><span className="eyebrow light">SIAP MENIKMATI JEDA?</span><h2>Pilih cara memesan<br />yang paling nyaman.</h2><button className="button button-accent" onClick={startOrdering}>Pesan Sekarang <span>↗</span></button></section>
      </section>}
      
      {screen === 'tracking' && <section className="tracking-page"><div className="flow-heading"><span className="eyebrow">LACAK PESANAN · TANPA LOGIN</span><h1>Temukan status<br /><em>pesananmu.</em></h1><p>Masukkan kode antrean dan nama yang tercantum saat checkout. Pencarian ini tidak memerlukan sesi Guest di browser.</p></div><form className="customer-form tracking-form" onSubmit={lookupOrder}><label>Kode antrean<input autoComplete="off" required maxLength={64} value={lookupOrderNumber} onChange={(event) => setLookupOrderNumber(event.target.value)} placeholder="Contoh: ST-XXXXXXXX" /></label><label>Nama pada pesanan<input autoComplete="name" required maxLength={160} value={lookupName} onChange={(event) => setLookupName(event.target.value)} placeholder="Nama yang digunakan saat checkout" /></label><p className="field-help">Kode antrean diperlukan untuk mencari pesanan. Jika lupa kodenya, pilih pemulihan nomor HP; pemulihan melalui nomor HP hanya mencakup riwayat pada perangkat ini.</p>{lookupError && <p className="form-error" role="alert">{lookupError}</p>}<button className="button button-dark full" disabled={lookupBusy}>{lookupBusy ? 'Mencari pesanan…' : 'Lacak Pesanan'}</button><button className="text-button" type="button" onClick={() => moveTo('recovery')}>Lupa kode antrean?</button></form>{lookupResult && <article className="tracking-result"><div className="tracking-result-head"><div><span className="eyebrow">KODE ANTREAN</span><strong>{lookupResult.order_number}</strong><small>{orderDateFormatter.format(Date.parse(lookupResult.created_at))}</small></div><span className={`status-pill ${lookupResult.order_status === 'SELESAI' ? 'success' : ''}`}>{statusLabel[lookupResult.order_status] ?? lookupResult.order_status}</span></div><p className="tracking-payment">Pembayaran · {statusLabel[lookupResult.payment_status] ?? lookupResult.payment_status}</p><div className="tracking-items">{lookupResult.items.map((item, index) => <div className="tracking-item" key={`${lookupResult.order_number}-${index}`}><span>{item.quantity}× {item.name}</span><span>{statusLabel[item.preparation_status] ?? item.preparation_status}</span></div>)}</div></article>}<button className="back-link" onClick={() => moveTo('landing')}>← Kembali ke beranda</button></section>}
      
      {screen === 'identity' && <section className="flow-page"><div className="flow-heading"><span className="eyebrow">LANGKAH 01 — PILIH CARA MEMESAN</span><h1>Selamat datang<br /><em>di SA.TUANG.</em></h1><p>Pilih pengalaman yang sesuai. Member mendapat akses ke akun dan fitur loyalitas.</p></div><div className="identity-grid"><article className="identity-card member-choice"><div className="choice-mark">M</div><span className="eyebrow">PUNYA AKUN MEMBER?</span><h2>Masuk sebagai<br />Member</h2><p>Lihat riwayat pesanan dan poin loyalitas dalam satu tempat.</p><div className="choice-actions"><button className="button button-dark full" onClick={chooseMember}>Masuk Member</button><button className="text-button" onClick={() => moveTo('register')}>Daftar Member</button></div></article><article className="identity-card guest-choice"><div className="choice-mark guest-mark">G</div><span className="eyebrow">BELUM PUNYA AKUN?</span><h2>Pesan sebagai<br />Guest</h2><p>Tidak perlu membuat akun. Jika berubah pikiran, kamu bisa daftar Member sebelum melanjutkan.</p><button className="button button-accent full" onClick={() => setGuestOfferOpen(true)}>Pilih Guest <span>↗</span></button></article></div><button className="back-link" onClick={() => moveTo('landing')}>← Kembali ke informasi SA.TUANG</button><button className="text-button recovery-entry" onClick={() => moveTo('recovery')}>Lupa kode antrean?</button></section>}
      
      {(screen === 'login' || screen === 'register') && <section className="auth-page"><div className="auth-aside"><span className="eyebrow">SA.TUANG MEMBER</span><h1>{screen === 'login' ? 'Senang melihatmu kembali.' : 'Mulai jadi bagian dari SA.TUANG.'}</h1><p>{screen === 'login' ? 'Masuk untuk melihat profil, pesanan, dan poin loyalitasmu.' : 'Buat akun Member untuk menyimpan riwayat dan menikmati fitur loyalitas.'}</p><div className="auth-points"><span>01</span><span>Riwayat pesanan tersimpan</span><span>02</span><span>Informasi poin Member</span></div></div><form className="customer-form auth-form" onSubmit={screen === 'login' ? submitLogin : submitRegister}><div className="form-title"><span className="eyebrow">{screen === 'login' ? 'MASUK MEMBER' : 'DAFTAR MEMBER'}</span><h2>{screen === 'login' ? 'Masuk' : 'Buat akun'}</h2></div>{screen === 'register' && <label>Nama lengkap<input autoComplete="name" required maxLength={120} value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Nama kamu" /></label>}<label>Email<input autoComplete="email" type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="nama@email.com" /></label><label>Kata sandi<input autoComplete={screen === 'login' ? 'current-password' : 'new-password'} type="password" minLength={screen === 'register' ? 8 : 1} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Minimal 8 karakter" /></label>{screen === 'register' && <label>Ulangi kata sandi<input autoComplete="new-password" type="password" minLength={8} required value={authConfirm} onChange={(event) => setAuthConfirm(event.target.value)} placeholder="Ulangi kata sandi" /></label>}{authError && <p className="form-error" role="alert">{authError}</p>}{authNotice && <p className="form-notice" role="status">{authNotice}</p>}<button className="button button-accent full" type="submit">{screen === 'login' ? 'Masuk ke akun' : 'Daftar Member'}</button>{screen === 'login' && <button className="text-button" type="button" onClick={passwordResetNotice}>Lupa kata sandi?</button>}<p className="auth-switch">{screen === 'login' ? 'Belum menjadi Member?' : 'Sudah punya akun?'} <button className="text-button inline-button" type="button" onClick={() => { setAuthError(''); setAuthNotice(''); moveTo(screen === 'login' ? 'register' : 'login') }}>{screen === 'login' ? 'Daftar' : 'Masuk'}</button></p><button className="back-link" type="button" onClick={() => moveTo('identity')}>← Kembali pilih Guest atau Member</button></form></section>}
      
      {screen === 'member-home' && isMember && currentMember && <section className="member-page"><div className="member-welcome"><div><span className="eyebrow">RUANG MEMBER</span><h1>Halo, {currentMember.name.split(' ')[0]}.</h1><p>Pesanan dan poin loyalitasmu, tersimpan di satu tempat.</p></div><div className="member-badge">SA.TUANG<br /><small>MEMBER</small></div></div><div className="member-dashboard-grid"><article className="points-card"><div className="points-card-head"><span className="eyebrow light">SALDO POIN</span></div><strong>{currentMember.points.toLocaleString('id-ID')}<small> poin</small></strong><p>Poin diperoleh setelah pesanan selesai. Aturan penukaran nominal akan diatur Admin.</p><button className="button button-outline-light" onClick={() => moveTo('member-points')}>Lihat detail poin <span>↗</span></button></article><article className="member-action-card"><span className="eyebrow">MULAI PESAN</span><h2>Temukan teman jedamu.</h2><p>Pilih menu, lihat ringkasan, lalu pesan untuk diambil di Banjar Wijaya.</p><button className="button button-accent" onClick={() => moveTo('order-menu')}>Lihat menu <span>↗</span></button></article><article className="member-history-card"><div><span className="eyebrow">AKUN MEMBER</span><h2>Pesanan dan akunmu</h2><p>{currentOrders.length ? `${currentOrders.length} pesanan tersimpan` : 'Pesanan yang kamu buat akan tersimpan di sini.'}</p></div><div className="member-history-actions"><button className="button button-dark" onClick={() => moveTo('orders')}>Pesanan saya</button><span>{currentMember.email}</span></div></article></div></section>}
      
      {screen === 'member-points' && isMember && currentMember && <section className="points-page"><div className="flow-heading"><span className="eyebrow">AREA MEMBER · POIN LOYALITAS</span><h1>Poin yang<br /><em>terkumpul.</em></h1><p>Pantau perolehan dan penggunaan poin loyalitasmu di sini.</p></div><article className="points-summary"><span className="eyebrow">SALDO POIN SAAT INI</span><strong>{currentMember.points.toLocaleString('id-ID')} poin</strong><p>Poin baru diberikan setelah pesanan berstatus SELESAI. Penukaran poin menjadi potongan nominal menunggu aturan Admin.</p><div className="points-empty"><span>✳</span><div><b>Belum ada riwayat poin</b><small>Riwayat perolehan, pemakaian, dan pengembalian akan mengikuti ledger setelah integrasi.</small></div></div></article><button className="back-link" onClick={() => { moveTo('member-home') }}>← Kembali ke Dashboard Member</button></section>}
      
      {screen === 'order-menu' && <section className="catalogue-page"><div className="catalogue-heading"><div><span className="eyebrow">{sessionMode === 'member' ? 'PEMESANAN MEMBER' : 'PEMESANAN GUEST'} · BANJAR WIJAYA</span><h1>Pilih yang<br /><em>kamu suka.</em></h1><p>{sessionMode === 'member' ? 'Pesanan ini akan tersimpan di riwayat Member.' : 'Kamu memesan tanpa akun. Riwayat pesanan tersimpan di browser ini.'}</p></div><div className="catalogue-actions">{sessionMode === 'guest' && <button className="text-button" onClick={() => setGuestOfferOpen(true)}>Daftar Member</button>}<button className="button button-dark" onClick={() => setCartOpen(true)}>Keranjang ({itemCount}) <span>↗</span></button></div></div><section className="menu-section order-menu-section"><div className="section-heading"><div><span className="eyebrow light">DARI BAR KAMI</span><h2>Menu pilihan<span className="accent-dot">.</span></h2><p>Tambahkan menu ke keranjang untuk memesan.</p></div><label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari minuman atau makanan" aria-label="Cari menu" /></label></div><div className="category-row" aria-label="Filter kategori"><button className={category === 'semua' ? 'category-chip selected' : 'category-chip'} onClick={() => setCategory('semua')}>Semua menu</button>{categories.map((item) => <button key={item.id} className={category === item.slug ? 'category-chip selected' : 'category-chip'} onClick={() => setCategory(item.slug)}>{item.name}</button>)}</div>{loading ? <div className="notice">Menyiapkan daftar menu…</div> : loadError ? <div className="notice error"><strong>Menu belum bisa dimuat.</strong><span>{loadError}</span><button className="text-button" onClick={() => location.reload()}>Coba lagi</button></div> : filtered.length ? <div className="product-grid">{filtered.map((product, index) => <article className="product-card" key={product.id}><div className={`product-visual visual-${index % 6}`}><span className="visual-tag">{product.item_type === 'drink' ? 'DIBUAT FRESH' : 'TEMAN NGOPI'}</span><span className="product-emoji" aria-hidden="true">{product.item_type === 'drink' ? (product.name.toLowerCase().includes('matcha') ? '🍵' : '☕') : '🥐'}</span><span className="visual-number">S/0{index + 1}</span></div><div className="product-info"><div className="product-category">{product.category?.name ?? (product.item_type === 'drink' ? 'Minuman' : 'Makanan')}</div><h3>{product.name}</h3><p>{product.description || 'Diracik untuk dinikmati kapan saja.'}</p><div className="product-buy"><strong>{rupiah(product.price)}</strong><button className="add-button" disabled={!product.is_available} onClick={() => dispatch({ type: 'add', product })} aria-label={`Tambah ${product.name} ke keranjang`}>{product.is_available ? '+' : 'Habis'}</button></div></div></article>)}</div> : <div className="notice">Menu belum tersedia di kategori ini.</div>}<p className="menu-footnote">Harga dan ketersediaan divalidasi kembali sebelum pesanan dibuat.</p></section></section>}
      
      {screen === 'orders' && <section className={`orders-page ${isMember ? 'member-orders-page' : 'guest-orders-page'}`}><div className="orders-heading"><div><span className="eyebrow">{isMember ? 'AREA MEMBER' : 'AREA GUEST'} · PESANAN TERSIMPAN</span><h1>{isMember ? 'Pesanan Member.' : 'Pesanan saya.'}</h1><p>{isMember ? 'Riwayat pesanan yang tertaut ke akun Member ini.' : 'Pesananmu akan tetap muncul di browser ini setelah halaman di-refresh.'}</p></div><button className="button button-accent" onClick={() => moveTo('order-menu')}>Pesan lagi <span>↗</span></button></div>{trackError && <p className="form-error" role="alert">{trackError}</p>}{authNotice && <p className="form-notice" role="status">{authNotice}</p>}{currentOrders.length ? <div className="orders-list">{currentOrders.map((order) => { const live = tracked[order.orderNumber]; const orderStatus = live?.order_status ?? order.orderStatus; const paymentStatus = live?.payment_status ?? order.paymentStatus; return <article className="saved-order-card" key={order.orderNumber}><div className="saved-order-top"><div><span className="eyebrow">KODE ANTREAN</span><strong className="saved-order-number">{order.orderNumber}</strong><small>{orderDateFormatter.format(Date.parse(order.createdAt))}</small></div><span className={`status-pill ${orderStatus === 'SELESAI' ? 'success' : ''}`}>{statusLabel[orderStatus] ?? orderStatus}</span></div><div className="saved-order-items">{order.items.map((item, index) => <div className="saved-order-item" key={`${order.orderNumber}-${index}`}><span>{item.quantity}× {item.name}</span><span>{rupiah(Number(item.price) * item.quantity)}</span></div>)}</div><div className="saved-order-total"><span>Total · {statusLabel[paymentStatus] ?? paymentStatus}</span><strong>{rupiah(order.total)}</strong></div><div className="saved-order-actions"><button className="button button-outline" onClick={() => copyOrderNumber(order.orderNumber)}>Salin kode</button><button className="button button-dark" disabled={trackingOrder === order.orderNumber} onClick={() => refreshOrder(order)}>{trackingOrder === order.orderNumber ? 'Memperbarui…' : 'Perbarui status'}</button></div></article>})}</div> : <div className="empty-orders"><span>☕</span><h2>Belum ada pesanan tersimpan</h2><p>Setelah kamu membuat pesanan, kode antrean dan statusnya akan muncul di sini.</p><button className="button button-accent" onClick={() => moveTo('order-menu')}>Mulai pesan <span>↗</span></button></div>}{sessionMode === 'guest' && <div className="guest-recovery-inline"><span className="eyebrow">TIDAK MENEMUKAN KODE?</span><p>Jika memasukkan nomor HP saat checkout, gunakan nomor yang sama untuk mencari pesanan.</p><button className="text-button" onClick={() => moveTo('recovery')}>Lupa kode antrean?</button></div>}</section>}
      
      {screen === 'recovery' && <section className="recovery-page"><div className="flow-heading"><span className="eyebrow">PEMULIHAN KODE ANTREAN</span><h1>Temukan kode<br /><em>pesananmu.</em></h1><p>Masukkan nomor HP yang dicantumkan saat checkout. Pencarian mencakup pesanan yang tersimpan pada perangkat ini.</p></div><form className="customer-form recovery-form" onSubmit={recoverOrder}><label>Nomor HP<input type="tel" inputMode="tel" required value={recoveryPhone} onChange={(event) => setRecoveryPhone(event.target.value)} placeholder="Nomor HP yang digunakan" /></label><p className="field-help">Riwayat yang tersimpan pada perangkat ini dapat dicari di sini. Untuk bantuan pada perangkat lain, hubungi outlet.</p>{recoveryError && <p className="form-error" role="alert">{recoveryError}</p>}<button className="button button-dark full">Cari pesanan</button>{recoveredOrder && <div className="recovered-order"><span className="eyebrow">KODE ANTREAN DITEMUKAN</span><strong>{recoveredOrder.orderNumber}</strong><span>{recoveredOrder.customerName} · {statusLabel[recoveredOrder.orderStatus] ?? recoveredOrder.orderStatus}</span><button type="button" className="button button-outline" onClick={() => { setLookupOrderNumber(recoveredOrder.orderNumber); setLookupName(recoveredOrder.customerName); setLookupResult(null); moveTo('tracking') }}>Lacak pesanan ini</button></div>}<button type="button" className="back-link" onClick={() => moveTo(sessionMode === 'member' ? 'member-home' : 'tracking')}>← Kembali</button></form></section>}
    </main>

    {screen === 'landing' && <footer className="site-footer customer-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark">S</span><span className="brand-copy"><strong>SA.TUANG</strong><small>COFFEE · BANJAR WIJAYA</small></span></a><span>Ruang untuk berhenti sebentar.</span><small>© SA.TUANG COFFEE</small></footer>}
    {screen !== 'landing' && <footer className="customer-footer-simple"><button onClick={() => moveTo('landing')}>SA.TUANG COFFEE · Informasi outlet</button><span>© SA.TUANG COFFEE · BANJAR WIJAYA</span></footer>}

    {guestOfferOpen && <div className="overlay choice-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGuestOfferOpen(false) }}><section className="choice-modal" role="dialog" aria-modal="true" aria-labelledby="guest-offer-title"><button className="close-button" onClick={() => setGuestOfferOpen(false)} aria-label="Tutup pilihan">×</button><span className="eyebrow">SEBELUM MELANJUTKAN</span><h2 id="guest-offer-title">Ingin bergabung<br /><em>jadi Member?</em></h2><p>Member memiliki area akun, riwayat, dan fitur poin. Kamu tetap bisa memesan tanpa akun.</p><div className="choice-modal-actions"><button className="button button-outline full" onClick={() => { setGuestOfferOpen(false); moveTo('register') }}>Daftar Member</button><button className="button button-accent full" onClick={chooseGuest}>Tidak, lanjut sebagai Guest</button></div></section></div>}

    {cartOpen && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><aside className="cart-panel" role="dialog" aria-modal="true" aria-label="Keranjang belanja"><div className="panel-head"><div><span className="eyebrow">{sessionMode === 'member' ? 'PESANAN MEMBER' : 'PESANAN GUEST'}</span><h2>Keranjang <span className="accent-dot">({itemCount})</span></h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang">×</button></div>{lines.length === 0 ? <div className="empty-cart"><span>☕</span><h3>Keranjangmu masih kosong</h3><p>Tambahkan menu yang ingin kamu nikmati.</p><button className="button button-dark" onClick={() => setCartOpen(false)}>Kembali ke menu</button></div> : <><div className="cart-lines">{lines.map(({ product, quantity, note }) => <div className="cart-line" key={product.id}><div className="cart-line-icon">{product.item_type === 'food' ? '🥐' : '☕'}</div><div className="cart-line-main"><strong>{product.name}</strong><span>{rupiah(product.price)}</span>{product.allow_notes && <input className="note-input" value={note} onChange={(event) => dispatch({ type: 'note', id: product.id, note: event.target.value })} placeholder="Catatan untuk barista (opsional)" />}</div><div className="quantity-control"><button onClick={() => dispatch({ type: 'quantity', id: product.id, quantity: quantity - 1 })} aria-label={`Kurangi ${product.name}`}>−</button><span>{quantity}</span><button onClick={() => dispatch({ type: 'quantity', id: product.id, quantity: quantity + 1 })} aria-label={`Tambah ${product.name}`}>+</button></div></div>)}</div><div className="cart-total"><span>Total sementara</span><strong>{rupiah(total)}</strong></div><form className="checkout-form" onSubmit={submitOrder}><label>Nama untuk pesanan<input required maxLength={160} value={sessionMode === 'member' ? currentMember?.name ?? '' : checkoutName} onChange={(event) => setCheckoutName(event.target.value)} placeholder="Nama kamu" readOnly={sessionMode === 'member'} /></label>{sessionMode === 'guest' && <label>Nomor HP <span className="optional-label">(opsional)</span><input type="tel" inputMode="tel" maxLength={32} value={checkoutPhone} onChange={(event) => setCheckoutPhone(event.target.value)} placeholder="08xxxxxxxxxx" /><small className="field-help">Mohon simpan kode antrean. Nomor HP dapat digunakan untuk memulihkan kode antrean.</small></label>}<fieldset><legend>Metode pembayaran</legend><label className="payment-choice selected"><input type="radio" checked readOnly /><span><b>Cash di kasir</b><small>Bayar setelah menunjukkan kode antrean</small></span><i>●</i></label><label className="payment-choice disabled"><input type="radio" disabled /><span><b>VA / QRIS</b><small>Belum tersedia — gateway belum dikonfigurasi</small></span><i>◌</i></label></fieldset>{checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}<button className="button button-accent full" disabled={submitting || !lines.length}>{submitting ? 'Mencatat pesanan…' : `Pesan sekarang · ${rupiah(total)}`}</button><p className="checkout-note">Harga dan ketersediaan akan divalidasi kembali sebelum pesanan dibuat. Data checkout masih menggunakan backend katalog prototipe.</p></form></>}</aside></div>}
  </div>
}

export default App
