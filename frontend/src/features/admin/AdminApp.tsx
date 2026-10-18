import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  createAdminBanner,
  createAdminBundle,
  createAdminCategory,
  createAdminProduct,
  createAdminPromotion,
  createAdminStaff,
  deleteAdminBanner,
  deleteAdminBundle,
  deleteAdminCategory,
  deleteAdminProduct,
  deleteAdminPromotion,
  getAdminAuditLogs,
  getAdminBanners,
  getAdminBundles,
  getAdminCategories,
  getAdminDashboard,
  getAdminOrders,
  getAdminProducts,
  getAdminPromotions,
  getAdminStaff,
  getCurrentStaff,
  loginStaff,
  logoutStaff,
  toggleAdminStaffStatus,
  updateAdminBanner,
  updateAdminBundle,
  updateAdminCategory,
  updateAdminProduct,
  updateAdminPromotion,
  updateAdminStaff,
  uploadAdminImage,
  type AdminAuditLog,
  type AdminBanner,
  type AdminBannerInput,
  type AdminBundle,
  type AdminBundleInput,
  type AdminCategory,
  type AdminCategoryInput,
  type AdminDashboard,
  type AdminItemType,
  type AdminProduct,
  type AdminProductInput,
  type AdminPromotion,
  type AdminPromotionInput,
  type AdminStaffInput,
  type AdminStaffUser,
  type StaffOrder,
  type StaffUser,
} from '../../api'
import { ImageAdjustModal } from './components/ImageAdjustModal'
import '../../styles/admin.css'

type AdminPage = 'dashboard' | 'products' | 'categories' | 'bundles' | 'promotions' | 'banners' | 'orders' | 'staff' | 'audit-logs'
type ProductDraft = Omit<AdminProductInput, 'price' | 'category_id' | 'description' | 'image_path'> & { price: string; category_id: string; description: string; image_path: string }
type CategoryDraft = { is_parent: boolean; parent_id: string; name: string; item_type: 'drink' | 'food'; description: string; sort_order: number; is_active: boolean }
type BundleDraft = {
  category_id: string
  name: string
  description: string
  price: string
  image_path: string
  is_active: boolean
  components: Array<{ product_id: number; quantity: number }>
}
type PromotionDraft = {
  code: string
  name: string
  description: string
  discount_type: 'fixed' | 'percent'
  discount_value: string
  min_spend: string
  max_discount: string
  is_active: boolean
}
type BannerDraft = {
  title: string
  subtitle: string
  image_path: string
  link_url: string
  sort_order: string
  is_active: boolean
}
type StaffDraft = {
  name: string
  email: string
  password: string
  role: 'admin' | 'cashier'
  is_active: boolean
}

const storedToken = typeof window !== 'undefined' && Boolean(window.localStorage.getItem('satuang-token'))
const currency = (value: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const dateTime = (value: string) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const statusNames: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: 'Menunggu pembayaran',
  PESANAN_DITERIMA: 'Pesanan diterima',
  SEDANG_DIBUAT: 'Sedang dibuat',
  SIAP_DIAMBIL: 'Siap diambil',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}
const itemNames: Record<AdminItemType, string> = { food: 'Makanan', drink: 'Minuman', other: 'Lainnya' }

const blankProduct = (): ProductDraft => ({ category_id: '', name: '', description: '', item_type: 'drink', price: '', image_path: '', allow_notes: false, is_available: true, is_active: true })
const blankCategory = (asParent = false, defaultParentId = ''): CategoryDraft => ({ is_parent: asParent, parent_id: defaultParentId, name: '', item_type: 'drink', description: '', sort_order: 0, is_active: true })
const blankBundle = (): BundleDraft => ({ category_id: '', name: '', description: '', price: '', image_path: '', is_active: true, components: [] })
const blankPromotion = (): PromotionDraft => ({ code: '', name: '', description: '', discount_type: 'percent', discount_value: '10', min_spend: '0', max_discount: '', is_active: true })
const blankBanner = (): BannerDraft => ({ title: '', subtitle: '', image_path: '', link_url: '', sort_order: '0', is_active: true })
const blankStaff = (): StaffDraft => ({ name: '', email: '', password: '', role: 'cashier', is_active: true })

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Permintaan belum dapat diproses. Silakan coba lagi.'
}

