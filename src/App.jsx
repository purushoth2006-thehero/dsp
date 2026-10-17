<<<<<<< HEAD
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
=======
import { useEffect, useState } from 'react'
import { loadData, saveData } from './store.js'
import Login from './components/Login.jsx'
import CustomerPortal from './components/CustomerPortal.jsx'
import AdminPortal from './components/AdminPortal.jsx'

export default function App() {
  const [data, setData] = useState(loadData)
  const [session, setSession] = useState(null) // { role: 'customer'|'admin', id }

  useEffect(() => saveData(data), [data])

  if (!session) return <Login data={data} onLogin={setSession} />

  return (
    <div className="app">
      <header className="topbar">
        <h1>🚗 DriveEasy Driving School</h1>
        <div>
          <span className="who">
            {session.role === 'admin'
              ? 'Administrator'
              : data.customers.find((c) => c.id === session.id)?.name}
          </span>
          <button className="ghost" onClick={() => setSession(null)}>Sign out</button>
        </div>
      </header>

      {session.role === 'customer' ? (
        <CustomerPortal
          customer={data.customers.find((c) => c.id === session.id)}
          appointments={data.appointments}
          update={(fn) => setData((d) => ({ ...d, ...fn(d) }))}
        />
      ) : (
        <AdminPortal data={data} setData={setData} />
      )}
    </div>
  )
}
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd
