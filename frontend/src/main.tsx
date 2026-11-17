import './utils/uuid'
import { Component, StrictMode, Suspense, lazy, useEffect, type ReactNode, type ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles/index.css'
import CustomerApp from './features/customer/CustomerApp'

const CashierApp = lazy(() => import('./features/cashier/CashierApp'))
const AdminApp = lazy(() => import('./features/admin/AdminApp'))

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app crash:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
          <h2>Terjadi Kesalahan Aplikasi</h2>
          <p style={{ color: '#c0392b' }}>{this.state.error?.message || 'Gagal memuat aplikasi.'}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.6rem 1.2rem',
              backgroundColor: '#382218',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function CashierWrapper() {
  useEffect(() => {
    document.documentElement.classList.add('cashier-mode')
    document.documentElement.classList.remove('admin-mode')
    document.title = 'SA.TUANG COFFEE · Kasir'
    return () => {
      document.documentElement.classList.remove('cashier-mode')
    }
  }, [])

  return (
    <Suspense fallback={<div className="notice" style={{ padding: '3rem', textAlign: 'center' }}>Menyiapkan kasir…</div>}>
      <CashierApp />
    </Suspense>
  )
}

function AdminWrapper() {
  useEffect(() => {
    document.documentElement.classList.add('admin-mode')
    document.documentElement.classList.remove('cashier-mode')
    document.title = 'SA.TUANG COFFEE · Admin'
    return () => {
      document.documentElement.classList.remove('admin-mode')
    }
  }, [])

  return (
    <Suspense fallback={<div className="notice" style={{ padding: '3rem', textAlign: 'center' }}>Menyiapkan dasbor admin…</div>}>
      <AdminApp />
    </Suspense>
  )
}

function CustomerWrapper() {
  useEffect(() => {
    document.documentElement.classList.remove('cashier-mode')
    document.documentElement.classList.remove('admin-mode')
    document.title = 'SA.TUANG COFFEE — Everyday Brew'
  }, [])

  return <CustomerApp />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/kasir/*" element={<CashierWrapper />} />
          <Route path="/admin/*" element={<AdminWrapper />} />
          <Route path="/*" element={<CustomerWrapper />} />
        </Routes>
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
)
