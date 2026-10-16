import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './customer-flow.css'
import App from './App'
import CashierApp from './CashierApp'
import AdminApp from './AdminApp'

const isCashierRoute = window.location.pathname === '/kasir' || window.location.pathname.startsWith('/kasir/')
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
document.documentElement.classList.toggle('cashier-mode', isCashierRoute)
document.documentElement.classList.toggle('admin-mode', isAdminRoute)
if (isCashierRoute) document.title = 'SA.TUANG COFFEE · Kasir'
if (isAdminRoute) document.title = 'SA.TUANG COFFEE · Admin'
const RootApp = isCashierRoute ? CashierApp : isAdminRoute ? AdminApp : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
