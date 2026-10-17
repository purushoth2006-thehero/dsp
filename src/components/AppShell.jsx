import { Outlet } from 'react-router-dom'
import { useApp } from '../state/appContext.js'
import { BRAND, ROLES } from '../rules.js'

// Top bar shared by every signed-in page.
export default function AppShell() {
  const { session, data, logout } = useApp()
  const name = session.role === ROLES.ADMIN
    ? 'Administrator'
    : data.customers.find((c) => c.id === session.id)?.name

  return (
    <div className="app">
      <header className="topbar">
        <h1><span aria-hidden="true">🚗</span> {BRAND}</h1>
        <div className="topbar-right">
          <span className="who">{name}</span>
          <button type="button" className="ghost light" onClick={logout}>Sign out</button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
