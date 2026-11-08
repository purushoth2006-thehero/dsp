import { useEffect, useState } from 'react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import { homeFor, useApp } from '../../state/appContext.js'
import SiteLoader from './SiteLoader.jsx'
import useSiteReady from './useSiteReady.js'
import ThemeToggle from '../../ui/ThemeToggle.jsx'
import { BRAND } from '../../rules.js'

const MENU = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/offers', label: 'Offers' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/game', label: 'Drive' },
]

// The public website: the menu hides behind a three-line button; "Students Corner" and "Admin Login" (separate portals) sit at the top right.
export default function SiteLayout() {
  const { session } = useApp()
  const [open, setOpen] = useState(false)
  const ready = useSiteReady()
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!ready) return <SiteLoader />
  return (
    <div className="site">
      <header className="site-top">
        <div className="site-top-left">
          <button type="button" className="menu-btn" aria-label="Menu" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
            <span /><span /><span />
          </button>
          <Link to="/" className="site-brand">
            <img src="/logo.png" alt="" width="36" height="36" />
            <span>{BRAND}</span>
          </Link>
        </div>
        <div className="site-top-actions">
          <ThemeToggle />
          {session ? (
            <Link to={homeFor(session)} className="primary student-corner">My account</Link>
          ) : (
            <>
              <Link to="/students-login" className="primary student-corner">Students Corner</Link>
              <Link to="/admin-login" className="ghost student-corner">Admin Login</Link>
            </>
          )}
        </div>
      </header>

      <div className="site-body">
        {open && <div className="menu-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
        <nav id="site-menu" className={`site-menu${open ? ' open' : ''}`} aria-label="Main menu"
             {...(open ? {} : { inert: '' })}>
          <div className="menu-title">Menu</div>
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
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
