import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/add', label: 'Add customer' },
  { to: '/admin/lessons', label: 'Lessons' },
  { to: '/admin/attendance', label: 'Attendance' },
]

export default function AdminLayout() {
  return (
    <main>
      <nav className="tabs wide" aria-label="Admin sections">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </main>
  )
}
