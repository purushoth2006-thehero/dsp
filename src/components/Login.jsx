import { useState } from 'react'
<<<<<<< HEAD
import { Link } from 'react-router-dom'
import { useApp } from '../state/appContext.js'
import { Field, PasswordInput } from '../ui/Field.jsx'
import { BRAND, ROLES } from '../rules.js'

// Demo logins are shown only in development, or when VITE_SHOW_DEMO=true is set at build time.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true'

export default function Login() {
  const { loginAdmin, loginCustomer } = useApp()
  const [role, setRole] = useState(ROLES.CUSTOMER)
=======

export default function Login({ data, onLogin }) {
  const [tab, setTab] = useState('customer')
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

<<<<<<< HEAD
  const switchRole = (next) => {
    setRole(next)
    setPassword('')
    setError('')
  }

  const submit = (e) => {
    e.preventDefault()
    setError('')
    const result = role === ROLES.ADMIN ? loginAdmin(username, password) : loginCustomer(username, password)
    if (!result.ok) setError(result.error)
  }

  const isAdmin = role === ROLES.ADMIN

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1><span aria-hidden="true">🚗</span> {BRAND}</h1>

        <div className="tabs" role="group" aria-label="Sign in as">
          <button type="button" className={!isAdmin ? 'active' : ''} aria-pressed={!isAdmin} onClick={() => switchRole(ROLES.CUSTOMER)}>
            Customer
          </button>
          <button type="button" className={isAdmin ? 'active' : ''} aria-pressed={isAdmin} onClick={() => switchRole(ROLES.ADMIN)}>
=======
  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (tab === 'admin') {
      if (username === data.admin.username && password === data.admin.password) {
        onLogin({ role: 'admin' })
      } else {
        setError('Invalid admin credentials')
      }
      return
    }
    const found = data.customers.find(
      (c) => (c.email === username || c.phone === username) && c.password === password
    )
    if (found) onLogin({ role: 'customer', id: found.id })
    else setError('Invalid email/phone or password')
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🚗 Sridhar Driving School</h1>
        <div className="tabs">
          <button className={tab === 'customer' ? 'active' : ''} onClick={() => { setTab('customer'); setError('') }}>
            Customer
          </button>
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => { setTab('admin'); setError('') }}>
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd
            Admin
          </button>
        </div>

<<<<<<< HEAD
        <form className="form" onSubmit={submit}>
          <Field label={isAdmin ? 'Username' : 'Email or mobile number'}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>

          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" type="submit">Sign in</button>
        </form>

        {!isAdmin && (
          <p className="auth-alt">
            New student? <Link to="/register">Create an account</Link>
          </p>
        )}

        {SHOW_DEMO && (
          <p className="hint">
            Demo admin: <b>admin / admin123</b><br />
            Demo customer: <b>alice@example.com / pass123</b>
          </p>
        )}
      </div>
    </main>
  )
}
=======
        <form onSubmit={submit}>
          <label>{tab === 'admin' ? 'Username' : 'Email or phone'}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={tab === 'admin' ? 'admin' : 'alice@example.com'}
            required
          />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Sign in</button>
        </form>

        <p className="hint">
          Demo admin: <b>admin / admin123</b><br />
          Demo customer: <b>alice@example.com / pass123</b>
        </p>
      </div>
    </div>
  )
}
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd
