import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppProvider from './state/AppProvider.jsx'
import { homeFor, useApp } from './state/appContext.js'
import ToastProvider from './ui/ToastProvider.jsx'
import AppShell from './components/AppShell.jsx'
import Login from './components/Login.jsx'
import CustomerPortal from './components/CustomerPortal.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import Dashboard from './components/admin/Dashboard.jsx'
import Customers from './components/admin/Customers.jsx'
import AddCustomer from './components/admin/AddCustomer.jsx'
import Lessons from './components/admin/Lessons.jsx'
import Attendance from './components/admin/Attendance.jsx'
import AdminOffers from './components/admin/AdminOffers.jsx'
import SiteLayout from './components/site/SiteLayout.jsx'
import CarGame from './components/site/CarGame.jsx'
import { ContactPage, HomePage, OffersPage, ServicesPage } from './components/site/Pages.jsx'
import { ROLES } from './rules.js'

// The login page is for signed-out visitors only.
function GuestOnly({ children }) {
  const { session } = useApp()
  return session ? <Navigate to={homeFor(session)} replace /> : children
}

// Signed-out visitors go to their own login page; the wrong role goes back to its own home.
function RequireRole({ role }) {
  const { session } = useApp()
  if (!session) return <Navigate to={role === ROLES.ADMIN ? '/admin-login' : '/students-login'} replace />
  if (session.role !== role) return <Navigate to={homeFor(session)} replace />
  return <AppShell />
}

function AppRoutes() {
  const { loading } = useApp()
  if (loading) return <div className="splash" role="status">Loading…</div>

  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/game" element={<CarGame />} />
      </Route>
      <Route path="/students-login" element={<GuestOnly><Login role={ROLES.CUSTOMER} /></GuestOnly>} />
      <Route path="/admin-login" element={<GuestOnly><Login role={ROLES.ADMIN} /></GuestOnly>} />
      <Route path="/login" element={<Navigate to="/students-login" replace />} />

      <Route element={<RequireRole role={ROLES.CUSTOMER} />}>
        <Route path="/customer" element={<CustomerPortal />} />
      </Route>

      <Route path="/admin" element={<RequireRole role={ROLES.ADMIN} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="add" element={<AddCustomer />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="offers" element={<AdminOffers />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
