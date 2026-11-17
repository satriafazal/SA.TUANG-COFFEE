import { Navigate, Route, Routes } from 'react-router-dom'
import { CustomerProvider } from './context/CustomerContext'
import { CustomerLayout } from './CustomerLayout'
import {
  IdentityRoute,
  LandingRoute,
  LoginRoute,
  MemberDashboardRoute,
  MemberPointsRoute,
  MenuRoute,
  NotFoundRoute,
  OrdersRoute,
  RecoveryRoute,
  RegisterRoute,
  TrackingRoute,
} from './CustomerRoutePages'

export function CustomerApp() {
  return (
    <CustomerProvider>
      <Routes>
        <Route element={<CustomerLayout />}>
          <Route index element={<LandingRoute />} />
          <Route path="pilih-akses" element={<IdentityRoute />} />
          <Route path="identity" element={<Navigate to="/pilih-akses" replace />} />
          <Route path="menu" element={<MenuRoute />} />
          <Route path="order-menu" element={<Navigate to="/menu" replace />} />
          <Route path="masuk" element={<LoginRoute />} />
          <Route path="login" element={<Navigate to="/masuk" replace />} />
          <Route path="daftar" element={<RegisterRoute />} />
          <Route path="register" element={<Navigate to="/daftar" replace />} />
          <Route path="pesanan" element={<OrdersRoute />} />
          <Route path="orders" element={<Navigate to="/pesanan" replace />} />
          <Route path="lacak" element={<TrackingRoute />} />
          <Route path="tracking" element={<Navigate to="/lacak" replace />} />
          <Route path="lupa-kode" element={<RecoveryRoute />} />
          <Route path="recovery" element={<Navigate to="/lupa-kode" replace />} />
          <Route path="member" element={<MemberDashboardRoute />} />
          <Route path="member/poin" element={<MemberPointsRoute />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Route>
      </Routes>
    </CustomerProvider>
  )
}

export default CustomerApp
