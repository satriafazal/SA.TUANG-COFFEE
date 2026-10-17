import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import CustomerApp from './features/customer/CustomerApp'
import CashierApp from './features/cashier/CashierApp'
import AdminApp from './features/admin/AdminApp'

const isCashierRoute = window.location.pathname === '/kasir' || window.location.pathname.startsWith('/kasir/')
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
document.documentElement.classList.toggle('cashier-mode', isCashierRoute)
document.documentElement.classList.toggle('admin-mode', isAdminRoute)
if (isCashierRoute) document.title = 'SA.TUANG COFFEE · Kasir'
if (isAdminRoute) document.title = 'SA.TUANG COFFEE · Admin'
const RootApp = isCashierRoute ? CashierApp : isAdminRoute ? AdminApp : CustomerApp

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
