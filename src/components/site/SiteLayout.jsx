import { NavLink, Link, Outlet } from 'react-router-dom'
import { homeFor, useApp } from '../../state/appContext.js'
import ThemeToggle from '../../ui/ThemeToggle.jsx'
import { BRAND } from '../../rules.js'

const MENU = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/offers', label: 'Offers' },
  { to: '/contact', label: 'Contact Us' },
]

// The public website: menu on the left, "Student Corner" (the login) at the top right.
export default function SiteLayout() {
  const { session } = useApp()
  return (
    <div className="site">
      <header className="site-top">
        <Link to="/" className="site-brand">
          <img src="/logo.png" alt="" width="36" height="36" />
          <span>{BRAND}</span>
        </Link>
        <div className="site-top-actions">
          <ThemeToggle />
          <Link to={session ? homeFor(session) : '/login'} className="primary student-corner">
            {session ? 'My account' : 'Student Corner'}
          </Link>
        </div>
      </header>

      <div className="site-body">
        <nav className="site-menu" aria-label="Main menu">
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {m.label}
            </NavLink>
          ))}
        </nav>
        <main className="site-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