export default function AdminApp() {
  const [staff, setStaff] = useState<StaffUser | null>(null)
  const [sessionChecking, setSessionChecking] = useState(storedToken)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [page, setPage] = useState<AdminPage>('dashboard')

  // Datasets
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [bundles, setBundles] = useState<AdminBundle[]>([])
  const [promotions, setPromotions] = useState<AdminPromotion[]>([])
  const [banners, setBanners] = useState<AdminBanner[]>([])
  const [staffList, setStaffList] = useState<AdminStaffUser[]>([])
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])

  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<number | string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  // Modals & Editors
  const [productEditor, setProductEditor] = useState<AdminProduct | null | false>(false)
  const [productDraft, setProductDraft] = useState<ProductDraft>(blankProduct)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [imageTarget, setImageTarget] = useState<'product' | 'bundle' | 'banner'>('product')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const bundleFileInputRef = useRef<HTMLInputElement | null>(null)
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null)
  const [categoryEditor, setCategoryEditor] = useState<AdminCategory | null | false>(false)
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(blankCategory)
  const [bundleEditor, setBundleEditor] = useState<AdminBundle | null | false>(false)
  const [bundleDraft, setBundleDraft] = useState<BundleDraft>(blankBundle)
  const [promotionEditor, setPromotionEditor] = useState<AdminPromotion | null | false>(false)
  const [promotionDraft, setPromotionDraft] = useState<PromotionDraft>(blankPromotion)
  const [bannerEditor, setBannerEditor] = useState<AdminBanner | null | false>(false)
  const [bannerDraft, setBannerDraft] = useState<BannerDraft>(blankBanner)
  const [staffEditor, setStaffEditor] = useState<AdminStaffUser | null | false>(false)
  const [staffDraft, setStaffDraft] = useState<StaffDraft>(blankStaff)
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null)
  const [selectedAuditLog, setSelectedAuditLog] = useState<AdminAuditLog | null>(null)

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextDashboard, nextCategories, nextProducts] = await Promise.all([
        getAdminDashboard(),
        getAdminCategories(),
        getAdminProducts(),
      ])
      setDashboard(nextDashboard)
      setCategories(nextCategories.categories)
      setProducts(nextProducts.products)

      // Fetch on-demand or background based on page
      if (page === 'bundles') {
        const nextBundles = await getAdminBundles()
        setBundles(nextBundles.bundles)
      } else if (page === 'promotions') {
        const nextPromos = await getAdminPromotions()
        setPromotions(nextPromos.promotions)
      } else if (page === 'banners') {
        const nextBanners = await getAdminBanners()
        setBanners(nextBanners.banners)
      } else if (page === 'staff') {
        const nextStaff = await getAdminStaff()
        setStaffList(nextStaff.staff)
      } else if (page === 'orders') {
        const nextOrders = await getAdminOrders(search, orderStatusFilter)
        setOrders(nextOrders.orders)
      } else if (page === 'audit-logs') {
        const nextLogs = await getAdminAuditLogs()
        setAuditLogs(nextLogs.audit_logs)
      }
    } catch (loadError) {
      setError(errorText(loadError))
    } finally {
      setLoading(false)
    }
  }, [page, search, orderStatusFilter])

  useEffect(() => {
    if (!localStorage.getItem('satuang-token')) return
    let cancelled = false
    getCurrentStaff()
      .then((user) => {
        if (cancelled) return
        if (user.role !== 'admin') {
          setLoginError('Akun ini tidak memiliki akses Admin.')
          return
        }
        setStaff(user)
        void refreshData()
      })
      .catch(() => {
        localStorage.removeItem('satuang-token')
        localStorage.removeItem('satuang-staff')
      })
      .finally(() => {
        if (!cancelled) setSessionChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshData])

  // Handle page change data loads
  const navigateTo = useCallback((nextPage: AdminPage) => {
    setPage(nextPage)
    setError('')
    setNotice('')
    setSearch('')
    if (nextPage === 'bundles') getAdminBundles().then((res) => setBundles(res.bundles)).catch(() => {})
    if (nextPage === 'promotions') getAdminPromotions().then((res) => setPromotions(res.promotions)).catch(() => {})
    if (nextPage === 'banners') getAdminBanners().then((res) => setBanners(res.banners)).catch(() => {})
    if (nextPage === 'staff') getAdminStaff().then((res) => setStaffList(res.staff)).catch(() => {})
    if (nextPage === 'orders') getAdminOrders('', '').then((res) => setOrders(res.orders)).catch(() => {})
    if (nextPage === 'audit-logs') getAdminAuditLogs().then((res) => setAuditLogs(res.audit_logs)).catch(() => {})
  }, [])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('id-ID')
    return products.filter((product) => {
      const matchesText = !term || `${product.name} ${product.category?.name ?? ''} ${product.description ?? ''}`.toLocaleLowerCase('id-ID').includes(term)
      const matchesCategory = !categoryFilter || String(product.category_id ?? '') === categoryFilter
      return matchesText && matchesCategory
    })
  }, [products, search, categoryFilter])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('id-ID')
    return orders.filter((order) => {
      const matchesText = !term || `${order.order_number} ${order.customer_name} ${order.customer_phone ?? ''}`.toLocaleLowerCase('id-ID').includes(term)
      const matchesStatus = !orderStatusFilter || order.order_status === orderStatusFilter
      return matchesText && matchesStatus
    })
  }, [orders, search, orderStatusFilter])

  const pageHeaders: Record<AdminPage, { title: string; kicker: string; description: string }> = {
    dashboard: { title: 'Ringkasan', kicker: 'DASHBOARD OUTLET', description: 'Pantau kondisi katalog, pesanan, dan operasional SA.TUANG COFFEE.' },
    products: { title: 'Produk', kicker: 'KATALOG MENU', description: 'Atur menu, harga, jenis kelompok, dan status ketersediaan.' },
    categories: { title: 'Kategori', kicker: 'KATALOG MENU', description: 'Kelola pengelompokan menu yang tampil kepada pelanggan.' },
    bundles: { title: 'Paket Menu', kicker: 'KATALOG MENU', description: 'Buat paket bundle hemat yang terdiri dari kombinasi menu.' },
    promotions: { title: 'Promo & Voucher', kicker: 'MARKETING & PROMOSI', description: 'Kelola kode promo potongan harga nominal maupun persentase.' },
    banners: { title: 'Banner & Info', kicker: 'MARKETING & TAMPILAN', description: 'Atur banner pengumuman dan tautan promosi gerai.' },
    orders: { title: 'Semua Pesanan', kicker: 'OPERASIONAL PESANAN', description: 'Daftar riwayat dan monitor seluruh pesanan yang masuk.' },
    staff: { title: 'Kelola Staf', kicker: 'MANAJEMEN PENGGUNA', description: 'Kelola akun kasir dan administrator yang memiliki akses sistem.' },
    'audit-logs': { title: 'Log Aktivitas', kicker: 'KEAMANAN & AUDIT', description: 'Rekam jejak mutasi data sensitif dan aksi administratif.' },
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginBusy(true)
    setLoginError('')
    try {
      const user = await loginStaff(loginEmail, loginPassword)
      if (user.role !== 'admin') {
        setLoginError('Akun ini tidak memiliki akses Admin.')
        return
      }
      setStaff(user)
      setLoginPassword('')
      void refreshData()
    } catch (loginFailure) {
      setLoginError(errorText(loginFailure))
    } finally {
      setLoginBusy(false)
    }
  }

  async function handleLogout() {
    try {
      await logoutStaff()
    } catch {
      /* Token tetap dibersihkan oleh logoutStaff. */
    }
    setStaff(null)
    setDashboard(null)
    setCategories([])
    setProducts([])
    setBundles([])
    setPromotions([])
    setBanners([])
    setStaffList([])
    setOrders([])
    setAuditLogs([])
    setPage('dashboard')
  }

  /* -------------------------------------------------------------------------- */
  /* Handlers: Product                                                          */
  /* -------------------------------------------------------------------------- */
  function openProductEditor(product: AdminProduct | null = null) {
    setError('')
    setUploadError('')
    setUploading(false)
    setImageTarget('product')
    setProductDraft(
      product
        ? {
            category_id: product.category_id ? String(product.category_id) : '',
            name: product.name,
            description: product.description ?? '',
            item_type: product.item_type,
            price: String(Number(product.price)),
            image_path: product.image_path ?? '',
            allow_notes: product.allow_notes,
            is_available: product.is_available,
            is_active: product.is_active,
          }
        : blankProduct(),
    )
    setProductEditor(product)
  }

  async function processUploadFile(file: File) {
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|jfif|heic|avif)$/i.test(file.name)
    if (!isImage) {
      setUploadError('Pilih file gambar yang valid (JPG, PNG, WEBP, GIF).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 10MB.')
      return
    }

    setUploadError('')
    setUploading(true)
    try {
      const res = await uploadAdminImage(file)
      if (imageTarget === 'bundle') {
        setBundleDraft((prev) => ({ ...prev, image_path: res.path }))
        setNotice('Foto paket menu berhasil diunggah ke server.')
      } else if (imageTarget === 'banner') {
        setBannerDraft((prev) => ({ ...prev, image_path: res.path }))
        setNotice('Gambar banner promosi berhasil diunggah ke server.')
      } else {
        setProductDraft((prev) => ({ ...prev, image_path: res.path }))
        setNotice('Foto produk berhasil diunggah ke server.')
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Gagal mengunggah gambar.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (bundleFileInputRef.current) bundleFileInputRef.current.value = ''
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = ''
    }
  }

  function handleProductImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void processUploadFile(file)
  }

  function handleDropFile(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingFile(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void processUploadFile(file)
  }


  async function handleApplyAdjustedImage(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      const res = await uploadAdminImage(file)
      if (imageTarget === 'bundle') {
        setBundleDraft((prev) => ({ ...prev, image_path: res.path }))
        setNotice('Gambar paket menu berhasil disesuaikan dan diunggah.')
      } else if (imageTarget === 'banner') {
        setBannerDraft((prev) => ({ ...prev, image_path: res.path }))
        setNotice('Gambar banner promosi berhasil disesuaikan dan diunggah.')
      } else {
        setProductDraft((prev) => ({ ...prev, image_path: res.path }))
        setNotice('Gambar produk berhasil disesuaikan dan diunggah.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah gambar yang disesuaikan.'
      setUploadError(msg)
      throw new Error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!productDraft.image_path.trim()) {
      setError('Wajib melampirkan foto/gambar menu produk.')
      return
    }
    setBusyId(productEditor ? productEditor.id : -1)
    setError('')
    setNotice('')
    const input: AdminProductInput = {
      ...productDraft,
      category_id: productDraft.category_id ? Number(productDraft.category_id) : null,
      price: Number(productDraft.price),
      image_path: productDraft.image_path.trim() || null,
      description: productDraft.description.trim() || null,
    }
    try {
      if (productEditor) await updateAdminProduct(productEditor.id, input)
      else await createAdminProduct(input)
      setProductEditor(false)
      setNotice(productEditor ? 'Perubahan produk tersimpan.' : 'Produk berhasil ditambahkan.')
      await refreshData()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusyId(null)
    }
  }

  async function removeProduct(product: AdminProduct) {
    if (!window.confirm(`Arsipkan produk “${product.name}”? Produk tidak akan tampil di katalog pelanggan.`)) return
    setBusyId(product.id)
    setError('')
    setNotice('')
    try {
      await deleteAdminProduct(product.id)
      setNotice('Produk berhasil diarsipkan.')
      await refreshData()
    } catch (removeError) {
      setError(errorText(removeError))
    } finally {
      setBusyId(null)
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Handlers: Category                                                         */
  /* -------------------------------------------------------------------------- */
  function openCategoryEditor(category: AdminCategory | null = null, asParent = false) {
    setError('')
    setNotice('')
    if (category) {
      setCategoryDraft({
        is_parent: !category.parent_id,
        parent_id: category.parent_id ? String(category.parent_id) : '',
        name: category.name,
        item_type: category.item_type === 'food' ? 'food' : 'drink',
        description: category.description ?? '',
        sort_order: category.sort_order ?? 0,
        is_active: category.is_active,
      })
    } else {
      const defaultParent = categories.find((c) => !c.parent_id)
      setCategoryDraft(blankCategory(asParent, defaultParent ? String(defaultParent.id) : ''))
    }
    setCategoryEditor(category)
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyId(categoryEditor ? categoryEditor.id : -1)
    setError('')
    setNotice('')

    let targetItemType = categoryDraft.item_type
    let parentIdValue: number | null = null

    if (!categoryDraft.is_parent) {
      if (!categoryDraft.parent_id) {
        setError('Silakan pilih Kategori Induk untuk sub-kategori ini.')
        setBusyId(null)
        return
      }
      parentIdValue = Number(categoryDraft.parent_id)
      const parentCat = categories.find((c) => c.id === parentIdValue)
      if (parentCat?.item_type) {
        targetItemType = parentCat.item_type === 'food' ? 'food' : 'drink'
      }
    }

    const input: AdminCategoryInput = {
      parent_id: parentIdValue,
      name: categoryDraft.name.trim(),
      item_type: targetItemType,
      description: categoryDraft.description.trim() || null,
      is_active: categoryDraft.is_active,
      sort_order: categoryDraft.sort_order ?? 0,
    }
    try {
      if (categoryEditor) await updateAdminCategory(categoryEditor.id, input)
      else await createAdminCategory(input)
      setCategoryEditor(false)
      setNotice(categoryEditor ? 'Perubahan kategori tersimpan.' : (categoryDraft.is_parent ? 'Kategori Induk berhasil ditambahkan.' : 'Sub-kategori berhasil ditambahkan.'))
      await refreshData()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusyId(null)
    }
  }

  async function removeCategory(category: AdminCategory) {
    if (category.products_count > 0) return
    if ((category.children_count ?? 0) > 0) return
    if (!window.confirm(`Hapus kategori “${category.name}”?`)) return
    setBusyId(category.id)
    setError('')
    setNotice('')
    try {
      await deleteAdminCategory(category.id)
      setNotice('Kategori berhasil dihapus.')
      await refreshData()
    } catch (removeError) {
      setError(errorText(removeError))
    } finally {
      setBusyId(null)
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Handlers: Bundle (Paket Menu)                                              */
  /* -------------------------------------------------------------------------- */
  function openBundleEditor(bundle: AdminBundle | null = null) {
    setError('')
    setUploadError('')
    setImageTarget('bundle')
    if (bundle) {
      setBundleDraft({
        category_id: bundle.category_id ? String(bundle.category_id) : '',
        name: bundle.name,
        description: bundle.description ?? '',
        price: String(Number(bundle.price)),
        image_path: bundle.image_path ?? '',
        is_active: bundle.is_active,
        components: bundle.products.map((p) => ({ product_id: p.id, quantity: p.pivot?.quantity ?? 1 })),
      })
    } else {
      setBundleDraft(blankBundle())
    }
    setBundleEditor(bundle)
  }

  async function saveBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (bundleDraft.components.length === 0) {
      setError('Paket harus memiliki minimal 1 komponen menu.')
      return
    }
    if (!bundleDraft.image_path.trim()) {
      setError('Wajib melampirkan foto/gambar paket menu.')
      return
    }
    setBusyId(bundleEditor ? bundleEditor.id : -1)
    setError('')
    setNotice('')
    const input: AdminBundleInput = {
      category_id: bundleDraft.category_id ? Number(bundleDraft.category_id) : null,
      name: bundleDraft.name.trim(),
      description: bundleDraft.description.trim() || null,
      price: Number(bundleDraft.price),
      image_path: bundleDraft.image_path.trim() || null,
      is_active: bundleDraft.is_active,
      starts_at: null,
      ends_at: null,
      components: bundleDraft.components,
    }
    try {
      if (bundleEditor) await updateAdminBundle(bundleEditor.id, input)
      else await createAdminBundle(input)
      setBundleEditor(false)
      setNotice(bundleEditor ? 'Paket menu berhasil diperbarui.' : 'Paket menu berhasil ditambahkan.')
      const res = await getAdminBundles()
      setBundles(res.bundles)
      void refreshData()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusyId(null)
    }
  }

  async function removeBundle(bundle: AdminBundle) {
    if (!window.confirm(`Hapus paket menu “${bundle.name}”?`)) return
    setBusyId(bundle.id)
    setError('')
    setNotice('')
    try {
      await deleteAdminBundle(bundle.id)
      setNotice('Paket menu berhasil dihapus.')
      const res = await getAdminBundles()
      setBundles(res.bundles)
      void refreshData()
    } catch (delError) {
      setError(errorText(delError))
    } finally {
      setBusyId(null)
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Handlers: Promotion                                                        */
  /* -------------------------------------------------------------------------- */
  function openPromotionEditor(promo: AdminPromotion | null = null) {
    setError('')
    setPromotionDraft(
      promo
        ? {
            code: promo.code,
            name: promo.name,
            description: promo.description ?? '',
            discount_type: promo.discount_type,
            discount_value: String(Number(promo.discount_value)),
            min_spend: String(Number(promo.min_spend)),
            max_discount: promo.max_discount ? String(Number(promo.max_discount)) : '',
            is_active: promo.is_active,
          }
        : blankPromotion(),
    )
    setPromotionEditor(promo)
  }

  async function savePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyId(promotionEditor ? promotionEditor.id : -1)
    setError('')
    setNotice('')
    const input: AdminPromotionInput = {
      code: promotionDraft.code.trim().toUpperCase(),
      name: promotionDraft.name.trim(),
      description: promotionDraft.description.trim() || null,
      discount_type: promotionDraft.discount_type,
      discount_value: Number(promotionDraft.discount_value),
      min_spend: Number(promotionDraft.min_spend) || 0,
      max_discount: promotionDraft.discount_type === 'fixed' ? null : (promotionDraft.max_discount ? Number(promotionDraft.max_discount) : null),
      is_active: promotionDraft.is_active,
      starts_at: null,
      ends_at: null,
    }
    try {
      if (promotionEditor) await updateAdminPromotion(promotionEditor.id, input)
      else await createAdminPromotion(input)
      setPromotionEditor(false)
      setNotice(promotionEditor ? 'Promo berhasil diperbarui.' : 'Promo berhasil dibuat.')
      const res = await getAdminPromotions()
      setPromotions(res.promotions)
      void refreshData()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusyId(null)
    }
  }

  async function removePromotion(promo: AdminPromotion) {
    if (!window.confirm(`Hapus kode promo “${promo.code}”?`)) return
    setBusyId(promo.id)
    setError('')
    setNotice('')
    try {
      await deleteAdminPromotion(promo.id)
      setNotice('Promo berhasil dihapus.')
      const res = await getAdminPromotions()
      setPromotions(res.promotions)
      void refreshData()
    } catch (delError) {
      setError(errorText(delError))
    } finally {
      setBusyId(null)
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Handlers: Banner                                                           */
  /* -------------------------------------------------------------------------- */
  function openBannerEditor(banner: AdminBanner | null = null) {
    setError('')
    setUploadError('')
    setImageTarget('banner')
    setBannerDraft(
      banner
        ? {
            title: banner.title,
            subtitle: banner.subtitle ?? '',
            image_path: banner.image_path ?? '',
            link_url: banner.link_url ?? '',
            sort_order: String(banner.sort_order),
            is_active: banner.is_active,
          }
        : blankBanner(),
    )
    setBannerEditor(banner)
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bannerDraft.image_path.trim()) {
      setError('Wajib melampirkan gambar banner promosi.')
      return
    }
    setBusyId(bannerEditor ? bannerEditor.id : -1)
    setError('')
    setNotice('')
    const input: AdminBannerInput = {
      title: bannerDraft.title.trim(),
      subtitle: bannerDraft.subtitle.trim() || null,
      image_path: bannerDraft.image_path.trim() || null,
      link_url: bannerDraft.link_url.trim() || null,
      sort_order: Number(bannerDraft.sort_order) || 0,
      is_active: bannerDraft.is_active,
    }
    try {
      if (bannerEditor) await updateAdminBanner(bannerEditor.id, input)
      else await createAdminBanner(input)
      setBannerEditor(false)
      setNotice(bannerEditor ? 'Banner berhasil diperbarui.' : 'Banner berhasil ditambahkan.')
      const res = await getAdminBanners()
      setBanners(res.banners)
      void refreshData()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusyId(null)
    }
  }

  async function removeBanner(banner: AdminBanner) {
    if (!window.confirm(`Hapus banner “${banner.title}”?`)) return
    setBusyId(banner.id)
    setError('')
    setNotice('')
    try {
      await deleteAdminBanner(banner.id)
      setNotice('Banner berhasil dihapus.')
      const res = await getAdminBanners()
      setBanners(res.banners)
      void refreshData()
    } catch (delError) {
      setError(errorText(delError))
    } finally {
      setBusyId(null)
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Handlers: Staff Management                                                 */
  /* -------------------------------------------------------------------------- */
  function openStaffEditor(target: AdminStaffUser | null = null) {
    setError('')
    setStaffDraft(
      target
        ? {
            name: target.name,
            email: target.email,
            password: '',
            role: target.role,
            is_active: target.is_active,
          }
        : blankStaff(),
    )
    setStaffEditor(target)
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyId(staffEditor ? staffEditor.id : -1)
    setError('')
    setNotice('')
    const input: AdminStaffInput = {
      name: staffDraft.name.trim(),
      email: staffDraft.email.trim(),
      role: staffDraft.role,
      is_active: staffDraft.is_active,
      ...(staffDraft.password ? { password: staffDraft.password } : {}),
    }
    try {
      if (staffEditor) await updateAdminStaff(staffEditor.id, input)
      else await createAdminStaff(input)
      setStaffEditor(false)
      setNotice(staffEditor ? 'Data staf berhasil diperbarui.' : 'Akun staf baru berhasil dibuat.')
      const res = await getAdminStaff()
      setStaffList(res.staff)
      void refreshData()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusyId(null)
    }
  }

  async function toggleStaff(target: AdminStaffUser) {
    if (staff?.id === target.id) {
      setError('Anda tidak dapat mengubah status akun Anda sendiri.')
      return
    }
    const actionLabel = target.is_active ? 'nonaktifkan' : 'aktifkan'
    if (!window.confirm(`Yakin ingin ${actionLabel} akun staf “${target.name}”?`)) return
    setBusyId(target.id)
    setError('')
    setNotice('')
    try {
      await toggleAdminStaffStatus(target.id)
      setNotice(`Akun staf “${target.name}” berhasil di-${actionLabel}.`)
      const res = await getAdminStaff()
      setStaffList(res.staff)
      void refreshData()
    } catch (tError) {
      setError(errorText(tError))
    } finally {
      setBusyId(null)
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Bundle Component Helpers                                                   */
  /* -------------------------------------------------------------------------- */
  function addBundleComponent() {
    const available = products.find((p) => !bundleDraft.components.some((c) => c.product_id === p.id))
    if (!available) return
    setBundleDraft((prev) => ({
      ...prev,
      components: [...prev.components, { product_id: available.id, quantity: 1 }],
    }))
  }

  function updateBundleComponent(index: number, productId: number, quantity: number) {
    setBundleDraft((prev) => {
      const next = [...prev.components]
      next[index] = { product_id: productId, quantity: Math.max(1, quantity) }
      return { ...prev, components: next }
    })
  }

  function removeBundleComponent(index: number) {
    setBundleDraft((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }))
  }

  const bundleCalculatedOriginalPrice = useMemo(() => {
    return bundleDraft.components.reduce((sum, comp) => {
      const prod = products.find((p) => p.id === comp.product_id)
      return sum + (prod ? Number(prod.price) * comp.quantity : 0)
    }, 0)
  }, [bundleDraft.components, products])

  if (sessionChecking) return <div className="admin-loading"><span className="admin-spinner" />Memeriksa sesi Admin…</div>

  if (!staff) {
    return (
      <main className="admin-login-page">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <a className="admin-brand" href="/" aria-label="SA.TUANG COFFEE beranda">
            <span className="admin-brand-mark">S</span>
            <span>
              <strong>SA.TUANG COFFEE</strong>
              <small>BANJAR WIJAYA</small>
            </span>
          </a>
          <div className="admin-login-heading">
            <span className="admin-kicker">PANEL ADMINISTRASI</span>
            <h1>Selamat datang.</h1>
            <p>Masuk dengan akun Admin yang telah diberikan akses.</p>
          </div>
          {loginError && <p className="admin-alert error" role="alert">{loginError}</p>}
          <label>
            Email
            <input type="email" autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required />
          </label>
          <label>
            Kata sandi
            <input type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required />
          </label>
          <button className="admin-button primary full" disabled={loginBusy}>
            {loginBusy ? 'Memeriksa…' : 'Masuk ke Admin'}
            <span aria-hidden="true">→</span>
          </button>
          <a className="admin-back-link" href="/">← Kembali ke halaman pelanggan</a>
        </form>
      </main>
    )
  }

  const stats = dashboard?.stats
  const currentHead = pageHeaders[page]

  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <a className="admin-brand" href="/" aria-label="SA.TUANG COFFEE">
          <span className="admin-brand-mark">S</span>
          <span>
            <strong>SA.TUANG COFFEE</strong>
            <small>BANJAR WIJAYA</small>
          </span>
        </a>
        <div className="admin-topbar-label"><i /> PANEL ADMIN</div>
        <div className="admin-user">
          <span className="admin-avatar">{staff.name.slice(0, 1).toUpperCase()}</span>
          <span className="admin-user-copy">
            <b>{staff.name}</b>
            <small>Administrator</small>
          </span>
          <button className="admin-logout" onClick={() => void handleLogout()}>Keluar</button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Navigasi Admin">
          <span className="admin-nav-label">MENU UTAMA</span>
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => navigateTo('dashboard')}>
            <span>◫</span>Ringkasan
          </button>
          <button className={page === 'orders' ? 'active' : ''} onClick={() => navigateTo('orders')}>
            <span>≣</span>Pesanan
          </button>

          <span className="admin-nav-label section">KATALOG MENU</span>
          <button className={page === 'products' ? 'active' : ''} onClick={() => navigateTo('products')}>
            <span>◈</span>Produk <small>{products.length}</small>
          </button>
          <button className={page === 'categories' ? 'active' : ''} onClick={() => navigateTo('categories')}>
            <span>▦</span>Kategori <small>{categories.length}</small>
          </button>
          <button className={page === 'bundles' ? 'active' : ''} onClick={() => navigateTo('bundles')}>
            <span>◧</span>Paket Menu <small>{bundles.length}</small>
          </button>

          <span className="admin-nav-label section">MARKETING</span>
          <button className={page === 'promotions' ? 'active' : ''} onClick={() => navigateTo('promotions')}>
            <span>%</span>Promo & Voucher <small>{promotions.length}</small>
          </button>
          <button className={page === 'banners' ? 'active' : ''} onClick={() => navigateTo('banners')}>
            <span>▤</span>Banner & Info <small>{banners.length}</small>
          </button>

          <span className="admin-nav-label section">SISTEM & STAF</span>
          <button className={page === 'staff' ? 'active' : ''} onClick={() => navigateTo('staff')}>
            <span>⚲</span>Kelola Staf <small>{staffList.length}</small>
          </button>
          <button className={page === 'audit-logs' ? 'active' : ''} onClick={() => navigateTo('audit-logs')}>
            <span>📋</span>Log Aktivitas
          </button>

          <div className="admin-sidebar-foot">
            <span className="admin-live-dot" />SA.TUANG COFFEE<br />
            <small>Banjar Wijaya</small>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-page-head">
            <div>
              <span className="admin-kicker">{currentHead.kicker}</span>
              <h1>{currentHead.title}</h1>
              <p>{currentHead.description}</p>
            </div>
            {page === 'products' && <button className="admin-button primary" onClick={() => openProductEditor()}>＋ Tambah produk</button>}
            {page === 'categories' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="admin-button primary" onClick={() => openCategoryEditor(null, true)}>
                  ＋ Tambah Kategori Induk
                </button>
                <button className="admin-button" onClick={() => openCategoryEditor(null, false)}>
                  ＋ Tambah Sub-Kategori
                </button>
              </div>
            )}
            {page === 'bundles' && <button className="admin-button primary" onClick={() => openBundleEditor()}>＋ Tambah paket</button>}
            {page === 'promotions' && <button className="admin-button primary" onClick={() => openPromotionEditor()}>＋ Tambah promo</button>}
            {page === 'banners' && <button className="admin-button primary" onClick={() => openBannerEditor()}>＋ Tambah banner</button>}
            {page === 'staff' && <button className="admin-button primary" onClick={() => openStaffEditor()}>＋ Tambah akun staf</button>}
            {(page === 'dashboard' || page === 'orders' || page === 'audit-logs') && (
              <button className="admin-button quiet" onClick={() => void refreshData()} disabled={loading}>
                ↻ Perbarui data
              </button>
            )}
          </div>

          {notice && <p className="admin-alert success" role="status">{notice}</p>}
          {error && <p className="admin-alert error" role="alert">{error}</p>}
          {loading && <div className="admin-inline-loading"><span className="admin-spinner" />Memuat data…</div>}

          {/* 1. DASHBOARD */}
          {page === 'dashboard' && (
            <section className="admin-dashboard">
              <div className="admin-stat-grid wide">
                <article className="admin-stat-card">
                  <span>KATEGORI AKTIF</span>
                  <strong>{stats?.active_categories ?? '—'}</strong>
                  <small>Kelompok menu tersedia</small>
                </article>
                <article className="admin-stat-card">
                  <span>PRODUK AKTIF</span>
                  <strong>{stats?.active_products ?? '—'}</strong>
                  <small>Tampil pada katalog pelanggan</small>
                </article>
                <article className="admin-stat-card warning">
                  <span>MENU HABIS</span>
                  <strong>{stats?.unavailable_products ?? '—'}</strong>
                  <small>Produk aktif yang tidak tersedia</small>
                </article>
                <article className="admin-stat-card">
                  <span>PAKET BUNDLE</span>
                  <strong>{stats?.active_bundles ?? bundles.length}</strong>
                  <small>Menu paket aktif</small>
                </article>
                <article className="admin-stat-card">
                  <span>PROMO AKTIF</span>
                  <strong>{stats?.active_promotions ?? promotions.length}</strong>
                  <small>Kode voucher berlaku</small>
                </article>
                <article className="admin-stat-card">
                  <span>STAF OPERASIONAL</span>
                  <strong>{stats?.active_staff ?? staffList.length}</strong>
                  <small>Kasir dan Administrator</small>
                </article>
                <article className="admin-stat-card accent">
                  <span>PESANAN BERJALAN</span>
                  <strong>{stats?.open_orders ?? '—'}</strong>
                  <small>Belum selesai diproses</small>
                </article>
              </div>

              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <h2>Pesanan terbaru</h2>
                    <p>Ringkasan transaksi yang masuk ke outlet SA.TUANG COFFEE.</p>
                  </div>
                  <div className="admin-filter-tools">
                    <button className="admin-button quiet" onClick={() => navigateTo('orders')}>Lihat semua pesanan →</button>
                    <a className="admin-text-link" href="/kasir">Buka Kasir ↗</a>
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>KODE ANTREAN</th>
                        <th>PELANGGAN</th>
                        <th>WAKTU</th>
                        <th>STATUS</th>
                        <th className="align-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.recent_orders.map((order) => (
                        <tr key={order.order_number}>
                          <td><strong>{order.order_number}</strong></td>
                          <td>{order.customer_name}</td>
                          <td>{dateTime(order.created_at)}</td>
                          <td>
                            <span className={`admin-status ${order.order_status === 'SELESAI' ? 'good' : 'neutral'}`}>
                              {statusNames[order.order_status] ?? order.order_status}
                            </span>
                          </td>
                          <td className="align-right">{currency(order.total)}</td>
                        </tr>
                      ))}
                      {!dashboard?.recent_orders.length && (
                        <tr><td colSpan={5} className="admin-empty-cell">Belum ada pesanan yang tercatat.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="admin-shortcuts">
                <button onClick={() => navigateTo('products')}>
                  <span>◈</span>
                  <b>Kelola produk</b>
                  <small>Perbarui harga, menu, dan ketersediaan</small>→
                </button>
                <button onClick={() => navigateTo('bundles')}>
                  <span>◧</span>
                  <b>Kelola paket menu</b>
                  <small>Atur bundle hemat kombinasi menu</small>→
                </button>
                <button onClick={() => navigateTo('promotions')}>
                  <span>%</span>
                  <b>Kode promo & voucher</b>
                  <small>Buat potongan diskon transaksi</small>→
                </button>
                <button onClick={() => navigateTo('staff')}>
                  <span>⚲</span>
                  <b>Kelola akun staf</b>
                  <small>Tambah atau ubah hak akses kasir</small>→
                </button>
              </div>
            </section>
          )}

          {/* 2. PRODUK */}
          {page === 'products' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Daftar produk</h2>
                  <p>{filteredProducts.length} dari {products.length} produk</p>
                </div>
                <div className="admin-filter-tools">
                  <label className="admin-search">
                    <span>⌕</span>
                    <input aria-label="Cari produk" placeholder="Cari nama produk…" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </label>
                  <select aria-label="Filter kategori" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="">Semua kategori</option>
                    {categories.map((c) => (<option value={c.id} key={c.id}>{c.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table product-table">
                  <thead>
                    <tr>
                      <th>PRODUK</th>
                      <th>KATEGORI</th>
                      <th>JENIS</th>
                      <th>HARGA</th>
                      <th>STATUS</th>
                      <th className="align-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {p.image_path ? (
                              <img
                                src={p.image_path}
                                alt={p.name}
                                style={{
                                  width: '48px',
                                  height: '36px',
                                  aspectRatio: '4 / 3',
                                  objectFit: 'cover',
                                  border: '1.5px solid #0c0d0e',
                                  borderRadius: '2px',
                                  background: '#f0f0ea',
                                  boxShadow: '1.5px 1.5px 0 #0c0d0e',
                                  flexShrink: 0,
                                }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '48px',
                                  height: '36px',
                                  aspectRatio: '4 / 3',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: '#eae7df',
                                  border: '1.5px dashed #a5a9a0',
                                  borderRadius: '2px',
                                  fontSize: '13px',
                                  flexShrink: 0,
                                }}
                              >
                                {p.item_type === 'food' ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M18 8v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8" />
                                    <path d="M4 8h16" />
                                    <path d="M12 4v4" />
                                    <path d="M8 4h8" />
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                                    <line x1="6" y1="1" x2="6" y2="4" />
                                    <line x1="10" y1="1" x2="10" y2="4" />
                                    <line x1="14" y1="1" x2="14" y2="4" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <div>
                              <strong>{p.name}</strong>
                              <small className="admin-subline">{p.description || '—'}</small>
                            </div>
                          </div>
                        </td>
                        <td>{p.category?.name ?? 'Tanpa kategori'}</td>
                        <td>{itemNames[p.item_type]}</td>
                        <td><strong>{currency(p.price)}</strong></td>
                        <td>
                          <div className="admin-status-stack">
                            <span className={`admin-status ${p.is_active ? 'good' : 'muted'}`}>{p.is_active ? 'Aktif' : 'Diarsipkan'}</span>
                            <span className={`admin-status ${p.is_available ? 'good' : 'warning'}`}>{p.is_available ? 'Tersedia' : 'Habis'}</span>
                          </div>
                        </td>
                        <td className="align-right admin-actions">
                          <button className="admin-icon-button" aria-label={`Ubah ${p.name}`} onClick={() => openProductEditor(p)}>Ubah</button>
                          <button className="admin-icon-button danger" aria-label={`Arsipkan ${p.name}`} disabled={busyId === p.id} onClick={() => void removeProduct(p)}>Arsip</button>
                        </td>
                      </tr>
                    ))}
                    {!filteredProducts.length && (
                      <tr><td colSpan={6} className="admin-empty-cell">{products.length ? 'Produk tidak ditemukan untuk pencarian ini.' : 'Belum ada produk. Tambahkan produk untuk memulai katalog.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 3. KATEGORI */}
          {page === 'categories' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Daftar kategori</h2>
                  <p>Kategori untuk mengelompokkan produk di menu katalog.</p>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>KATEGORI</th>
                      <th>TINGKAT</th>
                      <th>STASIUN / TIPE</th>
                      <th>DESKRIPSI</th>
                      <th>JUMLAH</th>
                      <th>STATUS</th>
                      <th className="align-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 1. Tampilkan Kategori Induk beserta Sub-Kategorinya */}
                    {categories
                      .filter((c) => !c.parent_id)
                      .map((parent) => {
                        const children = categories.filter((sub) => sub.parent_id === parent.id)
                        return (
                          <Fragment key={`parent-group-${parent.id}`}>
                            <tr style={{ background: '#f5f4ef', fontWeight: 600 }}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ background: '#111', color: '#ffdd00', fontWeight: 900, fontSize: '10px', padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    INDUK
                                  </span>
                                  <strong>{parent.name}</strong>
                                </div>
                              </td>
                              <td>
                                <span className="admin-status" style={{ background: '#e3dfd3', color: '#111', fontWeight: 700 }}>
                                  Kategori Induk
                                </span>
                              </td>
                              <td>
                                <span className={`admin-status ${parent.item_type === 'food' ? 'warning' : 'info'}`}>
                                  {parent.item_type === 'food' ? 'Makanan (Kitchen)' : 'Minuman (Bar)'}
                                </span>
                              </td>
                              <td>{parent.description || '—'}</td>
                              <td>
                                <strong style={{ fontSize: '12px' }}>{children.length} sub-kategori</strong>
                                {parent.products_count > 0 && <small style={{ display: 'block', color: '#666' }}>{parent.products_count} produk</small>}
                              </td>
                              <td><span className={`admin-status ${parent.is_active ? 'good' : 'muted'}`}>{parent.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                              <td className="align-right admin-actions">
                                <button className="admin-icon-button" aria-label={`Ubah kategori induk ${parent.name}`} onClick={() => openCategoryEditor(parent, true)}>Ubah</button>
                                <button
                                  className="admin-icon-button danger"
                                  aria-label={`Hapus kategori induk ${parent.name}`}
                                  disabled={busyId === parent.id || parent.products_count > 0 || children.length > 0}
                                  title={children.length > 0 ? 'Hapus atau pindahkan sub-kategori terlebih dahulu.' : parent.products_count > 0 ? 'Pindahkan produk sebelum menghapus kategori.' : ''}
                                  onClick={() => void removeCategory(parent)}
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>

                            {/* Sub-kategori dari kategori induk ini */}
                            {children.map((sub) => (
                              <tr key={sub.id}>
                                <td style={{ paddingLeft: '28px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#888', fontWeight: 700 }}>↳</span>
                                    <strong>{sub.name}</strong>
                                  </div>
                                </td>
                                <td>
                                  <small style={{ color: '#666' }}>Sub dari {parent.name}</small>
                                </td>
                                <td>
                                  <span className={`admin-status ${sub.item_type === 'food' ? 'warning' : 'info'}`} style={{ opacity: 0.85 }}>
                                    {sub.item_type === 'food' ? 'Makanan' : 'Minuman'}
                                  </span>
                                </td>
                                <td>{sub.description || '—'}</td>
                                <td>{sub.products_count} produk</td>
                                <td><span className={`admin-status ${sub.is_active ? 'good' : 'muted'}`}>{sub.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                                <td className="align-right admin-actions">
                                  <button className="admin-icon-button" aria-label={`Ubah sub-kategori ${sub.name}`} onClick={() => openCategoryEditor(sub, false)}>Ubah</button>
                                  <button
                                    className="admin-icon-button danger"
                                    aria-label={`Hapus sub-kategori ${sub.name}`}
                                    disabled={busyId === sub.id || sub.products_count > 0}
                                    title={sub.products_count > 0 ? 'Pindahkan produk sebelum menghapus kategori.' : ''}
                                    onClick={() => void removeCategory(sub)}
                                  >
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        )
                      })}

                    {/* 2. Sub-kategori yang induknya tidak ditemukan (jika ada data legacy) */}
                    {categories
                      .filter((c) => c.parent_id && !categories.some((p) => p.id === c.parent_id))
                      .map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td><small>Sub-kategori</small></td>
                          <td>
                            <span className={`admin-status ${c.item_type === 'food' ? 'warning' : 'info'}`}>
                              {c.item_type === 'food' ? 'Makanan' : 'Minuman'}
                            </span>
                          </td>
                          <td>{c.description || '—'}</td>
                          <td>{c.products_count} produk</td>
                          <td><span className={`admin-status ${c.is_active ? 'good' : 'muted'}`}>{c.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                          <td className="align-right admin-actions">
                            <button className="admin-icon-button" onClick={() => openCategoryEditor(c, false)}>Ubah</button>
                            <button className="admin-icon-button danger" disabled={c.products_count > 0} onClick={() => void removeCategory(c)}>Hapus</button>
                          </td>
                        </tr>
                      ))}

                    {!categories.length && (
                      <tr><td colSpan={7} className="admin-empty-cell">Belum ada kategori. Tambahkan Kategori Induk atau Sub-Kategori untuk mengelompokkan produk.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 4. PAKET MENU (BUNDLES) */}
          {page === 'bundles' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Daftar paket bundle</h2>
                  <p>{bundles.length} paket kombinasi menu terdaftar.</p>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>PAKET</th>
                      <th>KATEGORI</th>
                      <th>KOMPONEN MENU</th>
                      <th>HARGA BUNDLE</th>
                      <th>STATUS</th>
                      <th className="align-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundles.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {b.image_path ? (
                              <img
                                src={b.image_path}
                                alt={b.name}
                                style={{ width: '44px', height: '33px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #111', flexShrink: 0 }}
                              />
                            ) : null}
                            <div>
                              <strong>{b.name}</strong>
                              <small className="admin-subline">{b.description || '—'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="admin-badge">{b.category?.name || 'Paket Umum'}</span>
                        </td>
                        <td>
                          <div className="bundle-component-tags">
                            {b.products?.map((item) => (
                              <span key={item.id} className="bundle-tag">
                                {item.pivot?.quantity}× {item.name}
                              </span>
                            ))}
                            {!b.products?.length && <small className="admin-subline">Tidak ada komponen</small>}
                          </div>
                        </td>
                        <td>
                          <strong>{currency(b.price)}</strong>
                        </td>
                        <td>
                          <span className={`admin-status ${b.is_active ? 'good' : 'muted'}`}>
                            {b.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="align-right admin-actions">
                          <button className="admin-icon-button" aria-label={`Ubah paket ${b.name}`} onClick={() => openBundleEditor(b)}>Ubah</button>
                          <button className="admin-icon-button danger" aria-label={`Hapus paket ${b.name}`} disabled={busyId === b.id} onClick={() => void removeBundle(b)}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                    {!bundles.length && (
                      <tr><td colSpan={6} className="admin-empty-cell">Belum ada paket menu. Klik tombol “＋ Tambah paket” untuk membuat paket menu.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. PROMO & VOUCHER */}
          {page === 'promotions' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Daftar promo & voucher</h2>
                  <p>{promotions.length} aturan potongan diskon terdaftar.</p>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>KODE</th>
                      <th>NAMA PROMO</th>
                      <th>POTONGAN</th>
                      <th>MIN. BELANJA</th>
                      <th>STATUS</th>
                      <th className="align-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotions.map((pr) => (
                      <tr key={pr.id}>
                        <td><strong><code>{pr.code}</code></strong></td>
                        <td>
                          <strong>{pr.name}</strong>
                          <small className="admin-subline">{pr.description || '—'}</small>
                        </td>
                        <td>
                          <strong>{pr.discount_type === 'percent' ? `${pr.discount_value}%` : currency(pr.discount_value)}</strong>
                          {pr.max_discount && <small className="admin-subline">Maks: {currency(pr.max_discount)}</small>}
                        </td>
                        <td>{Number(pr.min_spend) > 0 ? currency(pr.min_spend) : 'Tanpa min.'}</td>
                        <td>
                          <span className={`admin-status ${pr.is_active ? 'good' : 'muted'}`}>
                            {pr.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="align-right admin-actions">
                          <button className="admin-icon-button" aria-label={`Ubah promo ${pr.code}`} onClick={() => openPromotionEditor(pr)}>Ubah</button>
                          <button className="admin-icon-button danger" aria-label={`Hapus promo ${pr.code}`} disabled={busyId === pr.id} onClick={() => void removePromotion(pr)}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                    {!promotions.length && (
                      <tr><td colSpan={6} className="admin-empty-cell">Belum ada kode promo. Klik tombol “＋ Tambah promo” untuk membuat promo baru.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 6. BANNER & INFO GERAI */}
          {page === 'banners' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Banner & pengumuman</h2>
                  <p>{banners.length} banner promosi dan informasi gerai.</p>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>URUTAN</th>
                      <th>JUDUL & SUBJUDUL</th>
                      <th>TAUTAN / GAMBAR</th>
                      <th>STATUS</th>
                      <th className="align-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banners.map((bn) => (
                      <tr key={bn.id}>
                        <td><strong>#{bn.sort_order}</strong></td>
                        <td>
                          <strong>{bn.title}</strong>
                          <small className="admin-subline">{bn.subtitle || '—'}</small>
                        </td>
                        <td>
                          <small className="admin-subline">Link: {bn.link_url || '—'}</small>
                          <small className="admin-subline">Gambar: {bn.image_path || '—'}</small>
                        </td>
                        <td>
                          <span className={`admin-status ${bn.is_active ? 'good' : 'muted'}`}>
                            {bn.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="align-right admin-actions">
                          <button className="admin-icon-button" aria-label={`Ubah banner ${bn.title}`} onClick={() => openBannerEditor(bn)}>Ubah</button>
                          <button className="admin-icon-button danger" aria-label={`Hapus banner ${bn.title}`} disabled={busyId === bn.id} onClick={() => void removeBanner(bn)}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                    {!banners.length && (
                      <tr><td colSpan={5} className="admin-empty-cell">Belum ada banner pengumuman. Klik “＋ Tambah banner” untuk menambahkan informasi.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 7. PESANAN (ORDERS MONITOR) */}
          {page === 'orders' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Daftar seluruh pesanan</h2>
                  <p>{filteredOrders.length} pesanan tercatat</p>
                </div>
                <div className="admin-filter-tools">
                  <label className="admin-search">
                    <span>⌕</span>
                    <input aria-label="Cari pesanan" placeholder="No. pesanan / nama…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  <select aria-label="Filter status pesanan" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                    <option value="">Semua status</option>
                    <option value="MENUNGGU_PEMBAYARAN">Menunggu pembayaran</option>
                    <option value="PESANAN_DITERIMA">Pesanan diterima</option>
                    <option value="SEDANG_DIBUAT">Sedang dibuat</option>
                    <option value="SIAP_DIAMBIL">Siap diambil</option>
                    <option value="SELESAI">Selesai</option>
                  </select>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>KODE ANTREAN</th>
                      <th>PELANGGAN</th>
                      <th>WAKTU</th>
                      <th>RINCIAN ITEM</th>
                      <th>PEMBAYARAN</th>
                      <th>STATUS PESANAN</th>
                      <th className="align-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(o)} title="Klik untuk rincian pesanan">
                        <td><strong>{o.order_number}</strong></td>
                        <td>
                          <strong>{o.customer_name}</strong>
                          {o.customer_phone && <small className="admin-subline">{o.customer_phone}</small>}
                        </td>
                        <td>{dateTime(o.created_at)}</td>
                        <td>
                          <div className="bundle-component-tags">
                            {o.items?.map((item) => (
                              <span key={item.id} className="bundle-tag">
                                {item.quantity}× {item.product_name_snapshot}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`admin-status ${o.payment_status === 'BERHASIL' ? 'good' : 'warning'}`}>
                            {o.payment_method.toUpperCase()} · {o.payment_status}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-status ${o.order_status === 'SELESAI' ? 'good' : o.order_status === 'SIAP_DIAMBIL' ? 'warning' : 'neutral'}`}>
                            {statusNames[o.order_status] ?? o.order_status}
                          </span>
                        </td>
                        <td className="align-right"><strong>{currency(o.total)}</strong></td>
                      </tr>
                    ))}
                    {!filteredOrders.length && (
                      <tr><td colSpan={7} className="admin-empty-cell">Tidak ada data pesanan yang cocok.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 8. KELOLA STAF */}
          {page === 'staff' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Pengguna & staf outlet</h2>
                  <p>{staffList.length} akun staf aktif dan terdaftar.</p>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>NAMA LENGKAP</th>
                      <th>EMAIL</th>
                      <th>PERAN</th>
                      <th>TERDAFTAR</th>
                      <th>STATUS</th>
                      <th className="align-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((st) => (
                      <tr key={st.id}>
                        <td>
                          <strong>{st.name}</strong>
                          {staff.id === st.id && <small className="admin-subline">(Akun Anda saat ini)</small>}
                        </td>
                        <td>{st.email}</td>
                        <td>
                          <span className={`admin-status ${st.role === 'admin' ? 'good' : 'neutral'}`}>
                            {st.role === 'admin' ? 'Administrator' : 'Kasir'}
                          </span>
                        </td>
                        <td>{dateTime(st.created_at)}</td>
                        <td>
                          <span className={`admin-status ${st.is_active ? 'good' : 'muted'}`}>
                            {st.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="align-right admin-actions">
                          <button className="admin-icon-button" aria-label={`Ubah ${st.name}`} onClick={() => openStaffEditor(st)}>Ubah</button>
                          {staff.id !== st.id && (
                            <button
                              className={`admin-icon-button ${st.is_active ? 'danger' : ''}`}
                              disabled={busyId === st.id}
                              onClick={() => void toggleStaff(st)}
                            >
                              {st.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!staffList.length && (
                      <tr><td colSpan={6} className="admin-empty-cell">Belum ada data staf.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 9. LOG AKTIVITAS (AUDIT LOGS) */}
          {page === 'audit-logs' && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Riwayat audit sistem</h2>
                  <p>Catatan mutasi data sensitif, perubahan harga, dan aksi staf.</p>
                </div>
              </div>
              <div style={{ padding: '16px' }}>
                {auditLogs.map((log) => (
                  <article key={log.id} className="audit-log-card" onClick={() => setSelectedAuditLog(log)} style={{ cursor: 'pointer' }}>
                    <div className="audit-log-head">
                      <div>
                        <span className="audit-actor">{log.actor_name ?? 'Sistem'}</span>
                        <small style={{ color: '#777b73', marginLeft: '8px' }}>({log.actor_email ?? 'system@internal'})</small>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="audit-action-tag">{log.action}</span>
                        <small style={{ color: '#888' }}>{dateTime(log.created_at)}</small>
                      </div>
                    </div>
                    <div style={{ color: '#555' }}>
                      Subjek: <code>{log.subject_type ? log.subject_type.split('\\').pop() : '—'} #{log.subject_id}</code>
                      {log.ip_address && <span style={{ marginLeft: '12px', color: '#999' }}>IP: {log.ip_address}</span>}
                    </div>
                  </article>
                ))}
                {!auditLogs.length && (
                  <div className="admin-empty-cell">Belum ada riwayat audit yang tercatat.</div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* MODAL: PRODUK */}
      {productEditor !== false && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setProductEditor(false) }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">KATALOG MENU</span>
                <h2 id="product-modal-title">{productEditor ? 'Ubah produk' : 'Tambah produk'}</h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setProductEditor(false)}>×</button>
            </div>
            <form className="admin-form" onSubmit={saveProduct}>
              <label>Nama produk<input autoFocus maxLength={160} value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} required /></label>
              <div className="admin-form-row">
                <label>Kategori
                  <select
                    value={productDraft.category_id}
                    onChange={(e) => {
                      const catId = e.target.value
                      const selectedCat = categories.find((c) => String(c.id) === catId)
                      const inheritedType = selectedCat?.item_type === 'food' ? 'food' : selectedCat?.item_type === 'drink' ? 'drink' : productDraft.item_type
                      setProductDraft({ ...productDraft, category_id: catId, item_type: inheritedType })
                    }}
                  >
                    <option value="">Tanpa kategori</option>
                    {categories
                      .filter((c) => !c.parent_id)
                      .map((parent) => {
                        const children = categories.filter((sub) => sub.parent_id === parent.id)
                        return (
                          <optgroup key={`optgroup-${parent.id}`} label={`Kategori Induk: ${parent.name} (${parent.item_type === 'food' ? 'Makanan' : 'Minuman'})`}>
                            {children.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                            <option value={parent.id}>
                              {parent.name} (Umum / Langsung)
                            </option>
                          </optgroup>
                        )
                      })}
                    {categories
                      .filter((c) => c.parent_id && !categories.some((p) => p.id === c.parent_id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>Jenis menu
                  <select value={productDraft.item_type} onChange={(e) => setProductDraft({ ...productDraft, item_type: e.target.value as AdminItemType })}>
                    <option value="drink">Minuman</option>
                    <option value="food">Makanan</option>
                    <option value="other">Lainnya</option>
                  </select>
                </label>
              </div>
              <label>Deskripsi<textarea rows={3} value={productDraft.description ?? ''} onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })} /></label>
              <label>Harga (Rp)<input type="number" min="0" step="100" value={productDraft.price} onChange={(e) => setProductDraft({ ...productDraft, price: e.target.value })} required /></label>

              <div className="admin-image-picker">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
                  style={{ display: 'none' }}
                  onChange={handleProductImageUpload}
                />

                <span className="admin-field-label">
                  Foto / Gambar Produk <span className="admin-required-badge">* Wajib</span>
                </span>

                {productDraft.image_path ? (
                  <div className="admin-image-preview-card">
                    <img
                      src={productDraft.image_path}
                      alt="Pratinjau gambar"
                      className="admin-image-preview-thumb"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = '0.3'
                      }}
                    />
                    <div className="admin-image-preview-meta">
                      <span className="admin-preview-title">Foto Terpasang (Tersimpan di Server)</span>
                      <code className="admin-preview-path" title={productDraft.image_path}>{productDraft.image_path}</code>
                    </div>
                    <button
                      type="button"
                      className="admin-icon-button"
                      title="Sesuaikan gambar (crop / zoom / rotasi / filter)"
                      disabled={uploading}
                      onClick={() => setAdjustModalOpen(true)}
                    >
                      ✂️ Sesuaikan
                    </button>
                    <button
                      type="button"
                      className="admin-icon-button"
                      title="Ganti foto dengan file lain"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      🔄 Ganti
                    </button>
                    <button
                      type="button"
                      className="admin-icon-button danger"
                      title="Hapus gambar"
                      disabled={uploading}
                      onClick={() => setProductDraft({ ...productDraft, image_path: '' })}
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <div
                    className={`admin-upload-dropzone ${isDraggingFile ? 'drag-active' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingFile(true)
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleDropFile}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div className="admin-upload-status">
                        <span className="admin-spinner" />
                        <span>Mengunggah file ke server…</span>
                      </div>
                    ) : (
                      <div className="admin-upload-prompt">
                        <span className="admin-upload-icon">📤</span>
                        <div>
                          <strong>Tarik & lepas foto di sini, atau klik untuk memilih file</strong>
                          <small>Mendukung format JPG, PNG, WEBP, GIF (maksimal 10MB)</small>
                        </div>
                        <button
                          type="button"
                          className="admin-button quiet"
                          onClick={(e) => {
                            e.stopPropagation()
                            fileInputRef.current?.click()
                          }}
                        >
                          Pilih File Foto
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {uploadError && <p className="admin-alert error" role="alert">{uploadError}</p>}
              </div>
              <div className="admin-check-grid">
                <label><input type="checkbox" checked={productDraft.is_active} onChange={(e) => setProductDraft({ ...productDraft, is_active: e.target.checked })} />Tampilkan pada katalog</label>
                <label><input type="checkbox" checked={productDraft.is_available} onChange={(e) => setProductDraft({ ...productDraft, is_available: e.target.checked })} />Tersedia untuk dipesan</label>
                <label><input type="checkbox" checked={productDraft.allow_notes} onChange={(e) => setProductDraft({ ...productDraft, allow_notes: e.target.checked })} />Izinkan catatan khusus</label>
              </div>
              {error && <p className="admin-alert error" role="alert">{error}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-button quiet" onClick={() => setProductEditor(false)}>Batal</button>
                <button className="admin-button primary" disabled={busyId !== null}>{busyId !== null ? 'Menyimpan…' : 'Simpan produk'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL: KATEGORI */}
      {categoryEditor !== false && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCategoryEditor(false) }}>
          <section className="admin-modal compact" role="dialog" aria-modal="true" aria-labelledby="category-modal-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">KATALOG MENU</span>
                <h2 id="category-modal-title">
                  {categoryEditor
                    ? (categoryDraft.is_parent ? 'Ubah Kategori Induk' : 'Ubah Sub-Kategori')
                    : (categoryDraft.is_parent ? 'Tambah Kategori Induk' : 'Tambah Sub-Kategori')}
                </h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setCategoryEditor(false)}>×</button>
            </div>
            <form className="admin-form" onSubmit={saveCategory}>
              <div className="admin-form-row">
                <label>
                  Tingkat Kategori
                  <select
                    value={categoryDraft.is_parent ? 'parent' : 'sub'}
                    disabled={categoryEditor !== null && Boolean((categoryEditor as AdminCategory).children_count && (categoryEditor as AdminCategory).children_count! > 0)}
                    onChange={(e) => {
                      const isParent = e.target.value === 'parent'
                      const defaultParent = categories.find((c) => !c.parent_id)
                      setCategoryDraft({
                        ...categoryDraft,
                        is_parent: isParent,
                        parent_id: isParent ? '' : (categoryDraft.parent_id || (defaultParent ? String(defaultParent.id) : '')),
                      })
                    }}
                  >
                    <option value="parent">Kategori Induk (Utama)</option>
                    <option value="sub">Sub-Kategori</option>
                  </select>
                </label>

                {categoryDraft.is_parent ? (
                  <label>
                    Stasiun Persiapan
                    <select
                      value={categoryDraft.item_type}
                      onChange={(e) => setCategoryDraft({ ...categoryDraft, item_type: e.target.value as 'drink' | 'food' })}
                      required
                    >
                      <option value="drink">Minuman (Stasiun Bar)</option>
                      <option value="food">Makanan (Stasiun Kitchen)</option>
                    </select>
                  </label>
                ) : (
                  <label>
                    Pilih Kategori Induk
                    <select
                      value={categoryDraft.parent_id}
                      onChange={(e) => {
                        const pId = e.target.value
                        const parent = categories.find((c) => String(c.id) === pId)
                        setCategoryDraft({
                          ...categoryDraft,
                          parent_id: pId,
                          item_type: parent?.item_type === 'food' ? 'food' : 'drink',
                        })
                      }}
                      required
                    >
                      <option value="">-- Pilih Kategori Induk --</option>
                      {categories.filter((c) => !c.parent_id && (!categoryEditor || c.id !== categoryEditor.id)).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.item_type === 'food' ? 'Makanan' : 'Minuman'})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <label>
                {categoryDraft.is_parent ? 'Nama Kategori Induk' : 'Nama Sub-Kategori'}
                <input
                  autoFocus
                  maxLength={120}
                  value={categoryDraft.name}
                  onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
                  placeholder={categoryDraft.is_parent ? 'Contoh: Minuman, Makanan' : 'Contoh: Kopi, Non-Kopi, Camilan'}
                  required
                />
              </label>

              <label>
                Deskripsi
                <textarea
                  rows={3}
                  value={categoryDraft.description ?? ''}
                  onChange={(e) => setCategoryDraft({ ...categoryDraft, description: e.target.value })}
                  placeholder="Keterangan singkat mengenai kategori ini"
                />
              </label>

              <label className="admin-checkbox-single">
                <input
                  type="checkbox"
                  checked={categoryDraft.is_active}
                  onChange={(e) => setCategoryDraft({ ...categoryDraft, is_active: e.target.checked })}
                />
                Kategori aktif
              </label>

              {error && <p className="admin-alert error" role="alert">{error}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-button quiet" onClick={() => setCategoryEditor(false)}>Batal</button>
                <button className="admin-button primary" disabled={busyId !== null}>
                  {busyId !== null ? 'Menyimpan…' : categoryDraft.is_parent ? 'Simpan Kategori Induk' : 'Simpan Sub-Kategori'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL: PAKET MENU (BUNDLE BUILDER) */}
      {bundleEditor !== false && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setBundleEditor(false) }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="bundle-modal-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">PAKET BUNDLE</span>
                <h2 id="bundle-modal-title">{bundleEditor ? 'Ubah paket menu' : 'Tambah paket menu'}</h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setBundleEditor(false)}>×</button>
            </div>
            <form className="admin-form" onSubmit={saveBundle}>
              <label>
                Nama paket
                <input
                  autoFocus
                  maxLength={160}
                  placeholder="Contoh: Paket Ngopi Sore"
                  value={bundleDraft.name}
                  onChange={(e) => setBundleDraft({ ...bundleDraft, name: e.target.value })}
                  required
                />
              </label>

              <div className="admin-form-row">
                <label>
                  Kategori paket
                  <select
                    value={bundleDraft.category_id}
                    onChange={(e) => setBundleDraft({ ...bundleDraft, category_id: e.target.value })}
                  >
                    <option value="">Tanpa Kategori (Paket Umum)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Harga paket (Rp)
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="Contoh: 35000"
                    value={bundleDraft.price}
                    onChange={(e) => setBundleDraft({ ...bundleDraft, price: e.target.value })}
                    required
                  />
                </label>
              </div>

              <label>
                Deskripsi paket
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat mengenai isi paket atau penawaran hemat…"
                  value={bundleDraft.description}
                  onChange={(e) => setBundleDraft({ ...bundleDraft, description: e.target.value })}
                />
              </label>

              {/* Upload Foto Paket */}
              <div className="admin-image-picker">
                <input
                  type="file"
                  ref={bundleFileInputRef}
                  accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImageTarget('bundle')
                      void processUploadFile(file)
                    }
                  }}
                />

                <div className="admin-image-picker-header">
                  <span className="admin-field-label">
                    Foto / Gambar Paket Menu <span className="admin-required-badge">* Wajib</span>
                  </span>
                  <small style={{ fontSize: '9px', color: '#7a8076' }}>Rasio 4:3 (JPG, PNG, WEBP)</small>
                </div>

                {bundleDraft.image_path ? (
                  <div className="admin-image-preview-card">
                    <img
                      src={bundleDraft.image_path}
                      alt="Pratinjau gambar paket"
                      className="admin-image-preview-thumb"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = '0.3'
                      }}
                    />
                    <div className="admin-image-preview-meta">
                      <span className="admin-preview-title">Foto Terpasang (Tersimpan di Server)</span>
                      <code className="admin-preview-path" title={bundleDraft.image_path}>{bundleDraft.image_path}</code>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="admin-icon-button"
                        title="Sesuaikan gambar (crop / zoom / rotasi / filter)"
                        disabled={uploading}
                        onClick={() => {
                          setImageTarget('bundle')
                          setAdjustModalOpen(true)
                        }}
                      >
                        ✂️ Sesuaikan
                      </button>
                      <button
                        type="button"
                        className="admin-icon-button"
                        title="Ganti foto dengan file lain"
                        disabled={uploading}
                        onClick={() => {
                          setImageTarget('bundle')
                          bundleFileInputRef.current?.click()
                        }}
                      >
                        🔄 Ganti
                      </button>
                      <button
                        type="button"
                        className="admin-icon-button danger"
                        title="Hapus gambar"
                        disabled={uploading}
                        onClick={() => setBundleDraft({ ...bundleDraft, image_path: '' })}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`admin-upload-dropzone ${isDraggingFile && imageTarget === 'bundle' ? 'drag-active' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setImageTarget('bundle')
                      setIsDraggingFile(true)
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingFile(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file) {
                        setImageTarget('bundle')
                        void processUploadFile(file)
                      }
                    }}
                    onClick={() => {
                      setImageTarget('bundle')
                      !uploading && bundleFileInputRef.current?.click()
                    }}
                  >
                    {uploading && imageTarget === 'bundle' ? (
                      <div className="admin-upload-status">
                        <span className="admin-spinner" />
                        <span>Mengunggah file ke server…</span>
                      </div>
                    ) : (
                      <div className="admin-upload-prompt">
                        <span className="admin-upload-icon">📤</span>
                        <div>
                          <strong>Tarik & lepas foto paket di sini, atau klik untuk memilih file</strong>
                          <small>Mendukung format JPG, PNG, WEBP, GIF (maksimal 10MB)</small>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {uploadError && imageTarget === 'bundle' && (
                  <p className="admin-upload-error">{uploadError}</p>
                )}
              </div>

              {/* Komponen Builder */}
              <div className="bundle-builder">
                <div className="bundle-builder-head">
                  <div>
                    <h4>Komponen menu paket</h4>
                    <small style={{ fontSize: '9px', color: '#7a8076' }}>
                      Pilih menu dan jumlah porsi yang termasuk dalam paket ini
                    </small>
                  </div>
                  <button type="button" className="admin-button quiet" onClick={addBundleComponent} style={{ minHeight: '30px', padding: '0 10px', fontSize: '9.5px', fontWeight: 700 }}>
                    ＋ Tambah item menu
                  </button>
                </div>
                {bundleDraft.components.map((comp, idx) => (
                  <div key={idx} className="bundle-item-row">
                    <select
                      value={comp.product_id}
                      onChange={(e) => updateBundleComponent(idx, Number(e.target.value), comp.quantity)}
                    >
                      {products.map((prod) => (
                        <option value={prod.id} key={prod.id}>
                          {prod.name} ({currency(prod.price)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={comp.quantity}
                      onChange={(e) => updateBundleComponent(idx, comp.product_id, Number(e.target.value))}
                      title="Jumlah porsi"
                      placeholder="Porsi"
                    />
                    <button type="button" className="bundle-item-del" onClick={() => removeBundleComponent(idx)} title="Hapus komponen">×</button>
                  </div>
                ))}
                {!bundleDraft.components.length && (
                  <div style={{ color: '#888', fontSize: '10px', textAlign: 'center', padding: '12px 0' }}>
                    Belum ada menu yang dimasukkan ke dalam paket. Klik tombol “＋ Tambah item menu”.
                  </div>
                )}
                {bundleDraft.components.length > 0 && (
                  <div className="bundle-summary">
                    <span>Nilai normal menu: <b>{currency(bundleCalculatedOriginalPrice)}</b></span>
                    <span>
                      Harga paket: <b>{currency(bundleDraft.price || 0)}</b>{' '}
                      {Number(bundleDraft.price) < bundleCalculatedOriginalPrice && (
                        <span className="admin-badge" style={{ background: '#d4ecd5', color: '#1d5a23', marginLeft: '6px' }}>
                          Hemat {currency(bundleCalculatedOriginalPrice - Number(bundleDraft.price))}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Aktif */}
              <div className="admin-check-grid">
                <label className="admin-checkbox-single">
                  <input
                    type="checkbox"
                    checked={bundleDraft.is_active}
                    onChange={(e) => setBundleDraft({ ...bundleDraft, is_active: e.target.checked })}
                  />
                  <span><b>Paket aktif</b> — Tampilkan di katalog menu dan siap dipesan pelanggan & kasir</span>
                </label>
              </div>

              {error && <p className="admin-alert error" role="alert">{error}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-button quiet" onClick={() => setBundleEditor(false)}>Batal</button>
                <button className="admin-button primary" disabled={busyId !== null}>{busyId !== null ? 'Menyimpan…' : 'Simpan paket'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL: PROMO & VOUCHER */}
      {promotionEditor !== false && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setPromotionEditor(false) }}>
          <section className="admin-modal compact" role="dialog" aria-modal="true" aria-labelledby="promo-modal-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">MARKETING</span>
                <h2 id="promo-modal-title">{promotionEditor ? 'Ubah promo' : 'Buat promo baru'}</h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setPromotionEditor(false)}>×</button>
            </div>
            <form className="admin-form" onSubmit={savePromotion}>
              <div className="admin-form-row">
                <label>Kode voucher<input autoFocus maxLength={50} placeholder="Misal: SATUANG20" style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }} value={promotionDraft.code} onChange={(e) => setPromotionDraft({ ...promotionDraft, code: e.target.value.toUpperCase() })} required /></label>
                <label>Nama promosi<input maxLength={160} placeholder="Diskon 20% Kopi" value={promotionDraft.name} onChange={(e) => setPromotionDraft({ ...promotionDraft, name: e.target.value })} required /></label>
              </div>
              <label>Deskripsi<textarea rows={2} placeholder="Keterangan syarat promo…" value={promotionDraft.description} onChange={(e) => setPromotionDraft({ ...promotionDraft, description: e.target.value })} /></label>
              <div className="admin-form-row">
                <label>Jenis diskon
                  <select
                    value={promotionDraft.discount_type}
                    onChange={(e) => {
                      const newType = e.target.value as 'fixed' | 'percent'
                      let nextVal = promotionDraft.discount_value
                      if (newType === 'fixed' && (Number(nextVal) <= 100 || !nextVal)) {
                        nextVal = '5000'
                      } else if (newType === 'percent' && Number(nextVal) > 100) {
                        nextVal = '10'
                      }
                      setPromotionDraft({
                        ...promotionDraft,
                        discount_type: newType,
                        discount_value: nextVal,
                        max_discount: newType === 'fixed' ? '' : promotionDraft.max_discount,
                      })
                    }}
                  >
                    <option value="percent">Persentase (%)</option>
                    <option value="fixed">Nominal Tetap (Rp)</option>
                  </select>
                </label>
                <label>
                  {promotionDraft.discount_type === 'percent' ? 'Persentase potongan (%)' : 'Nominal potongan (Rp)'}
                  <input
                    type="number"
                    min="1"
                    max={promotionDraft.discount_type === 'percent' ? '100' : undefined}
                    step={promotionDraft.discount_type === 'percent' ? '1' : '100'}
                    placeholder={promotionDraft.discount_type === 'percent' ? 'Contoh: 10' : 'Contoh: 5000'}
                    value={promotionDraft.discount_value}
                    onChange={(e) => setPromotionDraft({ ...promotionDraft, discount_value: e.target.value })}
                    required
                  />
                </label>
              </div>
              <div className="admin-form-row">
                <label>Min. belanja (Rp)<input type="number" min="0" step="1000" placeholder="0" value={promotionDraft.min_spend} onChange={(e) => setPromotionDraft({ ...promotionDraft, min_spend: e.target.value })} /></label>
                <label style={{ opacity: promotionDraft.discount_type === 'fixed' ? 0.45 : 1 }}>
                  Maks. diskon (Rp)
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder={promotionDraft.discount_type === 'fixed' ? 'Tidak berlaku nominal tetap' : 'Kosongkan jika tanpa batas'}
                    disabled={promotionDraft.discount_type === 'fixed'}
                    value={promotionDraft.discount_type === 'fixed' ? '' : promotionDraft.max_discount}
                    onChange={(e) => setPromotionDraft({ ...promotionDraft, max_discount: e.target.value })}
                  />
                </label>
              </div>
              <label className="admin-checkbox-single"><input type="checkbox" checked={promotionDraft.is_active} onChange={(e) => setPromotionDraft({ ...promotionDraft, is_active: e.target.checked })} />Promo aktif dan dapat digunakan</label>
              {error && <p className="admin-alert error" role="alert">{error}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-button quiet" onClick={() => setPromotionEditor(false)}>Batal</button>
                <button className="admin-button primary" disabled={busyId !== null}>{busyId !== null ? 'Menyimpan…' : 'Simpan promo'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL: BANNER */}
      {bannerEditor !== false && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setBannerEditor(false) }}>
          <section className="admin-modal compact" role="dialog" aria-modal="true" aria-labelledby="banner-modal-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">MARKETING</span>
                <h2 id="banner-modal-title">{bannerEditor ? 'Ubah banner' : 'Tambah banner baru'}</h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setBannerEditor(false)}>×</button>
            </div>
            <form className="admin-form" onSubmit={saveBanner}>
              <label>Judul banner<input autoFocus maxLength={160} placeholder="Contoh: Jam Buka Gerai Banjar Wijaya" value={bannerDraft.title} onChange={(e) => setBannerDraft({ ...bannerDraft, title: e.target.value })} required /></label>
              <label>Subjudul<input maxLength={255} placeholder="Buka setiap hari 08.00 - 22.00 WIB" value={bannerDraft.subtitle} onChange={(e) => setBannerDraft({ ...bannerDraft, subtitle: e.target.value })} /></label>
              <div className="admin-form-row">
                <label>Tautan URL (Opsional)<input placeholder="https://..." value={bannerDraft.link_url} onChange={(e) => setBannerDraft({ ...bannerDraft, link_url: e.target.value })} /></label>
                <label>Urutan sort<input type="number" min="0" value={bannerDraft.sort_order} onChange={(e) => setBannerDraft({ ...bannerDraft, sort_order: e.target.value })} required /></label>
              </div>
              <label className="admin-checkbox-single"><input type="checkbox" checked={bannerDraft.is_active} onChange={(e) => setBannerDraft({ ...bannerDraft, is_active: e.target.checked })} />Banner aktif</label>

              {/* Upload Foto Banner */}
              <div className="admin-image-picker">
                <input
                  type="file"
                  ref={bannerFileInputRef}
                  accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImageTarget('banner')
                      void processUploadFile(file)
                    }
                  }}
                />

                <span className="admin-field-label">
                  Gambar Banner Promosi <span className="admin-required-badge">* Wajib</span>
                </span>

                {bannerDraft.image_path ? (
                  <div className="admin-image-preview-card">
                    <img
                      src={bannerDraft.image_path}
                      alt="Pratinjau gambar banner"
                      className="admin-image-preview-thumb"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = '0.3'
                      }}
                    />
                    <div className="admin-image-preview-meta">
                      <span className="admin-preview-title">Gambar Banner Terpasang</span>
                      <code className="admin-preview-path" title={bannerDraft.image_path}>{bannerDraft.image_path}</code>
                    </div>
                    <button
                      type="button"
                      className="admin-icon-button"
                      title="Sesuaikan gambar (crop / zoom / rotasi / filter)"
                      disabled={uploading}
                      onClick={() => {
                        setImageTarget('banner')
                        setAdjustModalOpen(true)
                      }}
                    >
                      ✂️ Sesuaikan
                    </button>
                    <button
                      type="button"
                      className="admin-icon-button"
                      title="Ganti gambar dengan file lain"
                      disabled={uploading}
                      onClick={() => {
                        setImageTarget('banner')
                        bannerFileInputRef.current?.click()
                      }}
                    >
                      🔄 Ganti
                    </button>
                    <button
                      type="button"
                      className="admin-icon-button danger"
                      title="Hapus gambar"
                      disabled={uploading}
                      onClick={() => setBannerDraft({ ...bannerDraft, image_path: '' })}
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <div
                    className={`admin-upload-dropzone ${isDraggingFile && imageTarget === 'banner' ? 'drag-active' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setImageTarget('banner')
                      setIsDraggingFile(true)
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingFile(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file) {
                        setImageTarget('banner')
                        void processUploadFile(file)
                      }
                    }}
                    onClick={() => {
                      setImageTarget('banner')
                      !uploading && bannerFileInputRef.current?.click()
                    }}
                  >
                    {uploading && imageTarget === 'banner' ? (
                      <div className="admin-upload-status">
                        <span className="admin-spinner" />
                        <span>Mengunggah file ke server…</span>
                      </div>
                    ) : (
                      <div className="admin-upload-prompt">
                        <span className="admin-upload-icon">📤</span>
                        <div>
                          <strong>Tarik & lepas gambar banner di sini, atau klik untuk memilih file</strong>
                          <small>Mendukung format JPG, PNG, WEBP, GIF (maksimal 10MB)</small>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {uploadError && imageTarget === 'banner' && (
                  <p className="admin-upload-error">{uploadError}</p>
                )}
              </div>
              {error && <p className="admin-alert error" role="alert">{error}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-button quiet" onClick={() => setBannerEditor(false)}>Batal</button>
                <button className="admin-button primary" disabled={busyId !== null}>{busyId !== null ? 'Menyimpan…' : 'Simpan banner'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL: KELOLA STAF */}
      {staffEditor !== false && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setStaffEditor(false) }}>
          <section className="admin-modal compact" role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">MANAJEMEN PENGGUNA</span>
                <h2 id="staff-modal-title">{staffEditor ? `Ubah staf: ${staffEditor.name}` : 'Tambah akun staf'}</h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setStaffEditor(false)}>×</button>
            </div>
            <form className="admin-form" onSubmit={saveStaff}>
              <label>Nama lengkap<input autoFocus maxLength={160} placeholder="Nama staf" value={staffDraft.name} onChange={(e) => setStaffDraft({ ...staffDraft, name: e.target.value })} required /></label>
              <label>Email<input type="email" maxLength={180} placeholder="staf@satuang.test" value={staffDraft.email} onChange={(e) => setStaffDraft({ ...staffDraft, email: e.target.value })} required /></label>
              
              <div className="admin-form-row">
                <label>Peran hak akses
                  <select
                    value={staffDraft.role}
                    disabled={Boolean(staffEditor && staffEditor.id === staff.id)}
                    onChange={(e) => setStaffDraft({ ...staffDraft, role: e.target.value as 'admin' | 'cashier' })}
                  >
                    <option value="cashier">Kasir (Web Kasir)</option>
                    <option value="admin">Administrator (Akses Penuh)</option>
                  </select>
                </label>
                <label className="admin-checkbox-single">
                  <input
                    type="checkbox"
                    checked={staffDraft.is_active}
                    disabled={Boolean(staffEditor && staffEditor.id === staff.id)}
                    onChange={(e) => setStaffDraft({ ...staffDraft, is_active: e.target.checked })}
                  />
                  Akun aktif
                </label>
              </div>

              <label>
                Kata sandi {staffEditor && <small style={{ fontWeight: 'normal', color: '#888' }}>(Kosongkan jika tidak ingin mengubah kata sandi)</small>}
                <input
                  type="password"
                  minLength={12}
                  placeholder={staffEditor ? 'Minimal 12 karakter baru' : 'Minimal 12 karakter kata sandi aman'}
                  value={staffDraft.password}
                  onChange={(e) => setStaffDraft({ ...staffDraft, password: e.target.value })}
                  required={!staffEditor}
                />
              </label>

              {staffEditor && staffEditor.id === staff.id && (
                <p style={{ margin: 0, fontSize: '9px', color: '#858981' }}>
                  * Anda sedang mengedit akun Anda sendiri. Peran dan status aktif dikunci untuk mencegah penguncian sistem.
                </p>
              )}

              {error && <p className="admin-alert error" role="alert">{error}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-button quiet" onClick={() => setStaffEditor(false)}>Batal</button>
                <button className="admin-button primary" disabled={busyId !== null}>{busyId !== null ? 'Menyimpan…' : 'Simpan staf'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL: RINCIAN PESANAN LENGKAP */}
      {selectedOrder && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null) }}>
          <section className="admin-modal compact" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">DETAIL PESANAN</span>
                <h2 id="order-detail-title">No. {selectedOrder.order_number}</h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div style={{ padding: '16px 0' }}>
              <div className="order-meta-grid">
                <div><span>Pelanggan</span><b>{selectedOrder.customer_name}</b></div>
                <div><span>Kontak / HP</span><b>{selectedOrder.customer_phone || '—'}</b></div>
                <div><span>Waktu Pesan</span><b>{dateTime(selectedOrder.created_at)}</b></div>
                <div><span>Metode Bayar</span><b>{selectedOrder.payment_method.toUpperCase()} ({selectedOrder.payment_status})</b></div>
              </div>

              <h4 style={{ margin: '14px 0 6px', fontSize: '11px' }}>Daftar Item Menu</h4>
              <div className="order-detail-items">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="order-detail-row">
                    <div>
                      <b>{item.quantity}× {item.product_name_snapshot}</b>
                      {item.special_instructions && (
                        <small className="order-detail-notes">Catatan: {item.special_instructions}</small>
                      )}
                    </div>
                    <div><b>{currency(item.line_total)}</b></div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #e0e2db', paddingTop: '10px', display: 'grid', gap: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span><span>{currency(selectedOrder.subtotal)}</span>
                </div>
                {Number(selectedOrder.discount_total) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c96738' }}>
                    <span>Diskon</span><span>−{currency(selectedOrder.discount_total)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '6px' }}>
                  <span>Total Transaksi</span><span>{currency(selectedOrder.total)}</span>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="admin-button primary" onClick={() => setSelectedOrder(null)}>Tutup Rincian</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* MODAL: DETAIL AUDIT LOG */}
      {selectedAuditLog && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedAuditLog(null) }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">DETAIL AUDIT LOG #{selectedAuditLog.id}</span>
                <h2 id="audit-modal-title">{selectedAuditLog.action}</h2>
              </div>
              <button className="admin-close" aria-label="Tutup" onClick={() => setSelectedAuditLog(null)}>×</button>
            </div>
            <div style={{ padding: '16px 0', fontSize: '11px' }}>
              <p><b>Pelaku:</b> {selectedAuditLog.actor_name} ({selectedAuditLog.actor_email})</p>
              <p><b>Waktu:</b> {dateTime(selectedAuditLog.created_at)}</p>
              <p><b>Subjek:</b> <code>{selectedAuditLog.subject_type} #{selectedAuditLog.subject_id}</code></p>
              {selectedAuditLog.ip_address && <p><b>IP Address:</b> {selectedAuditLog.ip_address}</p>}

              {selectedAuditLog.before_snapshot && (
                <div>
                  <h4 style={{ margin: '12px 0 4px', fontSize: '11px' }}>Snapshot Sebelum (Before)</h4>
                  <pre className="audit-snapshot-box">{JSON.stringify(JSON.parse(selectedAuditLog.before_snapshot), null, 2)}</pre>
                </div>
              )}

              {selectedAuditLog.after_snapshot && (
                <div>
                  <h4 style={{ margin: '12px 0 4px', fontSize: '11px' }}>Snapshot Sesudah (After)</h4>
                  <pre className="audit-snapshot-box">{JSON.stringify(JSON.parse(selectedAuditLog.after_snapshot), null, 2)}</pre>
                </div>
              )}

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="admin-button primary" onClick={() => setSelectedAuditLog(null)}>Tutup Log</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {/* MODAL: SESUAIKAN GAMBAR PRODUK / PAKET / BANNER */}
      {adjustModalOpen && (
        imageTarget === 'bundle'
          ? bundleDraft.image_path
          : imageTarget === 'banner'
            ? bannerDraft.image_path
            : productDraft.image_path
      ) && (
        <ImageAdjustModal
          key={
            imageTarget === 'bundle'
              ? bundleDraft.image_path
              : imageTarget === 'banner'
                ? bannerDraft.image_path
                : productDraft.image_path
          }
          isOpen={adjustModalOpen}
          imageSrc={
            imageTarget === 'bundle'
              ? bundleDraft.image_path
              : imageTarget === 'banner'
                ? bannerDraft.image_path
                : productDraft.image_path
          }
          onClose={() => setAdjustModalOpen(false)}
          onApply={handleApplyAdjustedImage}
        />
      )}
    </div>
  )
}
