import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppProvider from './state/AppProvider.jsx'
import { homeFor, useApp } from './state/appContext.js'
import ToastProvider from './ui/ToastProvider.jsx'
import AppShell from './components/AppShell.jsx'
import Login from './components/Login.jsx'
import Register from './components/Register.jsx'
import CustomerPortal from './components/CustomerPortal.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import Dashboard from './components/admin/Dashboard.jsx'
import Customers from './components/admin/Customers.jsx'
import AddCustomer from './components/admin/AddCustomer.jsx'
import Attendance from './components/admin/Attendance.jsx'
import { ROLES } from './rules.js'

// "/" sends people to the right place for their role.
function Home() {
  const { session } = useApp()
  return <Navigate to={homeFor(session)} replace />
}

// Login and register pages are for signed-out visitors only.
function GuestOnly({ children }) {
  const { session } = useApp()
  return session ? <Navigate to={homeFor(session)} replace /> : children
}

// Signed-out visitors go to /login; the wrong role goes back to its own home.
function RequireRole({ role }) {
  const { session } = useApp()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== role) return <Navigate to={homeFor(session)} replace />
  return <AppShell />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

            <Route element={<RequireRole role={ROLES.CUSTOMER} />}>
              <Route path="/customer" element={<CustomerPortal />} />
            </Route>

            <Route path="/admin" element={<RequireRole role={ROLES.ADMIN} />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="customers" element={<Customers />} />
                <Route path="add" element={<AddCustomer />} />
                <Route path="attendance" element={<Attendance />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
